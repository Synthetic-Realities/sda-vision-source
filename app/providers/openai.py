"""OpenAI vision provider (chat completions, JSON mode)."""
from __future__ import annotations

import time

import httpx

from ..config import settings
from ..media import Media
from ..schema import Kind, ProviderResult, Status
from .base import text_result_from_json, vision_result_from_json
from .prompt import build_prompt, build_text_prompt, extract_json

ID = "openai"
NAME = "OpenAI Vision"


async def run(client: httpx.AsyncClient, media: Media, caption: str, mode: str) -> ProviderResult:
    if settings.disable_openai:
        return ProviderResult(ID, NAME, Kind.VISION, Status.DISABLED,
                              summary="Disabled via DISABLE_OPENAI.")
    if not settings.openai_key:
        return ProviderResult(ID, NAME, Kind.VISION, Status.UNCONFIGURED,
                              summary="Set OPENAI_API_KEY in .env to enable.")

    model = settings.openai_model
    prompt = build_prompt(caption, media.filename, mode)
    body = {
        "model": model,
        # max_completion_tokens replaced max_tokens (required by the GPT-5
        # reasoning family; also accepted by gpt-4o-era models).
        "max_completion_tokens": _completion_budget(model),
        "response_format": {"type": "json_object"},
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": media.vision_data_url}},
            ],
        }],
    }
    _tune_reasoning(body, model)
    headers = {
        "authorization": f"Bearer {settings.openai_key}",
        "content-type": "application/json",
    }

    started = time.monotonic()
    resp = await _post_with_retries(client, "https://api.openai.com/v1/chat/completions", headers, body)
    latency = int((time.monotonic() - started) * 1000)

    if resp.status_code >= 300:
        return ProviderResult(ID, NAME, Kind.VISION, Status.ERROR, model=model, latency_ms=latency,
                              summary=_err(resp), raw=_safe_json(resp))

    payload = resp.json()
    text = (((payload.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    return vision_result_from_json(provider_id=ID, name=NAME, model=model,
                                   data=extract_json(text), raw_text=text, latency_ms=latency)


async def run_text(client: httpx.AsyncClient, text: str, caption: str, mode: str) -> ProviderResult:
    if settings.disable_openai:
        return ProviderResult(ID, NAME, Kind.VISION, Status.DISABLED, summary="Disabled via DISABLE_OPENAI.")
    if not settings.openai_key:
        return ProviderResult(ID, NAME, Kind.VISION, Status.UNCONFIGURED,
                              summary="Set OPENAI_API_KEY in .env to enable.")
    model = settings.openai_model
    body = {
        "model": model, "max_completion_tokens": max(2048, _completion_budget(model)),
        "response_format": {"type": "json_object"},
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": build_text_prompt(text, caption, mode)}]}],
    }
    _tune_reasoning(body, model)
    headers = {"authorization": f"Bearer {settings.openai_key}", "content-type": "application/json"}
    started = time.monotonic()
    resp = await _post_with_retries(client, "https://api.openai.com/v1/chat/completions", headers, body)
    latency = int((time.monotonic() - started) * 1000)
    if resp.status_code >= 300:
        return ProviderResult(ID, NAME, Kind.VISION, Status.ERROR, model=model, latency_ms=latency,
                              summary=_err(resp), raw=_safe_json(resp))
    out = (((resp.json().get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    return text_result_from_json(provider_id=ID, name=NAME, model=model,
                                 data=extract_json(out), raw_text=out, latency_ms=latency)


def _completion_budget(model: str) -> int:
    """Era-selected output cap for the vision request: the documented-era
    (gpt-4o) budget of 1024 is retained so setting the earlier identifiers
    reproduces the reported configuration from the released artefact (Methods
    reproducibility appendix, section 1). The guard names the known PAST, not
    the present, so unknown future families inherit the modern default rather
    than silently dropping to the legacy cap. Immaterial at runtime either
    way: measured gpt-4o output is ~105 tokens (Grant_Batch_Costing_2026-07),
    an order of magnitude below both caps, so the guard cannot bind, truncate
    or change a result - it exists to keep the artefact consistent with the
    paper."""
    if model.startswith("gpt-6-astra"):
        return 8192  # Includes the mandatory reasoning as well as the JSON answer.
    return 1024 if model.startswith("gpt-4") else 2048


def _tune_reasoning(body: dict, model: str) -> None:
    """Use only documented effort settings; retain legacy request behaviour."""
    if model.startswith("gpt-6-astra"):
        body["reasoning_effort"] = "low"
    elif model.startswith(("gpt-5", "gpt-6-sol", "gpt-6-luna")):
        body["reasoning_effort"] = "none"


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
