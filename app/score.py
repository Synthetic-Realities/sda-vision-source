"""Distil a researcher's pasted second-opinion note into a quick structured cue.

A cheap model (Haiku by default) reads the free text and returns a synthetic
likelihood score (0 = clearly authentic, 100 = clearly synthetic) plus a one-line
read. This is a convenience signal for sorting/colouring, never a verdict - the
human's own note remains the record. Degrades gracefully to an empty result when
no key is set or the call fails.
"""
from __future__ import annotations

import json
import re

import httpx

from .config import settings

_PROMPT = (
    "You are extracting a structured signal from a researcher's short note about whether a "
    "media file (image, audio, video or document) is AI-generated, AI-edited or authentic. Read the note and reply with ONLY a JSON "
    "object, no prose, of the form {\"score\": <integer 0-100 or null>, \"read\": \"<<=10 word "
    "summary>\"}. score = the synthetic likelihood the note implies (0 = clearly authentic, "
    "100 = clearly synthetic/AI), or null if the note gives no view. read = a terse plain-English "
    "summary of the note's bottom line. IMPORTANT: if the note says the check could not run, "
    "was refused, the tool does not accept that file type (for example a SynthID checker "
    "refusing a PDF or slide deck), or the tool was given several images at once (it checks "
    "ONE image at a time), set score to null and make the read state plainly that the check "
    "did not run and what to do (e.g. \"SynthID cannot scan PDFs; attach extracted images\" "
    "or \"SynthID checks one image at a time; re-run per frame\") - "
    "never convert a refusal into a likelihood, and never phrase it as a fault in the "
    "researcher's file. The score reflects SYNTHETIC ORIGIN only, never truthfulness: "
    "the media's topic (including discussions of misinformation) must not influence the "
    "score, and the read must describe origin (e.g. \"synthetic origin confirmed by "
    "watermark\"), not the content's credibility. Similarly, a verification-page result that only reports that NO "
    "watermark or provenance signal was found implies nothing about authenticity: score null, "
    "read like \"no provenance signal detected; absence is not authenticity\" (a note that "
    "also gives a visual/auditory judgement may still be scored on that judgement).\n\nNote:\n"
)


def _parse(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        return {"score": None, "read": ""}
    try:
        obj = json.loads(m.group(0))
    except Exception:
        return {"score": None, "read": ""}
    score = obj.get("score")
    if isinstance(score, (int, float)):
        score = max(0, min(100, int(round(score))))
    else:
        score = None
    read = str(obj.get("read") or "").strip()[:120]
    return {"score": score, "read": read}


async def score_opinion(text: str) -> dict:
    """Return {"score": int|None, "read": str} for a pasted second-opinion note."""
    text = (text or "").strip()
    if not text:
        return {"score": None, "read": ""}
    if settings.disable_anthropic or not settings.anthropic_key:
        return {"score": None, "read": ""}
    body = {
        "model": settings.anthropic_summary_model,
        "max_tokens": 200,
        "messages": [{"role": "user", "content": [{"type": "text", "text": _PROMPT + text[:4000]}]}],
    }
    headers = {
        "x-api-key": settings.anthropic_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
        if resp.status_code != 200:
            return {"score": None, "read": ""}
        data = resp.json()
        parts = data.get("content", [])
        out = "".join(p.get("text", "") for p in parts if p.get("type") == "text")
        return _parse(out)
    except Exception:
        return {"score": None, "read": ""}
