"""Google Gemini vision provider (AI Studio / generativelanguage API)."""
from __future__ import annotations

import time

import httpx

from ..config import settings
from ..media import Media
from ..schema import Kind, ProviderResult, Status
from .base import text_result_from_json, vision_result_from_json
from .prompt import build_prompt, build_text_prompt, extract_json

ID = "gemini"
NAME = "Gemini Vision"


def generation_config(model: str, max_tokens: int, *, json_out: bool = True,
                      legacy_temperature: float | None = None) -> dict:
    """generationConfig tuned per model family.

    Gemini 3+ replaced the thinkingBudget token cap with named thinkingLevel
    values ("minimal" = nearly no reasoning - right for this structured-JSON
    task, where reasoning tokens would eat the output budget), and Google now
    strongly recommends leaving temperature at its 1.0 default (lowering it
    can loop or degrade Gemini 3 outputs). Gemini 2.x keeps the old knobs so
    a .env override back to gemini-2.5-flash still works.
    """
    cfg: dict = {"maxOutputTokens": max_tokens}
    if json_out:
        cfg["responseMimeType"] = "application/json"
    if model.lower().startswith(("gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.1-pro")):
        cfg["thinkingConfig"] = {"thinkingLevel": "low"}
        cfg["maxOutputTokens"] = max(max_tokens, 8192)
    elif model.lower().startswith("gemini-3") or model.lower().startswith("gemini-flash-latest"):
        cfg["thinkingConfig"] = {"thinkingLevel": "minimal"}
    else:
        cfg["thinkingConfig"] = {"thinkingBudget": 0}
        if legacy_temperature is not None:
            cfg["temperature"] = legacy_temperature
    return cfg



def _headers() -> dict:
    """Auth via header, not the URL query string (keeps the key out of logs)."""
    return {"content-type": "application/json", "x-goog-api-key": settings.google_key}


async def run(client: httpx.AsyncClient, media: Media, caption: str, mode: str) -> ProviderResult:
    if settings.disable_google:
        return ProviderResult(ID, NAME, Kind.VISION, Status.DISABLED,
                              summary="Disabled via DISABLE_GOOGLE.")
    if not settings.google_key:
        return ProviderResult(ID, NAME, Kind.VISION, Status.UNCONFIGURED,
                              summary="Set GOOGLE_API_KEY in .env to enable.")

    model = settings.google_model
    prompt = build_prompt(caption, media.filename, mode)
    # Key goes in the x-goog-api-key header, never the URL query string (query
    # strings get captured by access logs / proxies).
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": media.vision_mime, "data": media.vision_b64}},
            ],
        }],
        # Text-heavy images need room, and reasoning tokens count against the
        # output budget, so thinking is minimised for this structured-JSON task
        # (otherwise it eats the budget and the model returns empty text).
        "generationConfig": generation_config(model, 2048, legacy_temperature=0.2),
    }

    started = time.monotonic()
    resp = await _post_with_retries(client, url, _headers(), body)
    latency = int((time.monotonic() - started) * 1000)

    if resp.status_code >= 300:
        return ProviderResult(ID, NAME, Kind.VISION, Status.ERROR, model=model, latency_ms=latency,
                              summary=_err(resp), raw=_safe_json(resp))

    payload = resp.json()

    # A prompt-level block (safety) returns no candidates at all.
    block = (payload.get("promptFeedback") or {}).get("blockReason")
    if block:
        return ProviderResult(ID, NAME, Kind.VISION, Status.ERROR, model=model, latency_ms=latency,
                              summary=f"Gemini blocked the request (safety: {block}).",
                              raw=payload.get("promptFeedback", {}))

    candidates = payload.get("candidates") or [{}]
    finish = candidates[0].get("finishReason")
    parts = ((candidates[0].get("content") or {}).get("parts")) or []
    text = "".join(p.get("text", "") for p in parts).strip()

    if not text:
        # No text usually means truncation (MAX_TOKENS) or a candidate-level
        # safety stop. Report the actual reason so it's actionable.
        reason = {
            "MAX_TOKENS": "ran out of output tokens (raise maxOutputTokens)",
            "SAFETY": "stopped by Gemini safety filter",
            "RECITATION": "stopped for recitation",
        }.get(finish, finish or "unknown reason")
        return ProviderResult(ID, NAME, Kind.VISION, Status.ERROR, model=model, latency_ms=latency,
                              summary=f"Gemini returned no text: {reason}.",
                              raw={"finishReason": finish})

    data = extract_json(text)
    if data is None and finish == "MAX_TOKENS":
        return ProviderResult(ID, NAME, Kind.VISION, Status.ERROR, model=model, latency_ms=latency,
                              summary="Reply was cut off at the output-token ceiling before the JSON "
                                      "completed - re-run; raise the ceiling if it persists.",
                              raw={"finishReason": finish, "text": text[:2000]})
    return vision_result_from_json(provider_id=ID, name=NAME, model=model,
                                   data=data, raw_text=text, latency_ms=latency)


