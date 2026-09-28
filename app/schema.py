"""The normalized result every provider returns, so the UI table is uniform."""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Optional


class Verdict(str, Enum):
    AUTHENTIC_LIKELY = "authentic_likely"
    PARTIALLY_SYNTHETIC = "partially_synthetic"
    SYNTHETIC_LIKELY = "synthetic_likely"
    INCONCLUSIVE = "inconclusive"
    NOT_APPLICABLE = "not_applicable"


class Status(str, Enum):
    OK = "ok"                    # ran and returned a usable result
    ERROR = "error"              # ran but failed (network, parse, auth)
    UNCONFIGURED = "unconfigured"  # no key / not set up
    PENDING = "pending"          # gated access not yet granted (e.g. SynthID)
    DISABLED = "disabled"        # explicitly turned off
    TIMEOUT = "timeout"          # exceeded the per-provider deadline


# Provider kinds drive how the aggregator weights each signal.
class Kind(str, Enum):
    VISION = "vision"            # interpretive LLM judgement of an image/frame
    TEXT = "analysis"            # interpretive LLM judgement of transcript/document text (modality-neutral label)
    PROVENANCE = "provenance"    # cryptographic C2PA manifest
    WATERMARK = "watermark"      # SynthID-style watermark detector
    FORENSIC = "forensic"        # local pixel/metadata heuristics


def verdict_from_rating(rating: Optional[int]) -> Verdict:
    """Map a 0-100 synthetic-likelihood score to a verdict band."""
    if rating is None:
        return Verdict.INCONCLUSIVE
    if rating >= 70:
        return Verdict.SYNTHETIC_LIKELY
    if rating >= 40:
        return Verdict.PARTIALLY_SYNTHETIC
    if rating <= 25:
        return Verdict.AUTHENTIC_LIKELY
    return Verdict.INCONCLUSIVE


@dataclass
class ProviderResult:
    id: str
    name: str
    kind: Kind
    status: Status = Status.OK
    # rating = synthetic likelihood 0 (authentic) … 100 (synthetic). None if N/A.
    rating: Optional[int] = None
    verdict: Verdict = Verdict.INCONCLUSIVE
    confidence: Optional[str] = None  # "low" | "medium" | "high"
    summary: str = ""
    evidence: list[str] = field(default_factory=list)
    visible_text: Optional[str] = None
    vaccine_relevance: Optional[str] = None
    model: Optional[str] = None
    latency_ms: int = 0
    raw: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["kind"] = self.kind.value
        d["status"] = self.status.value
        d["verdict"] = self.verdict.value
        # Presentation nicety requested for reports/exports: every evidence
        # bullet starts with a capital letter, whatever the provider returned.
        d["evidence"] = [e[0].upper() + e[1:] if e and e[0].isalpha() else e
                         for e in d.get("evidence", [])]
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "ProviderResult":
        """Rebuild a row from its to_dict() JSON (used by the deep-pass merge)."""
        return cls(
            id=d.get("id", ""), name=d.get("name", ""),
            kind=Kind(d.get("kind", Kind.VISION.value)),
            status=Status(d.get("status", Status.OK.value)),
            rating=d.get("rating"),
            verdict=Verdict(d.get("verdict", Verdict.INCONCLUSIVE.value)),
            confidence=d.get("confidence"), summary=d.get("summary", ""),
            evidence=list(d.get("evidence") or []),
            visible_text=d.get("visible_text"),
            vaccine_relevance=d.get("vaccine_relevance"),
            model=d.get("model"), latency_ms=d.get("latency_ms", 0),
            raw=dict(d.get("raw") or {}),
        )
