"""Helpers shared across vision providers."""
from __future__ import annotations

from typing import Optional

from ..schema import Kind, ProviderResult, Status, Verdict, verdict_from_rating

_VALID_VERDICTS = {v.value for v in Verdict}


def vision_result_from_json(
    *,
    provider_id: str,
    name: str,
    model: str,
    data: Optional[dict],
    raw_text: str,
    latency_ms: int,
) -> ProviderResult:
    """Turn a parsed vision-model JSON object into the normalized result."""
    if not data:
        return ProviderResult(
            id=provider_id,
            name=name,
            kind=Kind.VISION,
            status=Status.ERROR,
            model=model,
            summary="Model replied but no valid JSON could be parsed.",
            evidence=[],
            raw={"text": raw_text[:2000]},
            latency_ms=latency_ms,
        )

    rating = data.get("synthetic_rating")
    try:
        rating = max(0, min(100, int(round(float(rating)))))
    except (TypeError, ValueError):
        rating = None

    verdict_raw = str(data.get("verdict", "")).strip().lower()
    verdict = Verdict(verdict_raw) if verdict_raw in _VALID_VERDICTS else verdict_from_rating(rating)

    tells = data.get("tells") or []
    if isinstance(tells, str):
        tells = [tells]
    tells = [str(t) for t in tells if str(t).strip()]

    if data.get("partially_synthetic") and verdict == Verdict.SYNTHETIC_LIKELY:
        # Keep the model's explicit "partial" signal visible - hedged: whether
        # the base image is genuinely photographic is itself only a model read.
        tells.insert(0, "model read this as AI editing over a photographic base image")

    visible = (data.get("visible_text") or "").strip() or None
    vax = (data.get("vaccine_misinformation_relevance") or "").strip() or None
    caveat = (data.get("caveat") or "").strip()

    summary_bits = []
    if rating is not None:
        summary_bits.append(f"synthetic likelihood {rating}/100")
    if tells:
        summary_bits.append("tells: " + ", ".join(tells[:4]))
    summary = "; ".join(summary_bits) or "No structured signal returned."

    evidence = list(tells)
    if caveat:
        evidence.append(f"caveat: {caveat}")

    return ProviderResult(
        id=provider_id,
        name=name,
        kind=Kind.VISION,
        status=Status.OK,
        rating=rating,
        verdict=verdict,
        confidence=str(data.get("confidence")).lower() if data.get("confidence") else None,
        summary=summary,
        evidence=evidence,
        visible_text=visible,
        vaccine_relevance=vax,
        model=model,
        latency_ms=latency_ms,
        raw=data,
    )


def text_result_from_json(
    *,
    provider_id: str,
    name: str,
    model: str,
    data: Optional[dict],
    raw_text: str,
    latency_ms: int,
) -> ProviderResult:
    """Map a text content-analysis JSON object to the normalized result.
    Here `rating` carries AI-authorship likelihood."""
    if not data:
        return ProviderResult(provider_id, name.replace(" Vision", " Analysis"),
                              Kind.TEXT, Status.ERROR, model=model,
                              summary="Model replied but no valid JSON could be parsed.",
                              raw={"text": raw_text[:2000]}, latency_ms=latency_ms)

    def _int(key):
        try:
            return max(0, min(100, int(round(float(data.get(key))))))
        except (TypeError, ValueError):
            return None

    ai_rating = _int("ai_authorship_rating")
    claims = data.get("claims") or []
    if isinstance(claims, str):
        claims = [claims]
    claims = [str(c) for c in claims if str(c).strip()]

    evidence = []
    if data.get("framing"):
        evidence.append(f"synthetic origin framing: {data['framing']}")
    if claims:
        evidence.append("Summary (content, for the researcher's coding):")
        evidence.extend(str(c) for c in claims[:4])
    if data.get("caveat"):
        evidence.append(f"caveat: {data['caveat']}")

    return ProviderResult(
        id=provider_id, name=name.replace(" Vision", " Analysis"),
        kind=Kind.TEXT, status=Status.OK,
        rating=ai_rating, verdict=verdict_from_rating(ai_rating),
        confidence=str(data.get("confidence")).lower() if data.get("confidence") else None,
        summary=data.get("summary") or "Text content analysed.",
        evidence=evidence,
        vaccine_relevance=(data.get("vaccine_misinformation_relevance") or "").strip() or None,
        model=model, latency_ms=latency_ms, raw=data,
    )
