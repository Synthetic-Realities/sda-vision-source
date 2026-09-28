"""Shared structured-JSON prompt used by all three vision models.

Identical wording per model keeps the table a fair side-by-side comparison.
"""
from __future__ import annotations

import json
import re

VISION_JSON_INSTRUCTION = (
    "You are SDA Vision, a provenance-aware visual-forensics assistant for "
    "synthetic-media research. You assess SYNTHETIC ORIGIN only - whether the "
    "image was AI-generated or AI-edited - never whether its content is true, "
    "misleading or harmful; that judgement belongs to a human researcher. The "
    "subject matter (including health or misinformation topics) must not "
    "influence the rating in either direction. Inspect the image and respond "
    "with ONLY a single JSON object (no prose, no markdown fences) with exactly "
    "these keys:\n"
    '  "synthetic_rating": integer 0-100 (0 = clearly a real camera photo, '
    "100 = clearly fully AI-generated),\n"
    '  "verdict": one of "authentic_likely" | "partially_synthetic" | '
    '"synthetic_likely" | "inconclusive",\n'
    '  "confidence": one of "low" | "medium" | "high",\n'
    '  "tells": array of short strings naming the SPECIFIC visual evidence you '
    "used (e.g. malformed hands, impossible reflections, plastic skin, "
    "compression-consistent grain, natural lens blur),\n"
    '  "partially_synthetic": boolean (true if real base photo appears AI-edited '
    "/ composited / inpainted rather than fully generated),\n"
    '  "visible_text": string transcribing any text in the image verbatim, or "",\n'
    '  "vaccine_misinformation_relevance": short string describing any vaccine / '
    "health-misinformation framing, claims, or symbolism, or \"\",\n"
    '  "caveat": short string with the main reason a human should double-check.\n'
    "Do not claim forensic certainty. Your output is interpretive evidence for "
    "human review, not a verdict of fact."
)


def build_prompt(caption: str, filename: str, mode: str) -> str:
    lens = (
        "Pay particular attention to vaccine / public-health misinformation "
        "framing, medical authority challenges, and targeting of vulnerable "
        "audiences."
        if mode == "vaccine"
        else "Analyse general synthetic-media and provenance signals."
    )
    return (
        f"{VISION_JSON_INSTRUCTION}\n\n{lens}\n\n"
        f"Filename: {filename or 'unknown'}\n"
        f"Researcher caption/context: {caption or 'none supplied'}"
    )


TEXT_JSON_INSTRUCTION = (
    "You are SDA Vision, analysing a transcript / document text for "
    "synthetic-media research. You assess SYNTHETIC ORIGIN only - the "
    "likelihood the text was AI-generated or AI-edited - never whether its "
    "content is true, misleading or harmful; that judgement belongs to a human "
    "researcher. The topic must not influence the rating in either direction: "
    "a text ABOUT misinformation (for example a researcher's analysis of "
    "vaccine misinformation) is not itself misinformation, and claims you "
    "disagree with are not evidence of AI authorship. Respond with ONLY a "
    "single JSON object (no prose, no fences) with exactly these keys:\n"
    '  "ai_authorship_rating": integer 0-100 (likelihood of synthetic origin, '
    "judged on style and structure - phrasing patterns, formulaic build, "
    "template-like transitions; be conservative, this is hard to judge),\n"
    '  "claims": array of short strings (each under about 20 words) neutrally listing the key factual '
    "claims made (descriptive notes for the researcher, not an evaluation),\n"
    '  "framing": short string neutrally describing the rhetorical framing,\n'
    '  "vaccine_misinformation_relevance": short string, or "",\n'
    '  "confidence": one of "low" | "medium" | "high",\n'
    '  "summary": one-sentence summary of the ORIGIN assessment,\n'
    '  "caveat": short string with the main reason a human should double-check.\n'
    "Keep the whole JSON compact. Do not state facts as settled; this is interpretive "
    "evidence for human review."
)


def build_text_prompt(text: str, caption: str, mode: str) -> str:
    lens = (
        "For the researcher's content coding, neutrally describe any vaccine / "
        "public-health framing, authority claims and checkable claims in "
        "vaccine_misinformation_relevance - describe, never adjudicate truth."
        if mode == "vaccine"
        else 'Assess synthetic origin only; leave vaccine_misinformation_relevance as "".'
    )
    snippet = text[:12000]
    return (
        f"{TEXT_JSON_INSTRUCTION}\n\n{lens}\n\n"
        f"Researcher caption/context: {caption or 'none supplied'}\n\n"
        f"--- TEXT START ---\n{snippet}\n--- TEXT END ---"
    )


def extract_json(text: str) -> dict | None:
    """Best-effort JSON extraction from a model response."""
    if not text:
        return None
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    # Fall back to the first balanced {...} block.
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except Exception:
            return None
    return None
