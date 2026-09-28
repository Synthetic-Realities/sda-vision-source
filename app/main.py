"""FastAPI app: serves the built React frontend + analysis/corpus endpoints."""
from __future__ import annotations

import base64
import asyncio
import hashlib
import io
import json
import re
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import Body, FastAPI, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles

from . import diffusion
from . import conference
from . import slide_preview
from .annotation import lane as annotation_lane
from .corpus import is_visible_corpus_file, is_visible_corpus_rel
from .narrate import graph_summary, verdict_map_summary
from .score import score_opinion
from .config import CORPUS_DIR, METHOD_VERSION, ROOT, TOOL_NAME, VERSION, settings
from .export import (
    build_batch_csv, build_batch_markdown, build_batch_pdf, build_batch_pptx,
    build_csv, build_markdown, build_pdf, build_pptx,
)
from .ingest import ingest
from .media import report_thumbnail
from .media import load_media
from .audio import extract_excerpt
from .providers import audio_assessment, c2pa_provider, suno_credentials
from .request_validation import validate_export_item, validate_graph, validate_report
from .pipeline import analyse, analyse_deep, context_hash, extraction_policy

app = FastAPI(title=f"{TOOL_NAME} {VERSION}")

DIST = Path(os.environ.get("SDA_FRONTEND_DIR", str(ROOT / "frontend" / ("dist-conference" if settings.delivery_profile == "conference" else "dist"))))
DEV_RUNS = ROOT / "dev_runs"
EXAMPLES_DIR = ROOT / "examples"
CONFERENCE = settings.delivery_profile == "conference"
if settings.delivery_profile not in {"research", "conference"}:
    raise ValueError("SDA_PROFILE must be research or conference.")
conference.install(app, settings, EXAMPLES_DIR, ingest, analyse, report_thumbnail)

# What the corpus picker lists / what the app will accept.
_PICKABLE_EXT = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif",
    ".pdf", ".pptx", ".mp4", ".mov", ".webm", ".m4v",
    ".txt", ".srt", ".vtt", ".md",
    ".m4a", ".mp3", ".wav",
}


# ── API ───────────────────────────────────────────────────────────────────────
@app.get("/api/providers")
def providers() -> JSONResponse:
    """What's configured, so the UI can be honest about each row up front."""
    from .c2pa_trust import load_policy
    _, trust_policy = load_policy()
    return JSONResponse({
        "tool": TOOL_NAME,
        "version": VERSION,
        "method_version": METHOD_VERSION,
        "vaccine_lens": settings.enable_vaccine_lens,
        "dev_mode": settings.dev_mode and not CONFERENCE,
        "delivery_profile": settings.delivery_profile,
        "claude": _state(settings.anthropic_key, settings.disable_anthropic, settings.anthropic_model),
        "openai": _state(settings.openai_key, settings.disable_openai, settings.openai_model),
        "gemini": _state(settings.google_key, settings.disable_google, settings.google_model),
        "synthid": {"configured": bool(settings.synthid_endpoint and settings.synthid_token),
                    "state": "ready" if (settings.synthid_endpoint and settings.synthid_token) else "pending",
                    "model": "SynthID Detector"},
        "c2pa": {"configured": _c2pa_available(), "state": "ready" if _c2pa_available() else "missing",
                 "model": "c2pa-python (local)", "trust_policy": trust_policy},
        "local": {"configured": True, "state": "ready", "model": "Pillow/numpy (local)"},
        "audio_assessment": _state(settings.google_key, settings.disable_google, settings.google_model),
        # The local corpus browser is a dev-only research surface.
        "corpus_available": not CONFERENCE and settings.dev_mode and CORPUS_DIR.exists(),
    })


# Uploads are read fully into memory (then copied for thumbnails/ingest), so a
# hard byte ceiling keeps one request from exhausting RAM. Generous for real
# research media; a 30-minute audio file is ~30 MB.
MAX_UPLOAD_BYTES = 200 * 1024 * 1024
MAX_CAPTION_CHARS = 4000
MAX_PRIOR_REPORT_CHARS = 2 * 1024 * 1024


async def _read_upload(file: UploadFile) -> bytes:
    chunks, total = [], 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "File too large (limit 200 MB).")
        chunks.append(chunk)
    return b"".join(chunks)


def _clip_caption(caption: str) -> str:
    return caption.strip()[:MAX_CAPTION_CHARS]


