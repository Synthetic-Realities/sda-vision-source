"""Phase 1 tests for the annotation lane (amended brief, section 6).

Pins the lane's defining properties: structural validation with no verdict
fields, prompt identity across the scored panel, zero influence on the scored
aggregation, egress limited to the three existing vendor endpoints, the
absence-of-signal rule, and the deep-pass carry of annotation fields.
All tests run offline: vendor traffic is mocked.
"""
from __future__ import annotations

import asyncio
import io
import json
import re
from pathlib import Path
from types import SimpleNamespace

import httpx
from PIL import Image

from app.aggregate import aggregate
from app.annotation import lane, prompts, schema, tells
from app.annotation.schema import validate_check, validate_pointer
from app.config import ANNOTATION_PROMPT_VERSION, PANEL_VERSION
from app.pipeline import _carry_researcher_fields
from app.providers import claude, gemini, openai
from app.providers.prompt import build_prompt
from app.schema import Kind, ProviderResult, Status

REPO = Path(__file__).resolve().parent.parent
ALLOWED_HOSTS = {"api.anthropic.com", "api.openai.com", "generativelanguage.googleapis.com"}

VALID_POINTER = {
    "pointer_id": "ptr-000001",
    "artefact_ref": "test.png/single image",
    "observation": "Depicted shoreline structures are absent from the base map at these coordinates.",
    "verification_action": "Compare the rendered shoreline against the referent below and confirm whether the structures exist.",
    "referent_source": "Platform base-map tile, stated coordinates",
    "referent_capture_date": "2026-05-14",
    "referent_authority": "Base-map provider",
    "referent_version": prompts.UNKNOWN_SENTINEL,
    "emitted_by": "test-model",
    "panel_version": PANEL_VERSION,
    "prompt_version": ANNOTATION_PROMPT_VERSION,
    "emitted_at": "2026-08-01T09:14:00+00:00",
}


def _stub_settings():
    return SimpleNamespace(
        anthropic_key="k", openai_key="k", google_key="k",
        disable_anthropic=False, disable_openai=False, disable_google=False,
        anthropic_model="claude-opus-4-8", openai_model="gpt-5.5",
        google_model="gemini-3.5-flash",
        provider_timeout=5.0, provider_retries=0,
        pdf_mode="auto", min_figure_px=300,
    )


# ── Validator ─────────────────────────────────────────────────────────────────

def test_valid_pointer_accepted():
    assert validate_pointer(dict(VALID_POINTER)) == []


def test_validator_rejects_every_forbidden_field():
    for bad in sorted(schema.FORBIDDEN_FIELDS):
        p = dict(VALID_POINTER)
        p[bad] = "0.9"
        errors = validate_pointer(p)
        assert any("forbidden" in e for e in errors), f"{bad} not rejected"


def test_validator_rejects_nested_and_near_miss_forbidden_fields():
    p = dict(VALID_POINTER)
    p["extra"] = "anything"
    assert any("unknown field: extra" in e for e in validate_pointer(p))
    # The walk must find verdict-ish keys at depth, by substring, with a path.
    nested = {"wrapped": [{"confidence_score": 0.93}]}
    assert schema._forbidden_keys(nested) == ["wrapped[0].confidence_score"]
    assert schema._forbidden_keys({"authenticity_rating_pct": 87})
    assert schema._forbidden_keys({"assessment": "text"})
    # Zero-width padding cannot hide a term from the normalised match.
    assert schema._forbidden_keys({"ver​dict": "x"})


def test_validator_enforces_date_rules():
    p = dict(VALID_POINTER, referent_capture_date="sometime, probably 2023ish")
    assert any("referent_capture_date" in e for e in validate_pointer(p))
    assert validate_pointer(dict(VALID_POINTER, referent_capture_date="2026-05-14")) == []
    assert validate_pointer(dict(VALID_POINTER,
                                 referent_capture_date=prompts.UNKNOWN_SENTINEL)) == []
    bad_ts = dict(VALID_POINTER, emitted_at="yesterday teatime")
    assert any("emitted_at" in e for e in validate_pointer(bad_ts))


