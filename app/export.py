"""Render an analysis report into shareable formats: Markdown, CSV, PPTX, PDF.

All inputs are the report dict the API already returns, so exports work with no
extra state. Every format mirrors the web view (score, per-frame breakdown,
ingestion metadata, per-provider models, decision trace, supporting /
not-deciding signal lists, full disclaimer); batch exports also embed the
relationship graph. Verdict/aggregation logic is never touched here - this
module only serialises what the pipeline already computed.
"""
from __future__ import annotations

import base64
import csv
import io

from .audio import inspection_lines
from .citation import citation_rows


def _audio_sections(report: dict) -> list[tuple[str, list[str]]]:
    sections = []
    inspection = report.get("audio_inspection")
    if inspection:
        sections.append(("Local soundtrack inspection", inspection_lines(inspection)))
    elif report.get("meta", {}).get("kind") in {"video", "audio"}:
        sections.append(("Local soundtrack inspection", ["Not recorded in this older report."]))
    assessment = report.get("audio_assessment")
    if assessment:
        sections.append(("Optional audio excerpt description", [
            f"{assessment['provider']} / {assessment['model']}; status: {assessment['status']}; content: {assessment['content_type']}.",
            f"Checked: {assessment['checked_at']}; consent to Google recorded: {assessment['consent_to_google']}.",
            f"Track {assessment['track_index']}; excerpt {assessment['start_seconds']}s + {assessment['duration_seconds']}s; prompt: {assessment['prompt_version']}.",
            f"Original SHA-256: {assessment['input_sha256']}; excerpt SHA-256: {assessment['excerpt_sha256']}.",
            *assessment["observations"],
            f"Transcript excerpt: {assessment['transcript_excerpt'] or '(none)'}", *assessment["limitations"],
            "Audio findings are shown alongside the visual assessment and remain separate from its score.",
        ]))
    check = report.get("suno_check")
    if check:
        sections.append(("Optional Suno vendor check", [
            f"Status: {check['status']}; vendor-reported verdict: {check['verdict'] or 'not returned'}; HTTP: {check['http_status']}.",
            f"Checked: {check['checked_at']}; consent to Suno recorded: {check['consent_to_suno']}; submitted original: {check['submitted_original']}.",
            f"Endpoint: {check['endpoint']}", f"Original SHA-256: {check['input_sha256']}",
            f"Response SHA-256: {check['response_sha256'] or 'not available'}; structured vendor response retained in JSON when recognised.",
            check["note"],
        ]))
    if report.get("meta", {}).get("kind") in {"video", "audio"}:
        sections.append(("Assessment coverage", [
            "Visual verdicts for videos cover the sampled still frames. Standalone-audio content assessments cover the transcript. Soundtrack-origin detection and continuous-motion analysis are outside these assessments.",
            "Original-file credentials, excerpt descriptions and visual interpretation are recorded separately. Credential coverage of an individual audio track remains unresolved by this workflow.",
        ]))
    return sections

# The standing disclaimer, in full. Exports carry all three sentences.
def visible_text_label(kind: str) -> str:
    """What the text block IS per input kind - a podcast transcript is not
    'visible text', and a reviewer will notice."""
    return {"audio": "Transcribed text", "text": "Text content",
            "pdf": "Extracted text", "pptx": "Extracted text"}.get(kind, "Visible text")


FULL_DISCLAIMER = ("Research assessment. Review alongside source information and context. "
                   "When credentials are missing, origin remains unresolved by this check. "
                   "Use these findings to inform a documented human review.")

SESSION_SCOPE = ("Session details record the researcher's account of how the note was obtained. "
                 "They are retained for audit and excluded from automated corroboration.")


def _verdict(v: str) -> str:
    return (v or "").replace("_", " ")


def _score(c: dict) -> str:
    r = c.get("overall_rating")
    return f"{r}/100" if r is not None else "n/a"