async def _slide_response(raw: bytes, filename: str) -> JSONResponse:
    try:
        result = await asyncio.to_thread(slide_preview.render_slides, raw, filename)
        return JSONResponse(result, headers={"Cache-Control": "no-store"})
    except slide_preview.PreviewError as exc:
        raise HTTPException(exc.status, str(exc)) from exc


@app.post("/api/preview/slides")
async def preview_slides(file: UploadFile) -> JSONResponse:
    return await _slide_response(await _read_upload(file), file.filename or "upload")


@app.get("/api/examples/slides")
async def example_slides(name: str) -> JSONResponse:
    if CONFERENCE:
        target, raw = conference.example_bytes(settings, EXAMPLES_DIR, name)
    else:
        target = (EXAMPLES_DIR / name).resolve()
        if not _contained(target, EXAMPLES_DIR) or not target.is_file():
            raise HTTPException(404, "Example not found.")
        if target.stat().st_size > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "File too large (limit 200 MB).")
        raw = target.read_bytes()
    return await _slide_response(raw, target.name)


@app.post("/api/analyse")
async def analyse_endpoint(
    file: UploadFile | None = None,
    corpus_path: str = Form(default=""),
    caption: str = Form(default=""),
    mode: str = Form(default="general"),
) -> JSONResponse:
    if file is not None:
        raw = await _read_upload(file)
        filename = file.filename or "upload"
        mime = file.content_type
    elif corpus_path:
        if not settings.dev_mode:
            raise HTTPException(403, "The local corpus is only available in dev mode.")
        path = _safe_corpus_path(corpus_path)
        raw = path.read_bytes()
        filename = path.name
        mime = None
    else:
        raise HTTPException(400, "Provide an uploaded file or a corpus_path.")

    if not raw:
        raise HTTPException(400, "Empty file.")

    # The vaccine lens only runs when explicitly enabled (gated research config).
    use_vaccine = mode == "vaccine" and settings.enable_vaccine_lens
    ing = ingest(raw, filename, mime)
    report = await analyse(ing, _clip_caption(caption), "vaccine" if use_vaccine else "general")
    # Every report carries a visual of the analysed item (image / first frame /
    # cover art / waveform) for the preview box, graph info card and exports.
    report["meta"]["thumbnail"] = report_thumbnail(raw, ing)

    if settings.dev_mode:
        _save_run(report, filename)
    return JSONResponse(report)


async def _bound_original(file: UploadFile, expected_sha256: str) -> tuple[bytes, str, str]:
    raw = await _read_upload(file)
    if not raw or hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise HTTPException(400, "The selected file does not match this report. Run a new analysis.")
    filename = file.filename or "upload"
    from .ingest import _EXT_MIME, _VIDEO_EXT, _AUDIO_EXT
    suffix = Path(filename).suffix.lower()
    if suffix not in _VIDEO_EXT | _AUDIO_EXT:
        raise HTTPException(415, "A supported original audio or video file is required.")
    return raw, filename, _EXT_MIME.get(suffix, file.content_type or "application/octet-stream")


async def _original_provenance(raw: bytes, filename: str, mime: str) -> dict:
    row = await asyncio.to_thread(c2pa_provider.run, load_media(raw, filename, mime))
    return {"summary": row.summary, "validation": row.raw.get("validation", {}),
            "declaration": row.raw.get("declaration"),
            "scope": "original container; audio-track-specific attribution not established"}


@app.post("/api/audio/assess")
async def assess_audio_endpoint(
    file: UploadFile, expected_sha256: str = Form(...),
    track_index: int = Form(...), start_seconds: float = Form(default=0),
    consent_to_google: bool = Form(default=False),
) -> JSONResponse:
    if not consent_to_google:
        raise HTTPException(403, "Explicit consent to send a soundtrack excerpt to Google is required.")
    if not settings.google_key or settings.disable_google:
        raise HTTPException(503, "Google audio-content assessment is not configured.")
    if track_index < 0 or not math.isfinite(start_seconds) or start_seconds < 0:
        raise HTTPException(400, "Invalid audio track or excerpt start.")
    raw, filename, mime = await _bound_original(file, expected_sha256)
    provenance = await _original_provenance(raw, filename, mime)
    try:
        excerpt, duration = await asyncio.to_thread(extract_excerpt, raw, filename, track_index, start_seconds)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
        result = await audio_assessment.assess(client, excerpt, expected_sha256, track_index, start_seconds, duration)
    result["original_provenance"] = provenance
    return JSONResponse(result)


