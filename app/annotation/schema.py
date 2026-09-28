"""Pointer and check-record schemas with structural validators.

The validators are structural by agreed decision: they reject forbidden
fields, unknown fields, missing fields, non-string values, and malformed
dates. The no-verdict-language rule for free text is enforced by the
annotation prompt and by human review; a verdict-language classifier inside
the lane would itself be a scoring judgement inside the one component that
must never score.

Two layers, and only the first is a guarantee:
- HARD: assembly in lane.py lifts exactly six declared fields and only plain
  strings (everything else fails validation and the emission is dropped), so
  structured verdict freight cannot reach a stored pointer.
- HYGIENE: the forbidden-key scan below drops emissions that carry verdict-ish
  keys anywhere, matching normalised key names by substring against the term
  list. Keyword lists are never complete; this layer exists to refuse obvious
  freight, and the allowlist above is what makes the contract hold.
"""
from __future__ import annotations

import re
from datetime import datetime

# A no-egress lane cannot know referent-side provenance without fetching the
# referent, which is forbidden; fabricated dates would be worse than a
# disclosed gap. Where a value is genuinely unknown at emission the model must
# use this exact sentinel, and the human's check record carries the actual
# referent identity consulted.
UNKNOWN_SENTINEL = "unknown at emission; record when consulted"

# Spec section 6.3, verbatim. No other fields are permitted.
POINTER_FIELDS = frozenset({
    "pointer_id", "artefact_ref", "observation", "verification_action",
    "referent_source", "referent_capture_date", "referent_authority",
    "referent_version", "emitted_by", "panel_version", "prompt_version",
    "emitted_at",
})

# Spec section 6.6, verbatim.
CHECK_FIELDS = frozenset({
    "pointer_id", "checked_by", "checked_at", "outcome",
    "referent_consulted", "note",
})

CHECK_OUTCOMES = frozenset({"verified", "not_verified", "inconclusive"})

# Verdict-ish terms. Matched as substrings of normalised key names at every
# nesting level; none of the allowed field names above contains any of them.
FORBIDDEN_FIELDS = frozenset({
    "verdict", "probability", "confidence", "accuracy", "score", "rating",
    "likelihood", "assessment", "conclusion", "authenticity", "certainty",
    "judgement", "judgment",
})

_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _norm_key(k) -> str:
    """Lowercase and strip every non [a-z0-9_] character, so zero-width and
    homoglyph padding cannot hide a term from the substring match."""
    return re.sub(r"[^a-z0-9_]", "", str(k).lower())


def _forbidden_keys(obj, path: str = "") -> list[str]:
    """Walk nested dicts/lists and name every verdict-ish key found."""
    hits: list[str] = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            where = f"{path}.{k}" if path else str(k)
            nk = _norm_key(k)
            if any(term in nk for term in FORBIDDEN_FIELDS):
                hits.append(where)
            hits.extend(_forbidden_keys(v, where))
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            hits.extend(_forbidden_keys(item, f"{path}[{i}]"))
    return hits


def _iso_timestamp(v: str) -> bool:
    try:
        datetime.fromisoformat(v)
        return True
    except (TypeError, ValueError):
        return False


def _validate(obj: dict, allowed: frozenset, label: str) -> list[str]:
    errors: list[str] = []
    if not isinstance(obj, dict):
        return [f"{label} must be an object"]
    errors += [f"forbidden field: {w}" for w in _forbidden_keys(obj)]
    for k in obj:
        if k not in allowed:
            errors.append(f"unknown field: {k}")
    for k in allowed:
        v = obj.get(k)
        if v is None or (isinstance(v, str) and not v.strip()):
            errors.append(f"missing or empty field: {k}")
        elif not isinstance(v, str):
            errors.append(f"field must be a string: {k}")
    return errors


def validate_pointer(pointer: dict) -> list[str]:
    """Empty list = valid. Every referent provenance field and every version
    field is required (spec 6.5): a pointer that names a referent without its
    provenance invites checking a fabrication against a corrupted oracle.
    The capture date must be an ISO date or the exact disclosed-unknown
    sentinel, so an invented 'sometime in 2023' can never pass as provenance."""
    errors = _validate(pointer, POINTER_FIELDS, "pointer")
    if not errors:
        d = pointer["referent_capture_date"]
        if d != UNKNOWN_SENTINEL and not _ISO_DATE.match(d):
            errors.append("referent_capture_date must be YYYY-MM-DD or the exact "
                          f'sentinel "{UNKNOWN_SENTINEL}"')
        if not _iso_timestamp(pointer["emitted_at"]):
            errors.append("emitted_at must be an ISO timestamp")
    return errors


def validate_check(check: dict) -> list[str]:
    errors = _validate(check, CHECK_FIELDS, "check")
    if not errors:
        if check["outcome"] not in CHECK_OUTCOMES:
            errors.append(f"outcome must be exactly one of {sorted(CHECK_OUTCOMES)}")
        if not _iso_timestamp(check["checked_at"]):
            errors.append("checked_at must be an ISO timestamp")
    return errors