def test_validator_rejects_missing_referent_and_version_fields():
    for required in ("referent_source", "referent_capture_date", "referent_authority",
                     "referent_version", "panel_version", "prompt_version", "emitted_at"):
        p = dict(VALID_POINTER)
        p[required] = "  "
        assert any(required in e for e in validate_pointer(p)), f"{required} not required"


def test_check_record_validation():
    check = {"pointer_id": "ptr-000001", "checked_by": "S. Martin",
             "checked_at": "2026-08-01T10:00:00+00:00", "outcome": "verified",
             "referent_consulted": "OS OpenData 2026-1", "note": "Structures present."}
    assert validate_check(check) == []
    bad = dict(check, outcome="probably_fine")
    assert any("outcome" in e for e in validate_check(bad))
    bad2 = dict(check)
    bad2["confidence"] = "high"
    assert any("forbidden" in e for e in validate_check(bad2))


# ── Scored prompt identity and tells isolation ────────────────────────────────

def _media_stub():
    img = Image.new("RGB", (64, 64), "white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    import base64
    b64 = base64.b64encode(buf.getvalue()).decode()
    return SimpleNamespace(filename="test.png", vision_mime="image/png",
                           vision_b64=b64, vision_data_url=f"data:image/png;base64,{b64}")


def _vendor_reply(host: str, text: str) -> dict:
    if host == "api.anthropic.com":
        return {"content": [{"type": "text", "text": text}]}
    if host == "api.openai.com":
        return {"choices": [{"message": {"content": text}}]}
    return {"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}]}


def test_scored_prompt_identical_across_panel_members(monkeypatch):
    """Each provider must embed the shared build_prompt output verbatim."""
    SENTINEL = "PROMPT-IDENTITY-SENTINEL-9f2c"
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        host = request.url.host
        if host == "api.anthropic.com":
            captured[host] = body["messages"][0]["content"][0]["text"]
        elif host == "api.openai.com":
            captured[host] = body["messages"][0]["content"][0]["text"]
        else:
            captured[host] = body["contents"][0]["parts"][0]["text"]
        return httpx.Response(200, json=_vendor_reply(host, "{}"))

    stub = _stub_settings()
    media = _media_stub()
    for mod in (claude, openai, gemini):
        monkeypatch.setattr(mod, "settings", stub)
        monkeypatch.setattr(mod, "build_prompt", lambda caption, filename, mode: SENTINEL)

    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            for mod in (claude, openai, gemini):
                await mod.run(client, media, "caption", "general")
    asyncio.run(go())

    assert len(captured) == 3
    assert set(captured.values()) == {SENTINEL}, "prompt not identical across panel members"


_IMPORT_GUARD = re.compile(
    r"^\s*(?:from|import)\s+\S*annotation|^\s*from\s+\S+\s+import\s+[^\n#]*\bannotation\b",
    re.M)


def test_tells_note_never_reaches_scored_prompt():
    scored = build_prompt("a caption", "file.png", "general")
    assert tells.TELLS_NOTE not in scored
    assert "annotation" not in scored.lower()
    src = (REPO / "app" / "providers" / "prompt.py").read_text()
    assert not _IMPORT_GUARD.search(src)


def test_scored_prompt_identity_as_shipped(monkeypatch):
    """Unpatched complement to the sentinel test: the three providers must
    embed the REAL shared build_prompt output, equal across all members."""
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        host = request.url.host
        if host in ("api.anthropic.com", "api.openai.com"):
            captured[host] = body["messages"][0]["content"][0]["text"]
        else:
            captured[host] = body["contents"][0]["parts"][0]["text"]
        return httpx.Response(200, json=_vendor_reply(host, "{}"))

    stub = _stub_settings()
    media = _media_stub()
    for mod in (claude, openai, gemini):
        monkeypatch.setattr(mod, "settings", stub)

    async def go():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            for mod in (claude, openai, gemini):
                await mod.run(client, media, "caption", "general")
    asyncio.run(go())

    expected = build_prompt("caption", media.filename, "general")
    assert len(captured) == 3
    assert set(captured.values()) == {expected}


# ── Aggregation independence ──────────────────────────────────────────────────

def test_scored_modules_never_import_annotation():
    for rel in ("app/aggregate.py", "app/score.py", "app/pipeline.py"):
        src = (REPO / rel).read_text()
        assert not _IMPORT_GUARD.search(src), rel


def test_deep_pass_consensus_identical_with_and_without_annotation_keys(monkeypatch):
    """The specified with/without comparison, at the pipeline level where the
    prior report dict (which can carry annotation keys) actually flows: run
    the real analyse_deep merge branch twice on a six-page PDF fixture, with and
    without annotation_* keys attached, offline (providers disabled), and the
    scored output must be byte-identical. Also proves the carry through the
    real call site rather than the helper alone."""
    import copy
    import io
    from reportlab.pdfgen.canvas import Canvas
    from app import pipeline
    from app.ingest import ingest as real_ingest

    stub = _stub_settings()
    stub.disable_anthropic = stub.disable_openai = stub.disable_google = True
    stub.synthid_endpoint = ""
    stub.synthid_token = ""
    for mod in (claude, openai, gemini):
        monkeypatch.setattr(mod, "settings", stub)
    monkeypatch.setattr(pipeline, "settings", stub)

    # A generated document keeps this regression independent of researchers'
    # selected examples while exercising real PDF ingestion and the deep merge.
    buffer = io.BytesIO()
    document = Canvas(buffer, pagesize=(400, 400))
    for index in range(6):
        document.drawString(30, 360, f"Annotation isolation fixture: page {index + 1}")
        document.setFillColorRGB(index / 6, 0.6, 0.7)
        document.rect(40, 150, 140 + index * 20, 170, fill=1)
        document.showPage()
    document.save()
    raw = buffer.getvalue()
    prior = asyncio.run(pipeline.analyse(
        real_ingest(raw, "annotation-fixture.pdf", "application/pdf", max_frames=4),
        "", "general"))
    with_keys = copy.deepcopy(prior)
    with_keys["annotation_pointers"] = [dict(VALID_POINTER)]
    with_keys["annotation_checks"] = []
    with_keys["annotation_meta"] = {"panel_version": PANEL_VERSION}

    def run(p):
        ing = real_ingest(raw, "annotation-fixture.pdf", "application/pdf",
                          max_frames=0)
        assert len(ing.frames) == 6, "deep pass must include frames outside the initial four"
        return asyncio.run(pipeline.analyse_deep(ing, copy.deepcopy(p), "", "general"))

    plain, annotated = run(prior), run(with_keys)

    def scored(r):
        # latency_ms is wall-clock timing, volatile between any two runs and
        # not part of the scored output; everything else must be identical.
        providers = [{k: v for k, v in p.items() if k != "latency_ms"}
                     for p in r["providers"]]
        return json.dumps({"consensus": r["consensus"], "frames": r["frames"],
                           "providers": providers}, sort_keys=True)
    assert scored(plain) == scored(annotated), "annotation keys influenced the scored output"
    assert annotated["annotation_pointers"] == [dict(VALID_POINTER)]
    assert annotated["annotation_meta"] == {"panel_version": PANEL_VERSION}
    assert "annotation_pointers" not in plain or plain.get("annotation_pointers") is None


def test_absence_of_signals_never_yields_authentic():
    rows = [
        ProviderResult("c2pa", "C2PA Content Credentials", Kind.PROVENANCE, Status.OK,
                       summary="No embedded Content Credentials."),
        ProviderResult("synthid", "SynthID Detector", Kind.WATERMARK, Status.PENDING,
                       summary="Awaiting access."),
        ProviderResult("claude", "Claude Vision", Kind.VISION, Status.DISABLED, summary="off"),
        ProviderResult("openai", "OpenAI Vision", Kind.VISION, Status.DISABLED, summary="off"),
        ProviderResult("gemini", "Gemini Vision", Kind.VISION, Status.DISABLED, summary="off"),
    ]
    consensus = aggregate(rows, "", "general")
    assert str(consensus["overall_verdict"]) != "authentic_likely"


# ── Lane end to end (offline) ─────────────────────────────────────────────────

def _png_bytes() -> bytes:
    img = Image.new("RGB", (64, 64), "white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_lane_end_to_end_offline(monkeypatch):
    from app.ingest import ingest
    hosts_hit: list[str] = []
    raw_pointer = {
        "observation": VALID_POINTER["observation"],
        "verification_action": VALID_POINTER["verification_action"],
        "referent_source": VALID_POINTER["referent_source"],
        "referent_capture_date": prompts.UNKNOWN_SENTINEL,
        "referent_authority": VALID_POINTER["referent_authority"],
        "referent_version": prompts.UNKNOWN_SENTINEL,
    }
    # All three must be dropped whole: exact forbidden key, near-miss verdict
    # freight in a nested value, and a near-miss forbidden key.
    bad_exact = dict(raw_pointer, verdict="fabricated")
    bad_nested_value = dict(raw_pointer,
                            observation={"text": "shoreline differs", "confidence_score": 0.93})
    bad_near_miss_key = dict(raw_pointer, assessment="almost certainly fabricated")

    def handler(request: httpx.Request) -> httpx.Response:
        hosts_hit.append(request.url.host)
        text = json.dumps({"pointers": [raw_pointer, bad_exact, bad_nested_value,
                                        bad_near_miss_key]})
        return httpx.Response(200, json=_vendor_reply(request.url.host, text))

    monkeypatch.setattr(lane, "settings", _stub_settings())
    real_client = httpx.AsyncClient

    class PatchedClient(real_client):
        def __init__(self, *a, **k):
            k.pop("transport", None)
            super().__init__(*a, transport=httpx.MockTransport(handler), **k)

    monkeypatch.setattr(lane.httpx, "AsyncClient", PatchedClient)
    try:
        ing = ingest(_png_bytes(), "test.png", "image/png")
        result = asyncio.run(lane.annotate(ing, "a caption"))
    finally:
        monkeypatch.setattr(lane.httpx, "AsyncClient", real_client)

    assert set(hosts_hit) <= ALLOWED_HOSTS and hosts_hit, "unexpected egress host"
    ptrs = result["annotation_pointers"]
    assert len(ptrs) == 3, "one valid pointer per model expected"
    for p in ptrs:
        assert validate_pointer(p) == []
        assert p["panel_version"] == PANEL_VERSION
        assert p["prompt_version"] == ANNOTATION_PROMPT_VERSION
        assert p["artefact_ref"].startswith("test.png/")
        assert p["pointer_id"].startswith("ptr-")
        assert p["emitted_by"] in {"claude-opus-4-8", "gpt-5.5", "gemini-3.5-flash"}
    assert len({p["pointer_id"] for p in ptrs}) == len(ptrs), "pointer ids must be unique"
    meta = result["annotation_meta"]
    assert meta["panel_version"] == PANEL_VERSION
    assert meta["prompt_version"] == ANNOTATION_PROMPT_VERSION
    assert any("9 source suggestion(s) failed validation" in n for n in meta["notes"]), \
        "all nine bad emissions (three kinds across three models) must be counted"
    assert not schema._forbidden_keys(result), "no forbidden key anywhere in lane output"


def test_lane_survives_non_dict_reply(monkeypatch):
    """A model replying with a top-level array or scalar is a malformed
    emission and a note, never a crash of the whole annotate() call."""
    from app.ingest import ingest

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_vendor_reply(request.url.host, "[1, 2, 3]"))

    monkeypatch.setattr(lane, "settings", _stub_settings())
    real_client = httpx.AsyncClient

    class PatchedClient(real_client):
        def __init__(self, *a, **k):
            k.pop("transport", None)
            super().__init__(*a, transport=httpx.MockTransport(handler), **k)

    monkeypatch.setattr(lane.httpx, "AsyncClient", PatchedClient)
    try:
        ing = ingest(_png_bytes(), "test.png", "image/png")
        result = asyncio.run(lane.annotate(ing, ""))
    finally:
        monkeypatch.setattr(lane.httpx, "AsyncClient", real_client)
    assert result["annotation_pointers"] == []
    assert sum("no pointers list" in n for n in result["annotation_meta"]["notes"]) == 3


def test_lane_source_declares_no_new_hosts():
    src = (REPO / "app" / "annotation" / "lane.py").read_text()
    hosts = set(re.findall(r"https://([a-z0-9.\-]+)", src))
    assert hosts <= ALLOWED_HOSTS
    assert "import requests" not in src and "urllib" not in src


# ── Deep-pass carry ───────────────────────────────────────────────────────────

def test_carry_preserves_annotation_fields():
    prior = {
        "annotation_pointers": [dict(VALID_POINTER)],
        "annotation_checks": [],
        "annotation_meta": {"panel_version": PANEL_VERSION},
        "second_opinion_gemini": "note",
        "unrelated": 1,
    }
    merged: dict = {}
    _carry_researcher_fields(prior, merged)
    assert set(merged) == {"annotation_pointers", "annotation_checks",
                           "annotation_meta", "second_opinion_gemini"}


# ── Export parity (Phase 2) ───────────────────────────────────────────────────

def _flagship():
    rows = [ProviderResult("fixture", "Fixture model", Kind.VISION, rating=50)]
    return {
        "meta": {"tool": "SDA Vision", "version": "test", "filename": "fixture.pdf",
                 "kind": "pdf", "frame_count": 0, "frames_found": 0, "notes": [],
                 "models": [], "generated_at": "2026-09-19T00:00:00Z"},
        "consensus": aggregate(rows, "", "general"),
        "providers": [r.to_dict() for r in rows],
        "frames": [],
    }


def _csv_rows_parsed(text):
    import csv as csvmod
    import io as iomod
    return list(csvmod.reader(iomod.StringIO(text)))


def test_exports_render_pointers_and_checks_at_parity(tmp_path):
    import copy
    from app.export import build_csv, build_markdown, build_pdf, build_pptx
    r = copy.deepcopy(_flagship())
    r["annotation_pointers"] = [dict(VALID_POINTER)]
    r["annotation_checks"] = [{
        "pointer_id": VALID_POINTER["pointer_id"], "checked_by": "S. Martin",
        "checked_at": "2026-08-01T10:05:00+00:00", "outcome": "not_verified",
        "referent_consulted": "OS OpenData 2026-1",
        "note": "Depicted structures are absent from the referent."}]
    r["annotation_meta"] = {"panel_version": PANEL_VERSION,
                            "prompt_version": ANNOTATION_PROMPT_VERSION,
                            "emitted_at": "2026-08-01T10:00:00+00:00",
                            "models": ["claude-opus-4-8"], "notes": []}

    md = build_markdown(r)
    assert "## Suggested sources to check" in md
    assert "remain separate from the automated assessment" in md
    assert VALID_POINTER["observation"] in md
    assert "not_verified by S. Martin" in md
    assert VALID_POINTER["referent_authority"] in md

    rows = _csv_rows_parsed(build_csv(r))
    assert all(len(row) == len(rows[0]) for row in rows[1:]), "CSV rows must stay rectangular"
    kinds = {row[rows[0].index("row_type")] for row in rows[1:]}
    assert {"pointer", "pointer_check"} <= kinds
    verdict_col = rows[0].index("provider_verdict")
    for row in rows[1:]:
        if row[rows[0].index("row_type")] in ("pointer", "pointer_check"):
            assert row[verdict_col] == "", "pointer rows must never carry a verdict"

    assert len(build_pptx(r, None)) > 0
    pdf_bytes = build_pdf(r, None)
    assert len(pdf_bytes) > 0
    # Version-field parity in the PDF, extracted as text where poppler exists
    # (found by the Phase 2 review: the PDF omitted the versions entirely).
    import shutil
    import subprocess
    if shutil.which("pdftotext"):
        pdf_path = tmp_path / "annotated.pdf"
        pdf_path.write_bytes(pdf_bytes)
        text = subprocess.run(["pdftotext", str(pdf_path), "-"],
                              capture_output=True, text=True).stdout
        assert PANEL_VERSION in text
        assert ANNOTATION_PROMPT_VERSION in text
        assert "No human check recorded." not in text  # the one check is rendered


def test_exports_unchanged_for_records_without_annotation():
    from app.export import build_csv, build_markdown
    old = _flagship()
    assert "Suggested sources to check" not in build_markdown(old)
    rows = _csv_rows_parsed(build_csv(old))
    assert all(len(row) == len(rows[0]) for row in rows[1:])
    assert not any(row[rows[0].index("row_type")] in ("pointer", "pointer_check")
                   for row in rows[1:])