@app.post("/api/suno/check")
async def suno_check_endpoint(
    file: UploadFile, expected_sha256: str = Form(...),
    consent_to_suno: bool = Form(default=False),
) -> JSONResponse:
    if not consent_to_suno:
        raise HTTPException(403, "Explicit consent to send the complete original file to Suno is required.")
    raw, filename, mime = await _bound_original(file, expected_sha256)
    if len(raw) > suno_credentials.MAX_BYTES:
        raise HTTPException(413, "Suno's documented upload limit is 100 MB; no upload was made.")
    provenance = await _original_provenance(raw, filename, mime)
    async with httpx.AsyncClient(timeout=60, follow_redirects=False) as client:
        result = await suno_credentials.check(client, raw, mime, Path(filename).suffix.lower())
    result["original_provenance"] = provenance
    return JSONResponse(result)


@app.post("/api/analyse/deep")
async def analyse_deep_endpoint(
    file: UploadFile,
    caption: str = Form(default=""),
    mode: str = Form(default="general"),
    prior_report: str = Form(default=""),
) -> JSONResponse:
    """Incremental deep pass: analyse the frames the capped first pass skipped
    and recombine over the full set. The client re-uploads the same file (the
    server is stateless) plus the first pass's report; only the remaining
    frames are sent to the vision models, so no frame is paid for twice."""
    raw = await _read_upload(file)
    if not raw:
        raise HTTPException(400, "Empty file.")
    if len(prior_report) > MAX_PRIOR_REPORT_CHARS:
        raise HTTPException(413, "The first pass's report is too large.")
    try:
        prior = json.loads(prior_report) if prior_report else None
    except ValueError:
        prior = None
    prior = validate_report(prior)
    # The prior report is client-supplied: validate every field this endpoint
    # (and analyse_deep after it) touches, so junk yields a 400, never a 500.
    if not isinstance(prior, dict) or not isinstance(prior.get("meta"), dict):
        raise HTTPException(400, "A deep pass needs the first pass's report.")
    frames, providers = prior.get("frames"), prior.get("providers")
    if not isinstance(frames, list) or not isinstance(providers, list) or \
       not all(isinstance(f, dict) for f in frames) or \
       not all(isinstance(p, dict) for p in providers):
        raise HTTPException(400, "The first pass's report is malformed.")
    try:
        prior_n = max(0, int(prior["meta"].get("frame_count") or 0))
    except (TypeError, ValueError):
        raise HTTPException(400, "The first pass's report is malformed.")

    filename = file.filename or "upload"
    use_vaccine = mode == "vaccine" and settings.enable_vaccine_lens
    effective_mode = "vaccine" if use_vaccine else "general"
    meta = prior["meta"]
    if meta.get("input_sha256") != hashlib.sha256(raw).hexdigest():
        raise HTTPException(400, "This report is not bound to this file. Run a new analysis before a deep pass.")
    if (meta.get("method_version") != METHOD_VERSION
            or meta.get("context_sha256") != context_hash(_clip_caption(caption), effective_mode)
            or meta.get("extraction_policy") != extraction_policy()):
        raise HTTPException(400, "Analysis method, context or extraction settings changed. Run a new analysis.")
    kind = prior["meta"].get("kind", "")
    # Finite frame sets get full coverage (cap 0 = everything); continuous video
    # gets double density (bounded), with analysed timestamps skipped in the merge.
    cap = min(prior_n * 2, 500) if kind == "video" else 0
    ing = ingest(raw, filename, file.content_type, max_frames=cap)
    report = await analyse_deep(ing, prior, _clip_caption(caption), "vaccine" if use_vaccine else "general")
    report["meta"]["thumbnail"] = report_thumbnail(raw, ing)

    if settings.dev_mode:
        _save_run(report, filename)
    return JSONResponse(report)


@app.post("/api/annotate")
async def annotate_endpoint(file: UploadFile, caption: str = Form(default="")) -> JSONResponse:
    """Annotation lane (opt-in, pointer-not-verdict): run the ground-truth
    cross-reference pass and return validated pointers. Read-only with respect
    to the scored aggregation; nothing is persisted server-side (the client
    holds pointers on the report, like pasted second opinions)."""
    raw = await _read_upload(file)
    if not raw:
        raise HTTPException(400, "Empty file.")
    ing = ingest(raw, file.filename or "upload", file.content_type)
    if not ing.frames:
        raise HTTPException(400, "The annotation lane needs a visual artefact "
                                 "(image, PDF, PPTX or video).")
    return JSONResponse(await annotation_lane.annotate(ing, _clip_caption(caption)))


