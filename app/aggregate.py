"""Agreement-and-override verdict logic.

The verdict is driven by AGREEMENT across separate signals, never a weighted
mean of scores. A single confident model cannot swing the verdict on its own:
it needs another model to corroborate it. Statistical independence is not assumed.

Hierarchy of signals:
  - Provenance (C2PA) and watermark (SynthID) act as OVERRIDES. A confirmed
    AI-generation assertion or a detected watermark dominates. Absence of either
    is reported as "no provenance found", never as evidence of authenticity.
  - Vision models are the deciding interpretive signals, but only by agreement
    between explicit verdicts whose ratings meet the corresponding threshold.
  - Local forensic cues are SUPPORTING only; they corroborate, they never decide.

Every verdict carries a decision trace (which signals agreed, dissented, or
triggered an override) and two explicit lists: evidence that supports the
verdict, and signals that did not change it.

Guided second opinions (the researcher-pasted second_opinion_* fields on the
report, including their fresh-session attestations) sit entirely outside this
module by construction: aggregate() and aggregate_frames() consume only
ProviderResult rows built from the six providers, and no second-opinion field
is ever converted into one. Second opinions are triage cues for a human and
can never decide or override a verdict; the attestation is researcher-reported
provenance of a note, not evidence, and must never enter this module either.
"""
from __future__ import annotations

from statistics import median

from .schema import Kind, ProviderResult, Status, Verdict

# Directional votes require both an explicit verdict and a matching rating.
# Inconclusive replies retain their scores but cannot supply directional votes.
SYNTH_VOTE = 60
AUTH_VOTE = 30

DISCLAIMER = "Research assessment. Review alongside source information and context."

_VAX_RISK = [
    "vaccine", "vaccines", "jab", "mrna", "booster", "side effect", "injury",
    "sudden death", "autism", "fertility", "infertility", "myocarditis",
    "measles", "covid", "immune", "mandate", "pharma", "pfizer", "moderna",
]
_VAX_TARGET = ["children", "parents", "pregnant", "mothers", "community",
               "minority", "deprived", "doctors", "nhs"]

_SYNTH_SIDE = (Verdict.SYNTHETIC_LIKELY, Verdict.PARTIALLY_SYNTHETIC)


def _vision_vote(result: ProviderResult) -> Verdict | None:
    """Keep explicit uncertainty and conflicting verdict/score pairs undecided."""
    if result.status != Status.OK or result.rating is None:
        return None
    if result.verdict == Verdict.AUTHENTIC_LIKELY and result.rating <= AUTH_VOTE:
        return Verdict.AUTHENTIC_LIKELY
    if result.verdict in _SYNTH_SIDE and result.rating >= SYNTH_VOTE:
        return Verdict.SYNTHETIC_LIKELY
    if (result.verdict == Verdict.PARTIALLY_SYNTHETIC
            and AUTH_VOTE < result.rating < SYNTH_VOTE):
        return Verdict.PARTIALLY_SYNTHETIC
    return None


# ── Public API ────────────────────────────────────────────────────────────────
def aggregate(results: list[ProviderResult], caption: str, mode: str) -> dict:
    """Verdict for a single item (one image, or one frame of a document)."""
    by_id = {r.id: r for r in results}
    vision = _ok_vision(results)
    c2pa = by_id.get("c2pa")
    synthid = by_id.get("synthid")
    forensic = by_id.get("local")

    trace: list[dict] = []
    verdict, confidence, rating, agreement, explanation = _decide(vision, c2pa, synthid, forensic, trace)
    trace.append({"step": "verdict", "value": verdict.value, "confidence": confidence, "reason": explanation})

    supporting, not_decisive = _evidence_lists(verdict, vision, c2pa, synthid, forensic)
    return _bundle(results, caption, mode, verdict, confidence, rating, agreement,
                   explanation, trace, supporting, not_decisive)


