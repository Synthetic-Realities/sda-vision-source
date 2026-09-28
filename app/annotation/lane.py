"""Annotation-lane runner: the existing vision panel, the lane's own prompt.

Reuses the scored pass's vendor machinery deliberately: the three endpoint
URLs below are byte-identical to app/providers/{claude,openai,gemini}.py, the
OpenAI budget and reasoning tune-downs are imported from the provider module,
and the Gemini generation config is imported likewise. The lane therefore adds
NO outbound host beyond the three keyed vendor endpoints the scored pass
already uses, and it never fetches a referent (a test pins both).

Read-only with respect to the score: nothing in this module is imported by
app/aggregate.py, app/score.py, or the scored path of app/pipeline.py.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

import httpx

from ..config import ANNOTATION_PROMPT_VERSION, PANEL_VERSION, settings
from ..ingest import Ingested
from ..providers.gemini import generation_config
from ..providers.claude import tune_request as tune_claude_request
from ..providers.openai import _completion_budget, _tune_reasoning
from ..providers.prompt import extract_json
from .prompts import build_annotation_prompt
from .schema import _forbidden_keys, validate_pointer

_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
_OPENAI_URL = "https://api.openai.com/v1/chat/completions"
_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


async def annotate(ing: Ingested, caption: str) -> dict:
    """Run the annotation pass over the same deterministic frame sample the
    scored pass uses. Returns validated pointers plus lane metadata; invalid
    model output is dropped and counted, never repaired and never fabricated."""
    emitted_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    callers = _enabled_callers()
    notes: list[str] = []
    if not callers:
        notes.append("Source suggestions unavailable: no vision provider is configured and enabled.")

    raw_results: list[tuple[str, str, dict | None, str | None]] = []
    async with httpx.AsyncClient(timeout=httpx.Timeout(settings.provider_timeout)) as client:
        tasks = []
        labels = []
        for frame in ing.frames:
            prompt = build_annotation_prompt(ing.filename, frame.label, caption)
            for model_id, call in callers:
                labels.append((model_id, frame.label))
                tasks.append(call(client, frame.media, prompt))
        replies = await asyncio.gather(*tasks, return_exceptions=True)
    for (model_id, frame_label), reply in zip(labels, replies):
        if isinstance(reply, BaseException):
            raw_results.append((model_id, frame_label, None, f"{type(reply).__name__}: {reply}"))
        else:
            text, err = reply
            raw_results.append((model_id, frame_label, extract_json(text) if text else None, err))

    pointers: list[dict] = []
    dropped = 0
    seq = 0
    # Pointer ids are scoped per run, so a re-run on the same report can never
    # produce two different pointers sharing an id (check records join on
    # pointer_id alone, spec 6.6).
    run_id = uuid4().hex[:6]
    for model_id, frame_label, data, err in raw_results:
        if err:
            notes.append(f"{model_id} on {frame_label}: {err}")
            continue
        # extract_json can legally return a list or scalar despite its
        # annotation; a non-dict reply is a malformed emission, never a crash.
        candidates = data.get("pointers") if isinstance(data, dict) else None
        if not isinstance(candidates, list):
            notes.append(f"{model_id} on {frame_label}: reply carried no pointers list.")
            continue
        if len(candidates) > 5:
            notes.append(f"{model_id} on {frame_label}: {len(candidates) - 5} candidate(s) "
                         "beyond the five-per-frame cap were discarded.")
        for raw in candidates[:5]:
            if not isinstance(raw, dict):
                dropped += 1
                continue
            # A raw emission carrying any forbidden field is dropped WHOLE.
            # Stripping the verdict and keeping the rest would silently
            # launder a verdict-bearing emission into a clean-looking
            # pointer, which is repair, and the lane never repairs.
            if _forbidden_keys(raw):
                dropped += 1
                continue
            seq += 1
            pointer = {
                "pointer_id": f"ptr-{run_id}-{seq:04d}",
                "artefact_ref": f"{ing.filename}/{frame_label}",
                "observation": _s(raw.get("observation")),
                "verification_action": _s(raw.get("verification_action")),
                "referent_source": _s(raw.get("referent_source")),
                "referent_capture_date": _s(raw.get("referent_capture_date")),
                "referent_authority": _s(raw.get("referent_authority")),
                "referent_version": _s(raw.get("referent_version")),
                "emitted_by": model_id,
                "panel_version": PANEL_VERSION,
                "prompt_version": ANNOTATION_PROMPT_VERSION,
                "emitted_at": emitted_at,
            }
            if validate_pointer(pointer):
                dropped += 1
                seq -= 1
                continue
            pointers.append(pointer)
    if dropped:
        notes.append(f"{dropped} source suggestion(s) failed validation and were excluded.")

    return {
        "annotation_pointers": pointers,
        "annotation_meta": {
            "panel_version": PANEL_VERSION,
            "prompt_version": ANNOTATION_PROMPT_VERSION,
            "emitted_at": emitted_at,
            "models": [m for m, _ in callers],
            "notes": notes,
        },
    }


def _s(v) -> str:
    """Plain strings only. Stringifying a dict or list here would launder
    structured verdict freight (e.g. {"confidence_score": 0.93}) into a
    validated string field; a non-string value becomes empty, fails
    validation, and the emission is dropped whole and counted."""
    return v.strip() if isinstance(v, str) else ""


def _enabled_callers():
    """The same configured-and-enabled gating the scored providers apply."""
    callers = []
    if settings.anthropic_key and not settings.disable_anthropic:
        callers.append((settings.anthropic_model, _ask_claude))
    if settings.openai_key and not settings.disable_openai:
        callers.append((settings.openai_model, _ask_openai))
    if settings.google_key and not settings.disable_google:
        callers.append((settings.google_model, _ask_gemini))
    return callers


async def _ask_claude(client, media, prompt):
    body = {
        "model": settings.anthropic_model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image", "source": {"type": "base64",
                                         "media_type": media.vision_mime,
                                         "data": media.vision_b64}},
        ]}],
    }
    tune_claude_request(body, settings.anthropic_model)
    headers = {"x-api-key": settings.anthropic_key,
               "anthropic-version": "2023-06-01", "content-type": "application/json"}
    resp = await _post(client, _ANTHROPIC_URL, headers, body)
    if resp.status_code >= 300:
        return None, f"HTTP {resp.status_code}"
    text = "".join(b.get("text", "") for b in resp.json().get("content", [])).strip()
    return text, None


async def _ask_openai(client, media, prompt):
    model = settings.openai_model
    body = {
        "model": model,
        "max_completion_tokens": _completion_budget(model),
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": media.vision_data_url}},
        ]}],
    }
    _tune_reasoning(body, model)
    headers = {"authorization": f"Bearer {settings.openai_key}",
               "content-type": "application/json"}
    resp = await _post(client, _OPENAI_URL, headers, body)
    if resp.status_code >= 300:
        return None, f"HTTP {resp.status_code}"
    out = (((resp.json().get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    return out, None


async def _ask_gemini(client, media, prompt):
    model = settings.google_model
    body = {
        "contents": [{"role": "user", "parts": [
            {"text": prompt},
            {"inline_data": {"mime_type": media.vision_mime, "data": media.vision_b64}},
        ]}],
        "generationConfig": generation_config(model, 2048, legacy_temperature=0.2),
    }
    headers = {"content-type": "application/json", "x-goog-api-key": settings.google_key}
    resp = await _post(client, _GEMINI_URL.format(model=model), headers, body)
    if resp.status_code >= 300:
        return None, f"HTTP {resp.status_code}"
    candidates = resp.json().get("candidates") or [{}]
    parts = ((candidates[0].get("content") or {}).get("parts")) or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        return None, f"no text ({candidates[0].get('finishReason') or 'unknown'})"
    return text, None


async def _post(client, url, headers, body):
    last = None
    for _ in range(settings.provider_retries + 1):
        try:
            return await client.post(url, headers=headers, json=body)
        except httpx.HTTPError as exc:
            last = exc
    raise last
