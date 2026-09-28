"""Run every provider concurrently and assemble the full report.

Two execution shapes:
- Visual items (image, PDF, PPTX, video): C2PA runs once on the original file;
  vision + forensics + SynthID run on each sampled frame; per-provider results
  are aggregated across frames into one document-level row, plus a per-frame
  breakdown.
- Text items (transcripts): the three LLMs run a text content-analysis pass.

Key property preserved from before: providers run in parallel with independent
per-provider timeouts, and every provider always appears in the output.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import re
import time
from datetime import datetime, timezone
from uuid import uuid4

import httpx
import imagehash
from PIL import Image

from .aggregate import aggregate, aggregate_frames
from .audio import inspect_audio
from .config import METHOD_VERSION, PANEL_VERSION, TOOL_NAME, VERSION, settings
from .ingest import Frame, Ingested, _even_indices
from .providers import c2pa_provider, claude, gemini, local_forensics, openai, synthid
from .providers.transcribe import transcribe
from .schema import Kind, ProviderResult, Status

_VISION = (claude, openai, gemini)
_DISPLAY_ORDER = ["claude", "openai", "gemini", "synthid", "c2pa", "local"]


async def analyse(ing: Ingested, caption: str, mode: str) -> dict:
    started = time.monotonic()

    text_only = bool(ing.text and not ing.frames and ing.kind in ("text", "pdf", "pptx"))
    if text_only:
        report = await _text_report(ing.text, caption, mode)
        if ing.kind in ("pdf", "pptx"):
            ing.notes.append("Text-only analysis: extracted text was assessed. Slide/page appearance was not assessed.")
    elif ing.kind == "audio":
        report = await _analyse_audio(ing, caption, mode)
    elif ing.frames:
        report = await _analyse_frames(ing, caption, mode)
    else:
        report = _empty_report(ing)
        if ing.kind == "video":
            provenance = await _guard("c2pa", c2pa_provider.NAME, Kind.PROVENANCE,
                asyncio.to_thread(c2pa_provider.run, ing.original), settings.provider_timeout)
            report["providers"].append(provenance.to_dict())

    if ing.kind in {"video", "audio"}:
        report["audio_inspection"] = await asyncio.to_thread(inspect_audio, ing.original.raw_bytes, ing.filename)
        ing.notes.append("Audio tracks inspected locally. Soundtrack uploads require a separate optional check; AI-origin detection from sound is outside this workflow.")
        if ing.kind == "video":
            ing.notes.append("Visual assessment covers the sampled still frames. Soundtrack checks are recorded separately; continuous motion is outside this assessment.")

    report["meta"] = {
        **_identity(ing, caption, mode),
        "tool": TOOL_NAME,
        "version": VERSION,
        # Dated panel-era identifier (version gating for the reproducibility
        # appendix); meta.models still names the exact models that ran.
        "panel_version": PANEL_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "filename": ing.filename,
        "kind": ing.kind,
        "frame_count": len(ing.frames),
        "frames_found": ing.frames_found or len(ing.frames),
        "notes": ing.notes,
        "mode": mode,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
        "models": sorted({p["model"] for p in report["providers"] if p.get("model")}),
    }
    return report


# ── Deep pass: analyse the frames the capped pass skipped, then merge ─────────
async def analyse_deep(ing_full: Ingested, prior: dict, caption: str, mode: str) -> dict:
    """Second, incremental pass over a multi-frame item. Analyses ONLY the frames
    the first (capped) pass skipped — no frame is ever paid for twice — then
    recombines the per-frame consensus and the document-level provider rows over
    the full set using the same aggregation rules as a single full run.

    The prior report's frames are kept first, the new frames appended, and the
    researcher's pasted second opinions are carried over untouched.
    """
    started = time.monotonic()
    prior_frames = list(prior.get("frames") or [])
    prior_n = len(prior_frames) or prior.get("meta", {}).get("frame_count", 0)

    if ing_full.kind == "video":
        # Continuous media: the caller ingested at double density; skip any
        # timestamp (MM:SS label) the first pass already analysed.
        done = {f.get("frame") for f in prior_frames}
        remaining = [f for f in ing_full.frames if f.label not in done]
    else:
        # Finite frame sets (PDF figures/pages, PPTX images): recompute the
        # deterministic first-pass picks and analyse the complement. If the
        # recomputed picks do not line up with what pass 1 recorded (file or
        # extraction changed), fall back to a fresh full-coverage run.
        picks = set(_even_indices(len(ing_full.frames), prior_n))
        picked_labels = [ing_full.frames[i].label for i in sorted(picks)]
        if picked_labels != [f.get("frame") for f in prior_frames]:
            report = await analyse(ing_full, caption, mode)
            report["meta"]["notes"].append(
                "Deep pass could not be lined up with the earlier run (file or "
                "extraction changed), so every frame was analysed afresh.")
            _carry_researcher_fields(prior, report)
            _carry_audio_observations(prior, report, ing_full.original.raw_bytes)
            return report
        remaining = [f for i, f in enumerate(ing_full.frames) if i not in picks]

    if not remaining:
        prior.setdefault("meta", {}).setdefault("notes", []).append(
            "Deep pass requested: no additional frames to analyse.")
        return prior

    sub_ing = Ingested(ing_full.kind, ing_full.filename, ing_full.original,
                       frames=remaining, text=ing_full.text, notes=[],
                       frames_found=ing_full.frames_found)
    sub = await _analyse_frames(sub_ing, caption, mode)

    # Merge frames (initial sample first, as run) and provider rows.
    merged_frames = prior_frames + sub["frames"]
    merged_phashes = [h for h in (prior.get("phashes") or []) + sub.get("phashes", []) if h]

    prior_rows = {d["id"]: ProviderResult.from_dict(d) for d in prior.get("providers", [])}
    sub_rows = {d["id"]: ProviderResult.from_dict(d) for d in sub.get("providers", [])}
    merged: dict[str, ProviderResult] = {}
    for pid in set(prior_rows) | set(sub_rows):
        a, b = prior_rows.get(pid), sub_rows.get(pid)
        if pid == "c2pa":
            merged[pid] = b or a  # whole-container read: pass 2 re-read the same file
        elif a and b:
            merged[pid] = _merge_provider_rows(a, b, len(merged_frames))
        else:
            merged[pid] = a or b
    provider_rows = [merged[k] for k in _DISPLAY_ORDER if k in merged]

    # Document verdict over ALL frames, by the same frame-agreement rule.
    vax_caption = f"{caption} {ing_full.text or ''}".strip()
    frame_cons = [{"overall_verdict": f["verdict"], "overall_rating": f["rating"]}
                  for f in merged_frames]
    consensus = aggregate_frames(frame_cons, provider_rows, vax_caption, mode)
    if ing_full.text:
        consensus["visible_text"] = consensus.get("visible_text") or ing_full.text[:4000]

    report = {
        "consensus": consensus,
        "providers": [r.to_dict() for r in provider_rows],
        "frames": merged_frames,
        "phashes": merged_phashes,
    }
    _carry_researcher_fields(prior, report)
    if ing_full.kind == "video":
        report["audio_inspection"] = await asyncio.to_thread(inspect_audio, ing_full.original.raw_bytes, ing_full.filename)
        _carry_audio_observations(prior, report, ing_full.original.raw_bytes)
    report["meta"] = {
        **_identity(ing_full, caption, mode),
        "parent_report_id": prior.get("meta", {}).get("report_id"),
        "tool": TOOL_NAME,
        "version": VERSION,
        # Dated panel-era identifier (version gating for the reproducibility
        # appendix); meta.models still names the exact models that ran.
        "panel_version": PANEL_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "filename": ing_full.filename,
        "kind": ing_full.kind,
        "frame_count": len(merged_frames),
        "frames_found": ing_full.frames_found or len(ing_full.frames),
        "notes": list(ing_full.notes) + [
            f"Deep pass: analysed the remaining {len(remaining)} frame(s); "
            "the initial sample is listed first."],
        "mode": mode,
        "elapsed_ms": int((time.monotonic() - started) * 1000),
        "models": sorted({p["model"] for p in report["providers"] if p.get("model")}),
    }
    return report


def _identity(ing: Ingested, caption: str, mode: str) -> dict:
    return {
        "report_id": str(uuid4()),
        "input_sha256": hashlib.sha256(ing.original.raw_bytes).hexdigest(),
        "method_version": METHOD_VERSION,
        "context_sha256": context_hash(caption, mode),
        "extraction_policy": extraction_policy(),
    }


def _carry_audio_observations(prior: dict, report: dict, original: bytes) -> None:
    digest = hashlib.sha256(original).hexdigest()
    for key in ("audio_assessment", "suno_check"):
        value = prior.get(key)
        if isinstance(value, dict) and value.get("input_sha256") == digest:
            report[key] = value


def context_hash(caption: str, mode: str) -> str:
    value = json.dumps({"caption": caption, "mode": mode}, sort_keys=True).encode()
    return hashlib.sha256(value).hexdigest()


def extraction_policy() -> dict:
    return {"pdf_mode": settings.pdf_mode, "min_figure_px": settings.min_figure_px}


def _carry_researcher_fields(prior: dict, report: dict) -> None:
    """Researcher-held fields survive the merge: pasted second opinions (with
    their distilled scores and fresh-session attestations) and annotation-lane
    pointers and check records. The prefix tuple is load-bearing: a researcher
    field outside it is silently dropped on every deep pass."""
    for k, v in prior.items():
        if k.startswith(("second_opinion", "annotation")):
            report[k] = v


def _merge_provider_rows(a: ProviderResult, b: ProviderResult, total: int) -> ProviderResult:
    """Combine one provider's document-level rows from the two passes, keeping
    the most-synthetic frame as representative (the same rule _aggregate_frames
    applies within a single pass)."""
    ok = [r for r in (a, b) if r.status == Status.OK and r.rating is not None]
    if not ok:
        return b  # same status either side (e.g. unconfigured/disabled)
    if len(ok) == 1:
        return ok[0]

    rep = max(ok, key=lambda r: r.rating)
    per_frame = _per_frame_of(a) + _per_frame_of(b)
    frame_lines = [f"frame {p['frame']}: {p['rating']}/100"
                   for p in per_frame if p.get("rating") is not None]
    core = re.sub(r"^Worst of \d+ frames \([^)]*\): ", "", rep.summary)
    rep_label = (rep.raw or {}).get("representative") or \
        (_per_frame_of(rep)[0]["frame"] if _per_frame_of(rep) else "frame")
    tail = [e for e in rep.evidence if not re.match(r"^frame .+: \d+/100$", e, re.IGNORECASE)]
    return ProviderResult(
        id=rep.id, name=rep.name, kind=rep.kind, status=rep.status,
        rating=rep.rating, verdict=rep.verdict, confidence=rep.confidence,
        summary=f"Worst of {total} frames ({rep_label}): {core}",
        evidence=frame_lines + tail,
        visible_text=_longest([a.visible_text, b.visible_text]),
        vaccine_relevance=a.vaccine_relevance or b.vaccine_relevance,
        model=rep.model or a.model or b.model,
        latency_ms=max(a.latency_ms, b.latency_ms),
        raw={"per_frame": per_frame, "representative": rep_label},
    )


def _per_frame_of(r: ProviderResult) -> list[dict]:
    pf = (r.raw or {}).get("per_frame") if isinstance(r.raw, dict) else None
    if pf:
        return list(pf)
    if r.rating is None:
        return []
    label = (r.raw or {}).get("representative") if isinstance(r.raw, dict) else None
    return [{"frame": label or "frame", "rating": r.rating, "verdict": r.verdict.value}]


# ── Visual: image / pdf / pptx / video ───────────────────────────────────────
async def _analyse_frames(ing: Ingested, caption: str, mode: str) -> dict:
    timeout = settings.provider_timeout
    frames = ing.frames

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
        # Whole-file provider: C2PA reads the original container once.
        c2pa_task = _guard("c2pa", c2pa_provider.NAME, Kind.PROVENANCE,
                           asyncio.to_thread(c2pa_provider.run, ing.original), timeout)

        # Per-frame providers: vision + forensics (+ SynthID only when configured).
        # SynthID is gated/pending by default, so it would only add a constant
        # "inconclusive" row that skews the table; it lives in Second opinions
        # until an endpoint is configured.
        synthid_on = bool(settings.synthid_endpoint and settings.synthid_token)
        per_frame_tasks: list[tuple[str, int, asyncio.Future]] = []
        for fi, frame in enumerate(frames):
            for p in _VISION:
                per_frame_tasks.append((p.ID, fi,
                    _guard(p.ID, p.NAME, Kind.VISION, p.run(client, frame.media, caption, mode), timeout)))
            if synthid_on:
                per_frame_tasks.append(("synthid", fi,
                    _guard("synthid", synthid.NAME, Kind.WATERMARK, synthid.run(client, frame.media), timeout)))
            per_frame_tasks.append(("local", fi,
                _guard("local", local_forensics.NAME, Kind.FORENSIC,
                       asyncio.to_thread(local_forensics.run, frame.media), timeout)))

        c2pa_result, *frame_results = await asyncio.gather(
            c2pa_task, *[t for _, _, t in per_frame_tasks])

    # Group per-frame results by provider id (for the table) and by frame.
    grouped: dict[str, list[tuple[int, ProviderResult]]] = {}
    frame_rows: dict[int, list[ProviderResult]] = {}
    for (pid, fi, _), res in zip(per_frame_tasks, frame_results):
        grouped.setdefault(pid, []).append((fi, res))
        frame_rows.setdefault(fi, []).append(res)

    labels = [f.label for f in frames]
    vax_caption = f"{caption} {ing.text or ''}".strip()

    # Document-level provider rows for the table (aggregated across frames).
    rows_by_id: dict[str, ProviderResult] = {"c2pa": c2pa_result}
    for pid, items in grouped.items():
        rows_by_id[pid] = _aggregate_frames(items, labels)
    provider_rows = [rows_by_id[k] for k in _DISPLAY_ORDER if k in rows_by_id]

    # Per-frame consensus: each frame gets its own agreement-and-override verdict.
    frame_cons = [aggregate(frame_rows[fi] + [c2pa_result], vax_caption, mode)
                  for fi in range(len(frames))]
    # Perceptual hash per frame, so accumulated dev_runs/ feed the diffusion graph
    # without re-analysing the media.
    phashes = [_phash(frames[fi].media) for fi in range(len(frames))]
    frame_summaries = [{"frame": labels[fi], "rating": fc["overall_rating"],
                        "verdict": fc["overall_verdict"], "phash": phashes[fi]}
                       for fi, fc in enumerate(frame_cons)]

    # Document verdict: a single frame uses its own consensus; multiple frames are
    # combined by agreement (material divergence is flagged, not collapsed).
    consensus = frame_cons[0] if len(frame_cons) == 1 else aggregate_frames(
        frame_cons, provider_rows, vax_caption, mode)
    if ing.text:
        consensus["visible_text"] = consensus.get("visible_text") or ing.text[:4000]

    return {
        "consensus": consensus,
        "providers": [r.to_dict() for r in provider_rows],
        "frames": frame_summaries,
        "phashes": [h for h in phashes if h],
    }


def _aggregate_frames(items: list[tuple[int, ProviderResult]], labels: list[str]) -> ProviderResult:
    """Collapse one provider's per-frame results into a document-level row.
    Uses the most-synthetic frame (max rating) as representative."""
    ok = [(fi, r) for fi, r in items if r.status == Status.OK and r.rating is not None]
    if not ok:
        return items[0][1]  # same status across frames (e.g. unconfigured/pending)
    if len(items) == 1:
        return items[0][1]

    fi, worst = max(ok, key=lambda pair: pair[1].rating)
    per_frame = [{"frame": labels[i], "rating": r.rating, "verdict": r.verdict.value}
                 for i, r in items if r.rating is not None]
    agg = ProviderResult(
        id=worst.id, name=worst.name, kind=worst.kind, status=worst.status,
        rating=worst.rating, verdict=worst.verdict, confidence=worst.confidence,
        summary=f"Worst of {len(items)} frames ({labels[fi]}): {worst.summary}",
        evidence=[f"frame {labels[i]}: {r.rating}/100" for i, r in ok] + worst.evidence,
        visible_text=_longest([r.visible_text for _, r in items]),
        vaccine_relevance=next((r.vaccine_relevance for _, r in items if r.vaccine_relevance), None),
        model=worst.model, latency_ms=max(r.latency_ms for _, r in items),
        raw={"per_frame": per_frame, "representative": labels[fi]},
    )
    return agg


# ── Text: transcripts (and transcribed audio) ─────────────────────────────────
async def _text_report(text: str, caption: str, mode: str) -> dict:
    timeout = settings.provider_timeout
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout)) as client:
        tasks = [_guard(p.ID, p.NAME.replace(" Vision", " Analysis"), Kind.TEXT,
                        p.run_text(client, text, caption, mode), timeout)
                 for p in _VISION]
        vision = await asyncio.gather(*tasks)

    na = [
        ProviderResult("c2pa", c2pa_provider.NAME, Kind.PROVENANCE, Status.OK,
                       verdict=_na(), summary="Not checked in this text-analysis pass; no original-media provenance conclusion."),
        ProviderResult("local", local_forensics.NAME, Kind.FORENSIC, Status.OK,
                       verdict=_na(), summary="Pixel forensics: outside text analysis."),
    ]
    results = list(vision) + na
    consensus = aggregate(results, f"{caption} {text}".strip(), mode)
    consensus["visible_text"] = text[:4000]
    return {"consensus": consensus, "providers": [r.to_dict() for r in results], "frames": []}


async def _analyse_audio(ing: Ingested, caption: str, mode: str) -> dict:
    provenance = await _guard("c2pa", c2pa_provider.NAME, Kind.PROVENANCE,
        asyncio.to_thread(c2pa_provider.run, ing.original), settings.provider_timeout)
    async with httpx.AsyncClient(timeout=httpx.Timeout(settings.provider_timeout * 3)) as client:
        transcript, notes = await transcribe(client, ing.original.raw_bytes, ing.filename)
    ing.notes.extend(notes)
    report = await _text_report(transcript, caption, mode) if transcript else _empty_report(ing)
    report["providers"] = [p for p in report["providers"] if p["id"] != "c2pa"] + [provenance.to_dict()]
    ing.notes.append("Standalone-audio content assessment covers the transcript. AI-origin detection from sound is outside this assessment. Original-file C2PA was checked before transcription and is reported separately.")
    return report


def _empty_report(ing: Ingested) -> dict:
    note = ing.notes[0] if ing.notes else "Nothing analysable in this file."
    # Emit the FULL consensus shape (empty lists rather than missing keys), so
    # exporting an unanalysable record can never crash a format builder.
    return {
        "consensus": {
            "overall_rating": None, "overall_verdict": "inconclusive", "confidence": "low",
            "headline": "Not analysed", "explanation": note, "drivers": [],
            "agreement": "n/a", "visible_text": ing.text or "", "vaccine_codes": [],
            "supporting": [], "not_decisive": [], "decision_trace": [],
            "disclaimer": "Research assessment. Review alongside source information and context.",
        },
        "providers": [], "frames": [],
    }


# ── helpers ───────────────────────────────────────────────────────────────────
async def _guard(pid: str, name: str, kind: Kind, coro, timeout: float) -> ProviderResult:
    try:
        return await asyncio.wait_for(coro, timeout=timeout + 5)
    except asyncio.TimeoutError:
        return ProviderResult(pid, name, kind, Status.TIMEOUT, summary=f"No response within {timeout:.0f}s.")
    except Exception as exc:
        return ProviderResult(pid, name, kind, Status.ERROR, summary=f"{type(exc).__name__}: {exc}")


def _phash(media) -> str | None:
    try:
        img = Image.open(io.BytesIO(media.raw_bytes))
        return str(imagehash.phash(img))
    except Exception:
        try:
            import base64
            img = Image.open(io.BytesIO(base64.b64decode(media.vision_b64)))
            return str(imagehash.phash(img))
        except Exception:
            return None


def _longest(texts) -> str | None:
    vals = [t for t in texts if t]
    return max(vals, key=len) if vals else None


def _na():
    from .schema import Verdict
    return Verdict.NOT_APPLICABLE