def _score_basis(report: dict) -> str:
    """Describe the recorded calculation, including unchanged legacy reports."""
    c = report.get("consensus", {})
    basis = c.get("score_basis")
    if basis == "provenance_declaration":
        return "trusted provenance declaration; no numeric probability"
    if c.get("overall_rating") is None:
        return "no numeric score"
    trace = c.get("decision_trace") or []
    if any(s.get("step") == "override" and s.get("outcome") != "none" for s in trace):
        return "legacy fixed provenance/watermark score; not a calibrated probability"
    if basis == "mean_frame_ratings" or any(s.get("step") == "frame_agreement" for s in trace):
        return "rounded mean of available frame scores; not a calibrated probability"
    if basis == "median_model_ratings" or any(s.get("step") == "model_agreement" for s in trace):
        return "median of available model ratings; not a calibrated probability"
    return "Calculation method unavailable in this report. Not a calibrated probability."


def _cap(s: str) -> str:
    """Match the UI's evidence capitalisation."""
    return s[0].upper() + s[1:] if s and s[0].isalpha() else s


def _evidence(p: dict, limit: int = 5) -> list[str]:
    """Per-provider key evidence, capitalised like the UI, falling back to the
    summary when a provider returned no bullets."""
    ev = [_cap(e) for e in (p.get("evidence") or [])]
    if p.get("id") == "c2pa":
        # Trust caveats and ingredient scope must survive every export format.
        summary = (p.get("summary") or "").strip()
        return list(dict.fromkeys(([_cap(summary)] if summary else []) + ev))
    ev = ev[:limit]
    if not ev and (p.get("summary") or "").strip():
        ev = [_cap(p["summary"].strip())]
    return ev


def _frames(report: dict) -> list[dict]:
    """Per-frame consensus rows (label, verdict, rating). Empty for plain images."""
    frames = report.get("frames") or []
    if len(frames) < 2 and report.get("meta", {}).get("kind") == "image":
        return []
    return frames


def _ingest_summary(m: dict) -> str:
    n = m.get("frame_count", 0)
    frames = f"{n} frame(s) analysed"
    # Partial coverage must be visible in every export, not just the web view:
    # a capped first pass is a sample, never whole-document coverage.
    found = m.get("frames_found") or 0
    if found and found > n:
        frames += f" of {found} found"
    return " - ".join([f"{m.get('kind', 'file')}", frames])


def _decisive(name: str, c: dict) -> str:
    """Whether this provider's signal supported the verdict or did not decide it."""
    if any(e.get("name") == name for e in c.get("supporting", [])):
        return "supporting"
    if any(e.get("name") == name for e in c.get("not_decisive", [])):
        return "not_decisive"
    return ""


# Pasted second-opinion notes, tagged by the LLM they came from. Each carries an
# optional Haiku-distilled one-line read and synthetic score, plus a tri-state
# fresh-session attestation. The raw note passes through verbatim (whitespace
# strip only) into every format, so any later correction can be traced to the
# item it concerned.
_SECOND_OPINION_FIELDS = [
    ("gemini", "Gemini SynthID"),
    ("chatgpt", "OpenAI second opinion"),
]


def _second_opinions(report: dict) -> list[dict]:
    out = []
    for key, label in _SECOND_OPINION_FIELDS:
        text = (report.get(f"second_opinion_{key}") or "").strip()
        if not text:
            continue
        score = report.get(f"second_opinion_{key}_score")
        fresh = report.get(f"second_opinion_{key}_fresh_session")
        out.append({
            "label": label,
            "text": text,
            "read": (report.get(f"second_opinion_{key}_read") or "").strip(),
            "score": score if isinstance(score, (int, float)) else None,
            "fresh": fresh if isinstance(fresh, bool) else None,
        })
    return out


def _read_line(op: dict) -> str:
    """Tagged one-line summary, e.g. 'likely synthetic (synthetic score ~80/100)'."""
    bits = []
    if op["read"]:
        bits.append(op["read"])
    if op["score"] is not None:
        bits.append(f"synthetic score ~{op['score']}/100")
    return " - ".join(bits)


# Annotation lane (pointer-not-verdict): checkable pointers plus the human's
# auditable check records, rendered at parity in every format. No verdict,
# probability or confidence exists in this data (the lane's validator rejects
# them), and nothing here feeds the aggregation.
_ANNOTATION_LABEL = ("Suggested sources to support your review. Check the publisher, date, version "
                     "and relevance to the claim, then record what you found. These notes remain "
                     "separate from the automated assessment.")


