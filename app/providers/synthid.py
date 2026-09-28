"""Google SynthID / AI Content Detection provider.

The SynthID Detector API is gated (you are on the waitlist). Until an endpoint
and token are configured this returns a clean "pending" row rather than a fake
result. When SYNTHID_ENDPOINT + SYNTHID_ACCESS_TOKEN are set, it POSTs the image
and maps the returned probability to the table.
"""
from __future__ import annotations

import time

import httpx

from ..config import settings
from ..media import Media
from ..schema import Kind, ProviderResult, Status, Verdict, verdict_from_rating

ID = "synthid"
NAME = "Google SynthID"


async def run(client: httpx.AsyncClient, media: Media) -> ProviderResult:
    if not (settings.synthid_endpoint and settings.synthid_token):
        return ProviderResult(
            ID, NAME, Kind.WATERMARK, Status.PENDING,
            summary="Awaiting SynthID Detector access. Set SYNTHID_ENDPOINT + "
                    "SYNTHID_ACCESS_TOKEN in .env once granted.",
            evidence=["No live watermark verification was run."],
        )

    started = time.monotonic()
    try:
        resp = await client.post(
            settings.synthid_endpoint,
            headers={"authorization": f"Bearer {settings.synthid_token}",
                     "content-type": "application/json"},
            json={"image": {"content": media.vision_b64}, "mimeType": media.vision_mime},
        )
    except httpx.HTTPError as exc:
        return ProviderResult(ID, NAME, Kind.WATERMARK, Status.ERROR,
                              summary=f"SynthID request failed: {exc}",
                              latency_ms=_ms(started))
    latency = _ms(started)

    if resp.status_code >= 300:
        return ProviderResult(ID, NAME, Kind.WATERMARK, Status.ERROR, latency_ms=latency,
                              summary=f"{resp.status_code}: SynthID endpoint error",
                              raw=_safe_json(resp))

    data = _safe_json(resp)
    # Endpoint shape varies; accept a few common probability fields.
    prob = (data.get("syntheticProbability") or data.get("probability")
            or data.get("score") or data.get("aiProbability"))
    if prob is None:
        return ProviderResult(ID, NAME, Kind.WATERMARK, Status.OK, verdict=Verdict.INCONCLUSIVE,
                              summary="SynthID responded but no probability field was found.",
                              raw=data, latency_ms=latency)

    rating = max(0, min(100, int(round(float(prob) * (100 if float(prob) <= 1 else 1)))))
    return ProviderResult(
        ID, NAME, Kind.WATERMARK, Status.OK,
        rating=rating, verdict=verdict_from_rating(rating), confidence="high",
        summary=f"SynthID watermark probability {rating}/100.",
        evidence=[f"Detector probability: {rating}/100"],
        raw=data, latency_ms=latency,
    )


def _safe_json(resp) -> dict:
    try:
        return resp.json()
    except Exception:
        return {"text": resp.text[:1000]}


def _ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)