def aggregate_frames(frame_consensuses: list[dict], provider_rows: list[ProviderResult],
                     caption: str, mode: str) -> dict:
    """Document-level verdict for a multi-frame item (PDF / PPTX / video).

    Derived from per-frame agreement: when frames disagree materially the item is
    flagged for human review rather than collapsed into one confident number.
    """
    verdicts = [Verdict(fc["overall_verdict"]) for fc in frame_consensuses]
    ratings = [fc["overall_rating"] for fc in frame_consensuses if fc["overall_rating"] is not None]
    synth = [v for v in verdicts if v in _SYNTH_SIDE]
    auth = [v for v in verdicts if v == Verdict.AUTHENTIC_LIKELY]
    spread = (max(ratings) - min(ratings)) if ratings else 0
    total = len(frame_consensuses)

    trace: list[dict] = [{
        "step": "frame_agreement", "frames": total,
        "synthetic_frames": len(synth), "authentic_frames": len(auth),
        "rating_spread": spread,
    }]

    if synth and auth:
        verdict, confidence, agreement = Verdict.INCONCLUSIVE, "low", "frames disagree"
        explanation = (f"Frames disagree ({len(synth)} read synthetic, {len(auth)} read authentic). "
                       "The per-frame breakdown shows where the assessments differ.")
    elif synth and len(synth) > total / 2:
        verdict = (Verdict.SYNTHETIC_LIKELY
                   if verdicts.count(Verdict.SYNTHETIC_LIKELY) > total / 2
                   else Verdict.PARTIALLY_SYNTHETIC)
        confidence = "medium" if spread <= 30 else "low"
        agreement, explanation = "frames mostly synthetic", f"{len(synth)} of {total} frames read as synthetic or edited."
    elif len(auth) > total / 2 and not synth:
        verdict, confidence, agreement = Verdict.AUTHENTIC_LIKELY, ("medium" if spread <= 30 else "low"), "frames authentic"
        # Say how many frames were decisive out of ALL analysed - "all 2 frames"
        # under four visible chips reads as a miscount.
        if len(auth) == total:
            explanation = f"All {total} frames lean authentic. Review the original source and context alongside this result."
        else:
            explanation = (f"{len(auth)} of {total} frames returned a decisive read, all leaning "
                           f"authentic; the other {total - len(auth)} stayed inconclusive. Review the original source and context alongside this result.")
    else:
        verdict, confidence, agreement = Verdict.INCONCLUSIVE, "low", "frames inconclusive"
        explanation = "The sampled frames leave the assessment inconclusive. Review the frame results and source context."

    trace.append({"step": "verdict", "value": verdict.value, "confidence": confidence, "reason": explanation})

    pv = _ok_vision(provider_rows)
    pby = {r.id: r for r in provider_rows}
    supporting, not_decisive = _evidence_lists(verdict, pv, pby.get("c2pa"), pby.get("synthid"), pby.get("local"))
    rating = round(sum(ratings) / len(ratings)) if ratings else None
    return _bundle(provider_rows, caption, mode, verdict, confidence, rating, agreement,
                   explanation, trace, supporting, not_decisive,
                   score_basis="mean_frame_ratings" if ratings else "not_scored")