def _annotation(report: dict):
    pointers = [p for p in (report.get("annotation_pointers") or []) if isinstance(p, dict)]
    checks = {c.get("pointer_id"): c for c in (report.get("annotation_checks") or [])
              if isinstance(c, dict)}
    meta = report.get("annotation_meta")
    return pointers, checks, meta if isinstance(meta, dict) else {}


def _check_line(check: dict | None) -> str:
    if not check:
        return "No human check recorded."
    return (f"{check.get('outcome', '')} by {check.get('checked_by', '')} at "
            f"{check.get('checked_at', '')} against {check.get('referent_consulted', '')} - "
            f"{check.get('note', '')}")


def _pointer_referent(p: dict) -> str:
    return (f"Source: {p.get('referent_source', '')} - captured "
            f"{p.get('referent_capture_date', '')} - {p.get('referent_authority', '')} - "
            f"{p.get('referent_version', '')}")


def _fresh_label(fresh) -> str:
    """Tri-state fresh-session attestation for a pasted note.

    Absence renders as "not attested", never as "stale" and never as "fresh":
    an unticked attestation is not evidence of contamination, exactly as an
    unsampled frame is unexamined and an absent credential is not authenticity.
    Researcher-reported provenance of the note; never counted as corroboration.
    """
    if fresh is True:
        return "fresh session (attested)"
    if fresh is False:
        return "not a fresh session (researcher stated)"
    return "not attested"


def _decode_image(image_b64: str | None) -> bytes | None:
    """Accept a base64 string (with or without a data: URL prefix)."""
    if not image_b64:
        return None
    try:
        return base64.b64decode(image_b64.split(",")[-1])
    except Exception:
        return None


def _image_size(raw: bytes) -> tuple[int, int]:
    from PIL import Image
    with Image.open(io.BytesIO(raw)) as im:
        return im.size


# ── Batch relationship graph (embedded in batch exports) ─────────────────────
def _batch_graph(reports: list[dict]):
    """Build the same similarity graph the app shows for a batch. None if < 2."""
    if len(reports) < 2:
        return None
    try:
        from . import diffusion
        g = diffusion.build(diffusion.from_reports(reports), edge_mode="attributes")
        return g
    except Exception:
        return None


def _graph_png(g) -> bytes | None:
    import tempfile
    from pathlib import Path
    from . import diffusion
    try:
        with tempfile.TemporaryDirectory() as td:
            out = Path(td) / "graph.png"
            diffusion.render_png(g, out, anonymise=False, labels=True)
            return out.read_bytes()
    except Exception:
        return None


def _graph_stats_line(g) -> str:
    import networkx as nx
    comps = list(nx.connected_components(g))
    return (f"{g.number_of_nodes()} items, {g.number_of_edges()} links, "
            f"{sum(1 for c in comps if len(c) >= 2)} connected group(s). "
            "Lines connect items with similar verdict and synthetic rating; "
            "this is a similarity map. Distribution history: not assessed.")