@app.post("/api/frame")
async def frame_image(
    file: UploadFile,
    label: str = Form(...),
) -> Response:
    """Return one analysed frame as a standalone image, re-extracted locally
    from the uploaded file (no API calls). Extraction is deterministic, so the
    frame matching the report's label is the exact image the models saw - this
    lets a researcher attach the analysed figure to an external SynthID check
    (which refuses PDF/PPTX containers) without manual screenshotting."""
    raw = await _read_upload(file)
    if not raw:
        raise HTTPException(400, "Empty file.")
    filename = file.filename or "upload"
    ing = ingest(raw, filename, file.content_type, max_frames=0)
    fr = next((f for f in ing.frames if f.label == label), None)
    if fr is None:
        raise HTTPException(404, f'Frame "{label}" was not found in a fresh extraction of this file.')
    stem = re.sub(r"\W+", "_", Path(filename).stem)[:40] or "file"
    slug = re.sub(r"\W+", "_", label)[:30] or "frame"
    return Response(
        content=base64.b64decode(fr.media.vision_b64),
        media_type=fr.media.vision_mime or "image/jpeg",
        headers={"Content-Disposition": f'attachment; filename="sda-frame-{slug}-{stem}.jpg"'},
    )


_PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


@app.post("/api/export/{fmt}")
async def export(fmt: str, payload: dict = Body(...)) -> Response:
    # Payload is {report, image?}; tolerate a bare report for backward compatibility.
    item = validate_export_item(payload if "report" in payload else {"report": payload})
    report, image = item["report"], item["image"]
    if fmt == "md":
        content, mt = build_markdown(report), "text/markdown"
    elif fmt == "csv":
        content, mt = build_csv(report), "text/csv"
    elif fmt == "pptx":
        content, mt = build_pptx(report, image), _PPTX_MIME
    elif fmt == "pdf":
        content, mt = build_pdf(report, image), "application/pdf"
    else:
        raise HTTPException(400, f"Unknown export format: {fmt}")
    base = re.sub(r"\W+", "_", report.get("meta", {}).get("filename", "report"))[:60] or "report"
    return Response(content=content, media_type=mt,
                    headers={"Content-Disposition": f'attachment; filename="sda-vision-{base}.{fmt}"'})


@app.post("/api/export/batch/{fmt}")
async def export_batch(fmt: str, payload: dict = Body(...)) -> Response:
    # Payload is {items: [{report, image?}]}.
    items = payload.get("items", [])
    if not isinstance(items, list) or not items or len(items) > 100:
        raise HTTPException(400, "Batch export needs between 1 and 100 report items.")
    items = [validate_export_item(it) for it in items]
    reports = [it["report"] for it in items]
    if fmt == "csv":
        content, mt = build_batch_csv(reports), "text/csv"
    elif fmt == "md":
        content, mt = build_batch_markdown(reports), "text/markdown"
    elif fmt == "pptx":
        content, mt = build_batch_pptx(items), _PPTX_MIME
    elif fmt == "pdf":
        content, mt = build_batch_pdf(items), "application/pdf"
    else:
        raise HTTPException(400, f"Unknown batch export format: {fmt}")
    return Response(content=content, media_type=mt,
                    headers={"Content-Disposition": f'attachment; filename="sda-vision-batch.{fmt}"'})


@app.get("/api/corpus")
def corpus() -> JSONResponse:
    if CONFERENCE or not settings.dev_mode or not CORPUS_DIR.exists():
        return JSONResponse({"available": False, "labels": []})
    labels: dict[str, list[dict]] = {}
    for path in sorted(CORPUS_DIR.rglob("*")):
        if is_visible_corpus_file(path, CORPUS_DIR) and path.suffix.lower() in _PICKABLE_EXT:
            rel = path.relative_to(CORPUS_DIR)
            labels.setdefault(rel.parts[0], []).append({"name": path.name, "path": str(rel)})
    return JSONResponse({
        "available": True,
        "labels": [{"label": k, "count": len(v), "files": v} for k, v in sorted(labels.items())],
    })


@app.get("/api/corpus/file")
def corpus_file(path: str) -> FileResponse:
    if not settings.dev_mode:
        raise HTTPException(403, "The local corpus is only available in dev mode.")
    return FileResponse(_safe_corpus_path(path))