# ── Decision engine ───────────────────────────────────────────────────────────
def _decide(vision, c2pa, synthid, forensic, trace):
    # 1. Overrides: cryptographic provenance / watermark dominate.
    ov = _override(c2pa, synthid)
    if ov:
        verdict, rating, detail = ov
        trace.append({"step": "override", "outcome": verdict.value, "detail": detail})
        return verdict, "high", rating, "provenance override", \
            f"{detail} A confirmed provenance or watermark signal overrides interpretive models."
    trace.append({"step": "override", "outcome": "none",
                  "detail": "No confirmed C2PA AI assertion or SynthID watermark. "
                            "Origin remains unresolved by these checks."})

    # 2. Agreement among separate models, without a statistical independence claim.
    synth = [v for v in vision if _vision_vote(v) == Verdict.SYNTHETIC_LIKELY]
    auth = [v for v in vision if _vision_vote(v) == Verdict.AUTHENTIC_LIKELY]
    partial = [v for v in vision if _vision_vote(v) == Verdict.PARTIALLY_SYNTHETIC]
    uncertain = [v for v in vision if _vision_vote(v) not in
                 (Verdict.SYNTHETIC_LIKELY, Verdict.AUTHENTIC_LIKELY)]
    fsynth = bool(forensic and forensic.status == Status.OK and forensic.rating is not None
                  and forensic.rating >= SYNTH_VOTE)
    n = len(vision)
    rating = _indicative_rating(vision)

    trace.append({"step": "model_agreement",
                  "synthetic": [v.name for v in synth], "authentic": [v.name for v in auth],
                  "uncertain": [v.name for v in uncertain], "forensic_supports_synthetic": fsynth})

    if n == 0:
        return Verdict.INCONCLUSIVE, "low", rating, "no models", \
            "No vision model returned a usable result. Check provider status in the table."
    if n == 1:
        only = vision[0]
        return Verdict.INCONCLUSIVE, "low", rating, "single model", \
            f"One usable model result was returned, from {only.name}. A corroborated panel result is unavailable for this run."

    # n >= 2
    if len(synth) >= 2:
        confidence = "high" if (fsynth or len(synth) >= 3) else "medium"
        return Verdict.SYNTHETIC_LIKELY, confidence, rating, "models agree", \
            (f"{len(synth)} models agree this is likely synthetic"
             + (", corroborated by local forensics" if fsynth else "") + ".")
    if len(synth) == 1:
        return Verdict.INCONCLUSIVE, "low", rating, "models disagree", \
            (f"{synth[0].name} leans synthetic; the other available models returned different assessments. "
             "Review the model findings and source context together.")
    if len(auth) >= 2 and not synth:
        return Verdict.AUTHENTIC_LIKELY, "medium", rating, "models agree", \
            (f"{len(auth)} models lean authentic with matching verdicts and ratings. "
             "Review the other findings, original source and context alongside this result.")
    if len(partial) >= 2 and not synth:
        return Verdict.PARTIALLY_SYNTHETIC, "low", rating, "models uncertain", \
            "The model assessments suggest ambiguous or possibly edited imagery."
    return Verdict.INCONCLUSIVE, "low", rating, "mixed", \
        "The available assessments are mixed or weak. Review the findings and source context together."


def _trusted_provenance(result):
    if not result or result.status != Status.OK or not isinstance(result.raw, dict):
        return False
    validation = result.raw.get("validation")
    return (isinstance(validation, dict) and validation.get("complete") is True
            and validation.get("policy_approved") is True
            and validation.get("integrity") == "valid" and validation.get("trust") == "trusted"
            and validation.get("failure_codes") == [])


def _override(c2pa, synthid):
    if _trusted_provenance(c2pa):
        if c2pa.verdict == Verdict.SYNTHETIC_LIKELY:
            return Verdict.SYNTHETIC_LIKELY, None, "Validated, trusted C2PA manifest declares AI-generated content."
        if c2pa.verdict == Verdict.PARTIALLY_SYNTHETIC:
            return Verdict.PARTIALLY_SYNTHETIC, None, "Validated, trusted C2PA manifest declares AI-composited content."
        # A signed camera capture does not establish authenticity of the scene.
    if synthid and synthid.status == Status.OK and synthid.rating is not None and synthid.rating >= SYNTH_VOTE:
        return Verdict.SYNTHETIC_LIKELY, synthid.rating, "SynthID watermark detected."
    return None


# ── Evidence lists ────────────────────────────────────────────────────────────
def _evidence_lists(verdict, vision, c2pa, synthid, forensic):
    supporting: list[dict] = []
    not_decisive: list[dict] = []
    synth_side = verdict in _SYNTH_SIDE
    auth_side = verdict == Verdict.AUTHENTIC_LIKELY

    def aligns(r):
        if r.id == "c2pa":
            return _trusted_provenance(r) and synth_side and r.verdict in _SYNTH_SIDE
        if r.kind in (Kind.VISION, Kind.TEXT):
            vote = _vision_vote(r)
            if verdict == Verdict.PARTIALLY_SYNTHETIC:
                return vote in _SYNTH_SIDE
            if synth_side:
                return vote == Verdict.SYNTHETIC_LIKELY
            if auth_side:
                return vote == Verdict.AUTHENTIC_LIKELY
            return False
        if synth_side:
            return r.rating is not None and r.rating >= SYNTH_VOTE
        if auth_side:
            return r.rating is not None and r.rating <= AUTH_VOTE
        return False

    for v in vision:
        (supporting if aligns(v) else not_decisive).append(_entry(v))

    if forensic and forensic.status == Status.OK and forensic.rating is not None:
        e = _entry(forensic)
        e["note"] = "Supporting observation; considered alongside the model assessments."
        (supporting if aligns(forensic) else not_decisive).append(e)

    _provenance_entry(c2pa, "C2PA Content Credentials", aligns, supporting, not_decisive,
                      absent_note="Embedded credentials: none found. Origin remains unresolved by this check.")
    _provenance_entry(synthid, "Google SynthID", aligns, supporting, not_decisive,
                      absent_note="SynthID watermark not checked; a result is unavailable for this run.")
    return supporting, not_decisive