# ── Markdown ──────────────────────────────────────────────────────────────────
def build_markdown(report: dict) -> str:
    c = report["consensus"]
    m = report["meta"]
    provs = report["providers"]
    lines = [
        f"# {m['tool']} analysis",
        "",
        f"- **File:** {m['filename']}",
        f"- **Tool version:** {m.get('version', '')}",
        f"- **Verdict:** {_verdict(c.get('overall_verdict', 'inconclusive'))} (confidence {c.get('confidence', '-')})",
        f"- **Indicative score:** {_score(c)} ({_score_basis(report)})",
        f"- **Method version:** {m.get('method_version', 'legacy - not recorded')}",
        f"- **Input SHA-256:** {m.get('input_sha256', 'not recorded')}",
        f"- **Headline:** {c.get('headline', '')}",
        f"- **Input:** {_ingest_summary(m)}",
        f"- **Generated:** {m['generated_at']}",
        f"- **Models:** {', '.join(m.get('models', [])) or 'none'}",
        "",
        f"> {c.get('explanation', '')}",
        "",
        f"**{FULL_DISCLAIMER}**",
    ]

    lines += ["", "## Cite this analysis", ""] + [f"{label}: {text}" for label, text in citation_rows(m)]

    notes = m.get("notes") or []
    if notes:
        lines += ["", "## How the file was read", ""]
        lines += [f"- {n}" for n in notes]

    for title, entries in _audio_sections(report):
        lines += ["", f"## {title}", ""] + [f"- {entry}" for entry in entries]

    frames = _frames(report)
    if frames:
        lines += ["", "## Per-frame breakdown", "",
                  "| Frame | Verdict | Rating |", "|---|---|---|"]
        for f in frames:
            r = "" if f.get("rating") is None else f["rating"]
            lines.append(f"| {f['frame']} | {_verdict(f.get('verdict'))} | {r} |")
        lines += ["", "_Frames can disagree; review them individually rather than "
                      "treating the document as one number._"]

    lines += ["", "## Provider ratings", "",
              "| Provider | Model | Type | Status | Verdict | Rating | Confidence | Signal |",
              "|---|---|---|---|---|---|---|---|"]
    for p in provs:
        rating = "" if p["rating"] is None else p["rating"]
        flag = {"supporting": "supporting", "not_decisive": "additional"}.get(_decisive(p["name"], c), "-")
        lines.append(
            f"| {p['name']} | {p.get('model') or '-'} | {p['kind']} | {p['status']} "
            f"| {_verdict(p['verdict'])} | {rating} | {p['confidence'] or '-'} | {flag} |"
        )

    lines += ["", "## Key evidence per provider", ""]
    for p in provs:
        ev = _evidence(p)
        if not ev:
            continue
        lines.append(f"- **{p['name']}**:")
        lines += [f"  - {e}" for e in ev]

    lines += ["", "## Evidence supporting this verdict", ""]
    lines += [f"- **{e['name']}** ({e['rating'] if e['rating'] is not None else _verdict(e['verdict'])}): {e['note']}"
              for e in c.get("supporting", [])] or ["- (none)"]

    lines += ["", "## Additional findings", "", "Shown separately from the combined assessment.", ""]
    lines += [f"- **{e['name']}**: {e['note']}" for e in c.get("not_decisive", [])] or ["- (none)"]

    if c.get("visible_text"):
        lines += ["", f"## {visible_text_label(m.get('kind', ''))}", "", "```", c["visible_text"], "```"]

    if c.get("vaccine_codes"):
        lines += ["", "## Vaccine research codes", "", ", ".join(c["vaccine_codes"])]

    opinions = _second_opinions(report)
    if opinions:
        lines += ["", "## Second-opinion notes (pasted by the researcher)", "", SESSION_SCOPE]
        for op in opinions:
            lines += ["", f"### {op['label']}"]
            read = _read_line(op)
            if read:
                lines += ["", f"**Read: {read}**"]
            lines += ["", f"*Session: {_fresh_label(op['fresh'])}.*"]
            lines += ["", op["text"]]

    pointers, p_checks, a_meta = _annotation(report)
    if pointers:
        lines += ["", "## Suggested sources to check", "", f"*{_ANNOTATION_LABEL}*"]
        if a_meta:
            lines += ["", f"{a_meta.get('panel_version', '')} - {a_meta.get('prompt_version', '')} "
                          f"- emitted {a_meta.get('emitted_at', '')}"]
        for p in pointers:
            lines += ["", f"### {p.get('pointer_id', '')} ({p.get('emitted_by', '')} - "
                          f"{p.get('artefact_ref', '')})"]
            lines += ["", p.get("observation", "")]
            lines += ["", f"**{p.get('verification_action', '')}**"]
            lines += ["", _pointer_referent(p)]
            lines += ["", f"Check: {_check_line(p_checks.get(p.get('pointer_id')))}"]

    lines += ["", "## How this assessment was reached", ""]
    lines += [f"{i + 1}. `{s.get('step')}` {(_trace_detail(s))}" for i, s in enumerate(c.get("decision_trace", []))]
    lines += [""]
    return "\n".join(lines)