# Symbolic-diffusion graph (dev only). POST so the frontend can hand over the
# current session's batch reports for the "Current batch" source.
def _graph_from_payload(payload: dict):
    payload = validate_graph(payload)
    source = payload.get("source", "example")
    if CONFERENCE and source not in {"example", "item", "batch"}:
        raise HTTPException(403, "Research history is unavailable in the conference profile.")
    # The illustrative example is available in every build (it drives the public
    # demo). Batch and corpus sources stay dev-only - they touch real data.
    # The per-item verdict map only re-shapes the report the user already
    # holds, so it is available in every build alongside the example.
    if source not in ("example", "item") and not settings.dev_mode and not (CONFERENCE and source == "batch"):
        raise HTTPException(403, "Only the illustrative example is available in this build.")
    g = diffusion.graph_for_payload(
        source, payload.get("reports"), int(payload.get("threshold", 10)),
        int(payload.get("min_component", 1)), payload.get("edge_mode", "attributes"))
    return source, g


@app.post("/api/diffusion")
def diffusion_graph(payload: dict = Body(default={})) -> JSONResponse:
    source, g = _graph_from_payload(payload)
    return JSONResponse({"source": source, **diffusion.graph_to_json(g)})


@app.post("/api/diffusion/gexf")
def diffusion_gexf(payload: dict = Body(default={})) -> Response:
    source, g = _graph_from_payload(payload)
    return Response(content=diffusion.gexf_bytes(g), media_type="application/gexf+xml",
                    headers={"Content-Disposition": f'attachment; filename="sda-diffusion-{source}.gexf"'})