def _provenance_entry(sig, name, aligns, supporting, not_decisive, absent_note):
    if sig is None:
        return
    if sig.id == "c2pa":
        (supporting if aligns(sig) else not_decisive).append(_entry(sig))
    elif sig.status == Status.OK and sig.rating is not None:
        (supporting if aligns(sig) else not_decisive).append(_entry(sig))
    elif sig.verdict == Verdict.NOT_APPLICABLE:
        not_decisive.append({"name": sig.name or name, "rating": None,
                             "verdict": "not_applicable", "note": sig.summary or "Not applicable."})
    else:
        note = absent_note if sig.status in (Status.OK, Status.PENDING) else f"{name} unavailable ({sig.status.value})."
        not_decisive.append({"name": sig.name or name, "rating": None,
                             "verdict": "inconclusive", "note": note})


# ── Helpers ───────────────────────────────────────────────────────────────────
def _bundle(results, caption, mode, verdict, confidence, rating, agreement,
            explanation, trace, supporting, not_decisive, score_basis=None):
    return {
        "overall_rating": rating,
        "score_basis": score_basis or (
            "provenance_declaration" if agreement == "provenance override" and rating is None
            else "not_scored" if rating is None else "median_model_ratings"),
        "overall_verdict": verdict.value,
        "confidence": confidence,
        "headline": _headline(verdict),
        "explanation": explanation,
        "agreement": agreement,
        "decision_trace": trace,
        "supporting": supporting,
        "not_decisive": not_decisive,
        "visible_text": _merge_visible_text(results),
        "vaccine_codes": _vaccine_codes(results, caption, mode),
        "disclaimer": DISCLAIMER,
    }


def _ok_vision(results):
    return [r for r in results if r.kind in (Kind.VISION, Kind.TEXT) and r.status == Status.OK and r.rating is not None]


def _entry(r):
    return {"name": r.name, "rating": r.rating, "verdict": r.verdict.value,
            "note": r.summary or ""}


def _indicative_rating(vision):
    return round(median(v.rating for v in vision)) if vision else None


def _band(rating):
    if rating is None:
        return Verdict.INCONCLUSIVE
    if rating >= SYNTH_VOTE:
        return Verdict.SYNTHETIC_LIKELY
    if rating <= AUTH_VOTE:
        return Verdict.AUTHENTIC_LIKELY
    if rating >= 40:
        return Verdict.PARTIALLY_SYNTHETIC
    return Verdict.INCONCLUSIVE


def _headline(verdict):
    return {
        Verdict.SYNTHETIC_LIKELY: "Leaning synthetic",
        Verdict.PARTIALLY_SYNTHETIC: "Possibly AI-edited",
        Verdict.AUTHENTIC_LIKELY: "Leaning authentic",
        Verdict.INCONCLUSIVE: "Inconclusive",
        Verdict.NOT_APPLICABLE: "Not applicable",
    }[verdict]


def _merge_visible_text(results):
    texts = [r.visible_text for r in results if r.visible_text]
    return max(texts, key=len) if texts else ""


def _vaccine_codes(results, caption, mode):
    if mode != "vaccine":
        return []
    blob = " ".join(filter(None, [caption] + [r.vaccine_relevance for r in results])).lower()
    codes = []
    if any(t in blob for t in _VAX_RISK):
        codes.append("health-risk framing")
    if any(t in blob for t in _VAX_TARGET):
        codes.append("community targeting cue")
    if any(w in blob for w in ("cover-up", "cover up", "hidden truth", "censored", "wake up", "they don't want")):
        codes.append("conspiracy framing")
    if any(w in blob for w in ("natural immunity", "detox", "big pharma", "alternative cure")):
        codes.append("medical authority challenge")
    if any(w in blob for w in ("children", "pregnant", "fertility", "autism", "measles")):
        codes.append("vulnerable audience cue")
    return codes