def _trace_detail(step: dict) -> str:
    parts = [f"{k}={v}" for k, v in step.items() if k != "step"]
    return "; ".join(str(p) for p in parts)


def build_batch_markdown(reports: list[dict]) -> str:
    body = "\n\n---\n\n".join(build_markdown(r) for r in reports)
    g = _batch_graph(reports)
    if g is not None:
        section = ["", "---", "", "# Relationship graph across this batch", "",
                   _graph_stats_line(g), ""]
        png = _graph_png(g)
        if png:
            b64 = base64.b64encode(png).decode()
            section += [f"![Relationship graph](data:image/png;base64,{b64})", ""]
        body += "\n".join(section)
    return body


# ── CSV ───────────────────────────────────────────────────────────────────────
_CSV_HEADER = [
    "filename", "tool", "version", "generated_at",
    "input_kind", "frames_analysed", "frames_found", "ingest_notes",
    "overall_verdict", "overall_confidence", "overall_rating", "agreement",
    "row_type", "provider", "provider_type", "provider_status", "provider_verdict",
    "provider_rating", "provider_confidence", "provider_model", "decisive", "key_evidence",
    "second_opinion_gemini", "second_opinion_gemini_read", "second_opinion_gemini_score",
    "second_opinion_gemini_fresh_session",
    "second_opinion_chatgpt", "second_opinion_chatgpt_read", "second_opinion_chatgpt_score",
    "second_opinion_chatgpt_fresh_session",
    "record_note",
    "score_basis", "method_version", "input_sha256", "report_id",
]


def _csv_rows(report: dict):
    c, m = report["consensus"], report["meta"]
    so_gem = (report.get("second_opinion_gemini") or "").replace("\n", " ").strip()
    so_gpt = (report.get("second_opinion_chatgpt") or "").replace("\n", " ").strip()
    gem_score = report.get("second_opinion_gemini_score")
    gpt_score = report.get("second_opinion_chatgpt_score")
    file_cols = [m["filename"], m["tool"], m["version"], m["generated_at"],
                 m.get("kind", ""), m.get("frame_count", ""), m.get("frames_found", ""),
                 " | ".join(m.get("notes") or []),
                 c.get("overall_verdict", ""), c.get("confidence", ""),
                 c.get("overall_rating", ""), c.get("agreement", "")]
    # Attestation cells are only meaningful beside a note: an empty cell for a
    # record with no note, the tri-state label otherwise.
    gem_fresh = report.get("second_opinion_gemini_fresh_session")
    gpt_fresh = report.get("second_opinion_chatgpt_fresh_session")
    so_cols = [so_gem, (report.get("second_opinion_gemini_read") or "").strip(),
               "" if gem_score is None else gem_score,
               _fresh_label(gem_fresh if isinstance(gem_fresh, bool) else None) if so_gem else "",
               so_gpt, (report.get("second_opinion_chatgpt_read") or "").strip(),
               "" if gpt_score is None else gpt_score,
               _fresh_label(gpt_fresh if isinstance(gpt_fresh, bool) else None) if so_gpt else "",
               FULL_DISCLAIMER + " " + " ".join(f"{label}: {text}" for label, text in citation_rows(m)),
               _score_basis(report), m.get("method_version", ""), m.get("input_sha256", ""),
               m.get("report_id", "")]
    for p in report["providers"]:
        yield file_cols + [
            "provider", p["name"], p["kind"], p["status"], p["verdict"],
            "" if p["rating"] is None else p["rating"], p["confidence"] or "",
            p["model"] or "", _decisive(p["name"], c),
            " | ".join(_evidence(p)),
        ] + so_cols
    # One row per frame so multi-frame divergence survives into spreadsheets.
    for f in _frames(report):
        yield file_cols + [
            "frame", f["frame"], "frame_consensus", "", f.get("verdict") or "",
            "" if f.get("rating") is None else f["rating"], "", "", "", "",
        ] + so_cols
    for title, entries in _audio_sections(report):
        yield file_cols + ["audio_context", title, "separate_observation", "", "", "", "", "", "not_decisive",
                           " | ".join(entries)] + so_cols
    # Annotation lane: one row per pointer and one per recorded human check.
    # The provider_verdict column stays empty by design (pointers never carry
    # one); the check row's outcome is the human's audit outcome and lives in
    # key_evidence with the rest of the check record.
    pointers, p_checks, _ = _annotation(report)
    for p in pointers:
        yield file_cols + [
            "pointer", p.get("pointer_id", ""), "annotation", "", "",
            "", "", p.get("emitted_by", ""), "",
            " | ".join([p.get("observation", ""), p.get("verification_action", ""),
                        _pointer_referent(p),
                        f"{p.get('panel_version', '')}/{p.get('prompt_version', '')}",
                        ]).replace("\n", " "),
        ] + so_cols
        c = p_checks.get(p.get("pointer_id"))
        if c:
            yield file_cols + [
                "pointer_check", p.get("pointer_id", ""), "annotation_check", "", "",
                "", "", c.get("checked_by", ""), "",
                " | ".join([f"outcome: {c.get('outcome', '')}",
                            f"checked_at: {c.get('checked_at', '')}",
                            f"referent_consulted: {c.get('referent_consulted', '')}",
                            c.get("note", "")]).replace("\n", " "),
            ] + so_cols