async def run_text(client: httpx.AsyncClient, text: str, caption: str, mode: str) -> ProviderResult:
    if settings.disable_google:
        return ProviderResult(ID, NAME, Kind.VISION, Status.DISABLED, summary="Disabled via DISABLE_GOOGLE.")
    if not settings.google_key:
        return ProviderResult(ID, NAME, Kind.VISION, Status.UNCONFIGURED,
                              summary="Set GOOGLE_API_KEY in .env to enable.")
    model = settings.google_model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {
        "contents": [{"role": "user", "parts": [{"text": build_text_prompt(text, caption, mode)}]}],
        "generationConfig": generation_config(model, 4096, legacy_temperature=0.2),
    }
    started = time.monotonic()
    resp = await _post_with_retries(client, url, _headers(), body)
    latency = int((time.monotonic() - started) * 1000)
    if resp.status_code >= 300:
        return ProviderResult(ID, NAME.replace(" Vision", " Analysis"), Kind.TEXT, Status.ERROR,
                              model=model, latency_ms=latency,
                              summary=_err(resp), raw=_safe_json(resp))
    payload = resp.json()
    candidates = payload.get("candidates") or [{}]
    finish = candidates[0].get("finishReason")
    parts = ((candidates[0].get("content") or {}).get("parts")) or []
    out = "".join(p.get("text", "") for p in parts).strip()
    text_name = NAME.replace(" Vision", " Analysis")
    if not out:
        return ProviderResult(ID, text_name, Kind.TEXT, Status.ERROR, model=model, latency_ms=latency,
                              summary=f"Gemini returned no text for the transcript ({finish or 'unknown reason'}).")
    data = extract_json(out)
    if data is None and finish == "MAX_TOKENS":
        return ProviderResult(ID, text_name, Kind.TEXT, Status.ERROR, model=model, latency_ms=latency,
                              summary="Reply was cut off at the output-token ceiling before the JSON "
                                      "completed - re-run; raise the ceiling if it persists.",
                              raw={"finishReason": finish, "text": out[:2000]})
    return text_result_from_json(provider_id=ID, name=NAME, model=model,
                                 data=data, raw_text=out, latency_ms=latency)


async def _post_with_retries(client, url, headers, body):
    last = None
    for _ in range(settings.provider_retries + 1):
        try:
            return await client.post(url, headers=headers, json=body)
        except httpx.HTTPError as exc:
            last = exc
    raise last


def _safe_json(resp) -> dict:
    try:
        return resp.json()
    except Exception:
        return {"text": resp.text[:1000]}


def _err(resp) -> str:
    data = _safe_json(resp)
    err = data.get("error")
    if isinstance(err, dict) and err.get("message"):
        return f"{resp.status_code}: {err['message']}"
    return f"{resp.status_code}: request failed"