@app.post("/api/diffusion/csv")
def diffusion_csv(payload: dict = Body(default={})) -> Response:
    source, g = _graph_from_payload(payload)
    return Response(content=diffusion.csv_zip_bytes(g), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="sda-diffusion-{source}-csv.zip"'})


@app.post("/api/diffusion/png")
def diffusion_png(payload: dict = Body(default={})) -> Response:
    """The current graph rendered as a PNG image (same renderer as the batch
    export pages), so a graph or verdict map can be attached to a paper or a
    Zenodo record directly."""
    import os
    import tempfile
    source, g = _graph_from_payload(payload)
    # Honour the on-screen "Colour by" choice; unknown values fall back to verdict.
    colour_by = str(payload.get("colour_by", "verdict"))
    if colour_by not in diffusion.PNG_COLOUR_MODES:
        colour_by = "verdict"
    # Honour the on-screen theme too: the chrome (background, labels, edges)
    # follows light/dark so the download matches the interface it came from;
    # the node data palette is identical in both.
    theme = str(payload.get("theme", "dark"))
    if theme not in diffusion.PNG_THEMES:
        theme = "dark"
    fd, path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    try:
        diffusion.render_png(g, Path(path), anonymise=False, labels=True, colour_by=colour_by, theme=theme)
        data = Path(path).read_bytes()
    finally:
        os.unlink(path)
    suffix = "-light" if theme == "light" else ""
    return Response(content=data, media_type="image/png",
                    headers={"Content-Disposition": f'attachment; filename="sda-diffusion-{source}-by-{colour_by}{suffix}.png"'})


@app.post("/api/opinion-score")
async def opinion_score(payload: dict = Body(default={})) -> JSONResponse:
    """Distil a pasted second-opinion note into a quick {score, read} via Haiku."""
    if payload.get("consent_to_anthropic") is not True:
        raise HTTPException(400, "Explicit consent is required to send this note to Anthropic.")
    if not isinstance(payload.get("text"), str):
        raise HTTPException(400, "The note must be text.")
    return JSONResponse(await score_opinion(payload["text"]))


@app.post("/api/diffusion/summary")
def diffusion_summary(payload: dict = Body(default={})) -> JSONResponse:
    source, g = _graph_from_payload(payload)
    data = diffusion.graph_to_json(g)
    summary = (verdict_map_summary(data) if source == "item" else graph_summary(data, source=source))
    return JSONResponse({**summary, "stats": data["stats"]})


# Bundled, face-free example media (available in every build, not dev-gated).
# Lead with the two clearly-synthetic illustrations so the demo opens on the most
# instructive cases, then the rest alphabetically.
_EXAMPLE_FIRST = ["synthetic_vaccine_illustration.png", "synthetic_journal_figure.png"]


@app.get("/api/examples")
def examples() -> JSONResponse:
    if CONFERENCE:
        return JSONResponse({"files": [{"name": name} for name in conference.example_manifest(settings, EXAMPLES_DIR)]})
    names = []
    if EXAMPLES_DIR.is_dir():
        names = [p.name for p in EXAMPLES_DIR.iterdir()
                 if p.is_file() and p.suffix.lower() in _PICKABLE_EXT - {".md"}]

    def rank(name: str) -> tuple[int, str]:
        return (_EXAMPLE_FIRST.index(name), "") if name in _EXAMPLE_FIRST else (len(_EXAMPLE_FIRST), name.lower())

    files = [{"name": n} for n in sorted(names, key=rank)]
    return JSONResponse({"files": files})


@app.get("/api/examples/file")
def examples_file(name: str) -> FileResponse:
    if CONFERENCE:
        target, _ = conference.example_bytes(settings, EXAMPLES_DIR, name)
        return FileResponse(target)
    target = (EXAMPLES_DIR / name).resolve()
    if not _contained(target, EXAMPLES_DIR) or not target.is_file():
        raise HTTPException(404, "Example not found.")
    return FileResponse(target)


# A visual for an example BEFORE it is analysed, so a PDF or slide deck shows
# its first page/slide (and audio its cover art/waveform) instead of a bare kind
# glyph - the same visual the report carries afterwards. Rendering a page is not
# free, so each example is built once and kept in memory, keyed by mtime so an
# edited example re-renders. Only one frame is ingested: this is a preview.
_EXAMPLE_THUMBS: dict[tuple[str, float], str | None] = {}


@app.get("/api/examples/thumb")
def examples_thumb(name: str) -> JSONResponse:
    if CONFERENCE:
        conference.example_bytes(settings, EXAMPLES_DIR, name)
    target = (EXAMPLES_DIR / name).resolve()
    if not _contained(target, EXAMPLES_DIR) or not target.is_file():
        raise HTTPException(404, "Example not found.")
    key = (target.name, target.stat().st_mtime)
    if key not in _EXAMPLE_THUMBS:
        try:
            raw = target.read_bytes()
            _EXAMPLE_THUMBS[key] = report_thumbnail(raw, ingest(raw, target.name, max_frames=1))
        except Exception:
            # A preview is never worth failing a page load over.
            _EXAMPLE_THUMBS[key] = None
    return JSONResponse({"thumb": _EXAMPLE_THUMBS[key]})


def _save_run(report: dict, filename: str, thumbnail: str | None = None) -> None:
    DEV_RUNS.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    safe = re.sub(r"\W+", "_", filename)[:60]
    saved = {**report, "meta": {**report["meta"], "thumbnail": thumbnail}} if thumbnail else report
    (DEV_RUNS / f"{stamp}_{safe}.json").write_text(json.dumps(saved, indent=2))


# ── Static React build ────────────────────────────────────────────────────────
if (DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/")
def index():
    if not (DIST / "index.html").is_file():
        return PlainTextResponse(
            "Frontend not built yet. Run: cd frontend && npm install && npm run build",
            status_code=503)
    return FileResponse(DIST / "index.html")


@app.get("/{path:path}")
def spa_fallback(path: str):
    """Serve a built static file if it exists, else fall back to the SPA shell."""
    candidate = (DIST / path).resolve()
    if _contained(candidate, DIST) and candidate.is_file():
        return FileResponse(candidate)
    if (DIST / "index.html").is_file():
        return FileResponse(DIST / "index.html")
    raise HTTPException(404, "Not found")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _contained(target: Path, base: Path) -> bool:
    """Real containment check - a prefix string test would also match sibling
    directories that share the prefix (e.g. dist vs dist-showcase)."""
    try:
        target.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def _safe_corpus_path(rel: str) -> Path:
    target = (CORPUS_DIR / rel).resolve()
    if not _contained(target, CORPUS_DIR) or not target.is_file():
        raise HTTPException(404, "File not found in corpus.")
    corpus_rel = target.relative_to(CORPUS_DIR.resolve())
    if not is_visible_corpus_rel(corpus_rel):
        raise HTTPException(404, "File not found in corpus.")
    return target


def _state(key: str, disabled: bool, model: str) -> dict:
    state = "disabled" if disabled else ("ready" if key else "unconfigured")
    return {"configured": bool(key) and not disabled, "state": state, "model": model}


def _c2pa_available() -> bool:
    try:
        import c2pa  # noqa: F401
        return True
    except Exception:
        return False