def build_csv(report: dict) -> str:
    """One row per provider and per frame, each self-contained with file-level
    metadata so many analyses can be concatenated into a single sheet."""
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(_CSV_HEADER)
    for row in _csv_rows(report):
        w.writerow(row)
    return out.getvalue()


def build_batch_csv(reports: list[dict]) -> str:
    """All analyses in one sheet, one row per provider/frame per file, plus the
    batch relationship graph appended as commented node/edge sections."""
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow(_CSV_HEADER)
    for report in reports:
        for row in _csv_rows(report):
            w.writerow(row)
    g = _batch_graph(reports)
    if g is not None:
        out.write("\n# relationship graph - nodes\n")
        w.writerow(["# id", "label", "verdict", "rating", "cluster", "community",
                    "degree", "betweenness"])
        for n, d in g.nodes(data=True):
            w.writerow([n, d.get("label", ""), d.get("verdict"), d.get("rating"),
                        d.get("cluster"), d.get("community"), g.degree(n),
                        d.get("betweenness", 0.0)])
        out.write("# relationship graph - edges\n")
        w.writerow(["# source", "target", "weight", "kind"])
        for u, v, d in g.edges(data=True):
            w.writerow([u, v, d.get("weight"), d.get("kind", d.get("variant_type", ""))])
    return out.getvalue()


