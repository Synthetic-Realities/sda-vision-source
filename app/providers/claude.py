"""Anthropic Claude vision provider."""
from __future__ import annotations

import time

import httpx

from ..config import settings
from ..media import Media
from ..schema import Kind, ProviderResult, Status
from .base import text_result_from_json, vision_result_from_json
from .prompt import build_prompt, build_text_prompt, extract_json

ID = "claude"
NAME = "Claude Vision"


def tune_request(body: dict, model: str) -> None:
    """Opus 5.5 always thinks; bound its effort and budget explicitly."""
    if model.startswith("claude-opus-5-5"):
        body["max_tokens"] = max(body.get("max_tokens", 0), 8192)
        body["output_config"] = {"effort": "low"}


async def run(client: httpx.AsyncClient, media: Media, caption: str, mode: str) -> ProviderResult:
    if settings.disable_anthropic:
        return ProviderResult(ID, NAME, Kind.VISION, Status.DISABLED,
                              summary="Disabled via DISABLE_ANTHROPIC.")
    if not settings.anthropic_key:
        return ProviderResult(ID, NAME, Kind.VISION, Status.UNCONFIGURED,
                              summary="Set ANTHROPIC_API_KEY in .env to enable.")

    model = settings.anthropic_model
    prompt = build_prompt(caption, media.filename, mode)
    body = {
        "model": model,
        "max_tokens": 1024,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image", "source": {
                    "type": "base64",
                    "media_type": media.vision_mime,
                    "data": media.vision_b64,
                }},
            ],
        }],
    }
    tune_request(body, model)
    headers = {
        "x-api-key": settings.anthropic_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    started = time.monotonic()
    resp = await _post_with_retries(client, "https://api.anthropic.com/v1/messages", headers, body)
    latency = int((time.monotonic() - started) * 1000)

    if resp.status_code >= 300:
        return ProviderResult(ID, NAME, Kind.VISION, Status.ERROR, model=model, latency_ms=latency,
                              summary=_err(resp), raw=_safe_json(resp))

    payload = resp.json()
    text = "".join(b.get("text", "") for b in payload.get("content", [])).strip()
    return vision_result_from_json(provider_id=ID, name=NAME, model=model,
                                   data=extract_json(text), raw_text=text, latency_ms=latency)


async def run_text(client: httpx.AsyncClient, text: str, caption: str, mode: str) -> ProviderResult:
    if settings.disable_anthropic:
        return ProviderResult(ID, NAME, Kind.VISION, Status.DISABLED, summary="Disabled via DISABLE_ANTHROPIC.")
    if not settings.anthropic_key:
        return ProviderResult(ID, NAME, Kind.VISION, Status.UNCONFIGURED,
                              summary="Set ANTHROPIC_API_KEY in .env to enable.")
    model = settings.anthropic_model
    body = {
        "model": model, "max_tokens": 2048,
        "messages": [{"role": "user", "content": [
            {"type": "text", "text": build_text_prompt(text, caption, mode)}]}],
    }
    tune_request(body, model)
    headers = {"x-api-key": settings.anthropic_key, "anthropic-version": "2023-06-01",
               "content-type": "application/json"}
    started = time.monotonic()
    resp = await _post_with_retries(client, "https://api.anthropic.com/v1/messages", headers, body)
    latency = int((time.monotonic() - started) * 1000)
    if resp.status_code >= 300:
        return ProviderResult(ID, NAME, Kind.VISION, Status.ERROR, model=model, latency_ms=latency,
                              summary=_err(resp), raw=_safe_json(resp))
    out = "".join(b.get("text", "") for b in resp.json().get("content", [])).strip()
    return text_result_from_json(provider_id=ID, name=NAME, model=model,
                                 data=extract_json(out), raw_text=out, latency_ms=latency)


async def _post_with_retries(client, url, headers, body):
    last = None
    for attempt in range(settings.provider_retries + 1):
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