# ── PPTX ──────────────────────────────────────────────────────────────────────
def _report_sections(report: dict) -> list[dict]:
    """Organise recorded content without changing scores or interpreting notes."""
    c, m = report["consensus"], report["meta"]
    sections = []

    def section(title, rows, headers=("Field", "Recorded detail"), widths=(.27, .73)):
        sections.append({"title": title, "headers": list(headers), "widths": widths,
                         "rows": [[str(v) if v is not None else "Not recorded" for v in row]
                                  for row in rows] or [["Record", "No entries recorded."]]})

    section("Assessment summary", [
        ("Finding", c.get("headline") or _verdict(c.get("overall_verdict", "inconclusive"))),
        ("Recorded verdict", _verdict(c.get("overall_verdict", "inconclusive"))),
        ("Confidence", c.get("confidence") or "Not recorded"),
        ("Indicative rating", _score(c)), ("Rating basis", _score_basis(report)),
        ("Explanation", c.get("explanation", "")), ("Coverage", _ingest_summary(m)),
        ("Review context", FULL_DISCLAIMER),
    ])
    providers = report.get("providers", [])
    if providers:
        section("Provider overview", [
            (p["name"], f'{p.get("kind", "")} / {p.get("status", "")}',
             _verdict(p.get("verdict", "")),
             "n/a" if p.get("rating") is None else f'{p["rating"]}/100')
            for p in providers
        ], ("Provider", "Type / status", "Assessment", "Rating"), (.32, .22, .30, .16))
    for index, p in enumerate(providers, 1):
        rows = [("Provider", p["name"]), ("Model", p.get("model") or "Not recorded"),
                ("Status", p.get("status", "")), ("Assessment", _verdict(p.get("verdict", ""))),
                ("Confidence", p.get("confidence") or "Not recorded"),
                ("Role in assessment", {"supporting": "Supporting", "not_decisive": "Additional finding"}.get(_decisive(p["name"], c), "Not listed")),
                ("Provider summary", p.get("summary") or "No summary recorded.")]
        # All supplied evidence is visible, including credentials, failures and scope.
        rows += [(f"Evidence {i}", value) for i, value in enumerate(p.get("evidence") or [], 1)]
        section("Content Credentials / provenance" if p.get("id") == "c2pa" else f"Provider evidence / {index}", rows)
    frames = _frames(report)
    if frames:
        section("Per-frame results", [(f["frame"], _verdict(f.get("verdict", "inconclusive")),
                                      "n/a" if f.get("rating") is None else str(f["rating"])) for f in frames],
                ("Frame", "Assessment", "Rating / 100"), (.28, .52, .20))
    for title, entries in _audio_sections(report):
        section(title, [(f"Record {i}", entry) for i, entry in enumerate(entries, 1)])
    for key, title in (("supporting", "Evidence supporting this verdict"), ("not_decisive", "Additional findings")):
        rows = []
        for e in c.get(key, []):
            rows.append((e["name"], e.get("note", "")))
        section(title, rows or [("Record", "No entries recorded.")])
    for op in _second_opinions(report):
        rows = [("Record type", "Second-opinion note pasted by the researcher"),
                ("Session", _fresh_label(op["fresh"])), ("Session scope", SESSION_SCOPE)]
        if _read_line(op):
            rows.append(("Optional scored read", _read_line(op)))
        rows.append(("Full pasted note", op["text"]))
        section(op["label"], rows)
    pointers, checks, a_meta = _annotation(report)
    if pointers:
        section("Suggested sources to check", [("How to use these records", _ANNOTATION_LABEL),
            ("Panel", a_meta.get("panel_version", "")), ("Prompt", a_meta.get("prompt_version", "")),
            ("Emitted", a_meta.get("emitted_at", ""))])
        for i, p in enumerate(pointers, 1):
            section(f"Source check / {i}", [
                ("Pointer ID", p.get("pointer_id", "")), ("Provider", p.get("emitted_by", "")),
                ("Item reference", p.get("artefact_ref", "")), ("Observation", p.get("observation", "")),
                ("Suggested action", p.get("verification_action", "")),
                ("Source record", _pointer_referent(p)),
                ("Versions", f'{p.get("panel_version", "")}/{p.get("prompt_version", "")}'),
                ("Emitted", p.get("emitted_at", "")),
                ("Human check", _check_line(checks.get(p.get("pointer_id")))),
            ])
    if c.get("visible_text"):
        section(visible_text_label(m.get("kind", "")), [("Recorded text", c["visible_text"])])
    if c.get("decision_trace"):
        section("How this assessment was reached",
                [(f'{i}. {st.get("step", "")}', _trace_detail(st)) for i, st in enumerate(c["decision_trace"], 1)])
    section("Cite this analysis", citation_rows(m))
    section("File and analysis record", [
        ("File", m["filename"]), ("Analysis ID", m.get("report_id", "Not recorded")),
        ("Generated", m.get("generated_at", "")), ("Tool", f'{m.get("tool", "SDA Vision")} {m.get("version", "")}'),
        ("Models", ", ".join(m.get("models", [])) or "Not recorded"),
        ("Method version", m.get("method_version", "Legacy - not recorded")),
        ("Analysis lens", m.get("mode", "Not recorded")),
        ("Original SHA-256", m.get("input_sha256", "Not recorded")),
        *[(f"Ingestion note {i}", note) for i, note in enumerate(m.get("notes") or [], 1)],
    ])
    return sections


def _pptx_add_report(prs, report: dict, image_b64: str | None = None) -> None:
    from .report_layout import add_pptx_sections
    scope = "Research assessment. Ratings are not calibrated probabilities."
    if report["meta"].get("kind") in {"video", "audio"}:
        scope += " Acoustic AI-origin detection: outside scope."
    add_pptx_sections(prs, _report_sections(report), report["meta"]["filename"], scope, _decode_image(image_b64))


def _pptx_add_graph_slide(prs, g) -> None:
    from pptx.util import Inches, Pt
    png = _graph_png(g)
    if not png:
        return
    s = prs.slides.add_slide(prs.slide_layouts[6])
    box = s.shapes.add_textbox(Inches(0.4), Inches(0.2), Inches(9.3), Inches(0.5))
    box.text_frame.text = "Relationship graph across this batch"
    box.text_frame.paragraphs[0].font.size = Pt(16)
    box.text_frame.paragraphs[0].font.bold = True
    try:
        w, h = _image_size(png)
        iw = Inches(9.0)
        ih = Inches(9.0 * h / w)
        if ih > Inches(5.6):
            ih, iw = Inches(5.6), Inches(5.6 * w / h)
        s.shapes.add_picture(io.BytesIO(png), Inches(0.5), Inches(0.85), width=iw, height=ih)
    except Exception:
        return
    cap = s.shapes.add_textbox(Inches(0.4), Inches(6.6), Inches(9.3), Inches(0.7))
    cap.text_frame.word_wrap = True
    cap.text_frame.text = _graph_stats_line(g)
    cap.text_frame.paragraphs[0].font.size = Pt(9)


def build_pptx(report: dict, image_b64: str | None = None) -> bytes:
    from pptx import Presentation
    prs = Presentation()
    _pptx_add_report(prs, report, image_b64)
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


def build_batch_pptx(items: list[dict]) -> bytes:
    from pptx import Presentation
    prs = Presentation()
    for it in items:
        _pptx_add_report(prs, it["report"], it.get("image"))
    g = _batch_graph([it["report"] for it in items])
    if g is not None:
        _pptx_add_graph_slide(prs, g)
    buf = io.BytesIO()
    prs.save(buf)
    return buf.getvalue()


# ── PDF (reportlab) ───────────────────────────────────────────────────────────
def _esc(s: str) -> str:
    from xml.sax.saxutils import escape
    return escape(str(s or ""))


def _pdf_flowables(report: dict, image_b64: str | None, styles) -> list:
    from .report_layout import pdf_sections
    return pdf_sections(_report_sections(report), report["meta"]["filename"],
                        report["meta"].get("tool", "SDA Vision"), _decode_image(image_b64))


def _pdf_doc(buf):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate
    return SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
                             leftMargin=1.5 * cm, rightMargin=1.5 * cm)


def build_pdf(report: dict, image_b64: str | None = None) -> bytes:
    from reportlab.lib.styles import getSampleStyleSheet
    from .report_layout import pdf_page
    buf = io.BytesIO()
    _pdf_doc(buf).build(_pdf_flowables(report, image_b64, getSampleStyleSheet()), onFirstPage=pdf_page, onLaterPages=pdf_page)
    return buf.getvalue()


def build_batch_pdf(items: list[dict]) -> bytes:
    from .report_layout import pdf_page
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Image as RLImage, PageBreak, Paragraph, Spacer
    styles = getSampleStyleSheet()
    story = []
    for i, it in enumerate(items):
        if i:
            story.append(PageBreak())
        story += _pdf_flowables(it["report"], it.get("image"), styles)
    g = _batch_graph([it["report"] for it in items])
    if g is not None:
        png = _graph_png(g)
        if png:
            story.append(PageBreak())
            story.append(Paragraph("<b>Relationship graph across this batch</b>", styles["Title"]))
            try:
                w, h = _image_size(png)
                iw = 17 * cm
                ih = 17 * cm * h / w
                if ih > 20 * cm:
                    ih, iw = 20 * cm, 20 * cm * w / h
                story += [RLImage(io.BytesIO(png), width=iw, height=ih), Spacer(1, 0.3 * cm)]
            except Exception:
                pass
            story.append(Paragraph(_esc(_graph_stats_line(g)), styles["Normal"]))
    buf = io.BytesIO()
    _pdf_doc(buf).build(story, onFirstPage=pdf_page, onLaterPages=pdf_page)
    return buf.getvalue()
