import copy
import csv
import io
import json
from pathlib import Path

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.external_checks import ExternalCheck, records
from app.request_validation import validate_report, validate_graph
from app.pipeline import _carry_researcher_fields
from app.export import build_markdown, build_csv, _report_sections
from app.diffusion import verdict_map, graph_for_payload, graph_to_json, csv_zip_bytes
from app.narrate import verdict_map_summary


def report():
    return json.loads((Path(__file__).parent / "fixtures/workshop-review/podcast.json").read_text())


def check(status="detected"):
    r = report()
    return dict(schema_version="external-check-v1", id="test-check", service="SynthID Detector",
                service_url="https://synthid.com/", entry_method="manual", status=status,
                checked_at="2026-10-11T12:00:00Z", recorded_at="2026-10-11T12:01:00Z", operator="Test operator",
                source_filename=r["meta"]["filename"], source_sha256=r["meta"]["input_sha256"],
                checked_filename="sample.m4a", checked_sha256=r["meta"]["input_sha256"], checked_bytes=1500,
                relationship="original", material_label="Complete original audio",
                reported_scope="Audio 00:10–00:20", reported_origin="Google AI" if status == "detected" else "",
                response="TEST FIXTURE: <script>no execution</script>\nFull exact reply END")


@pytest.mark.parametrize("status", ["detected", "not_detected", "inconclusive", "unsupported", "failed", "not_checked"])
def test_statuses_and_all_export_surfaces_preserve_scope_without_scores(status):
    r = report(); original = copy.deepcopy(r)
    r["external_checks"] = [check(status)]
    valid = validate_report(r)
    assert valid["consensus"] == validate_report(original)["consensus"]
    assert valid["providers"] == validate_report(original)["providers"]
    assert records(valid)[0]["status"] == status
    text = build_markdown(valid)
    assert "Full exact reply END" in text and "```text\nTEST FIXTURE: <script>" in text
    assert "Complete original audio" in text and "Audio 00:10–00:20" in text
    table = list(csv.DictReader(io.StringIO(build_csv(valid))))
    row = next(row for row in table if row["row_type"] == "external_check")
    assert row["provider_rating"] == row["provider_verdict"] == ""
    assert row["provider_status"] == status and row["decisive"] == "not_decisive"
    section = next(s for s in _report_sections(valid) if s["title"].startswith("External watermark"))
    assert any("Full exact reply END" in value for row in section["rows"] for value in row)
    g = verdict_map(valid)
    n = g.nodes["external_0"]
    assert n["rating"] == -1 and n["source"] == "observation" and n["verdict"] == "not_applicable"
    assert list(g.neighbors("external_0")) == ["item"]
    assert g.edges["item", "external_0"]["kind"] == "observation"
    assert "manual records of identified files" in verdict_map_summary(graph_to_json(g))["caption"]
    other = copy.deepcopy(original)
    other["meta"]["filename"] = "other-podcast.m4a"
    other["meta"]["input_sha256"] = "a" * 64
    batch = graph_to_json(graph_for_payload("batch", [valid, other]))
    assert "Full exact reply END" in batch["nodes"][0]["external_checks"]
    assert batch["nodes"][1]["external_checks"] == ""


@pytest.mark.parametrize("patch", [
    {"rating": 100}, {"entry_method": "verified_api"}, {"service_url": "https://unrelated.invalid"},
    {"checked_sha256": "bad"}, {"checked_at": "not a date"}, {"checked_at": "2026-10-11T12:00:00"},
    {"status": "pending"}, {"status": "detected", "response": ""},
    {"status": "failed", "reported_origin": "Google AI"},
    {"checked_sha256": "a" * 64, "relationship": "original"},
])
def test_reject_invalid_records(patch):
    with pytest.raises(ValidationError):
        ExternalCheck.model_validate(check() | patch)


def test_reject_wrong_parent_and_oversized_record_list():
    for entries in [[check() | {"source_sha256": "b" * 64, "relationship": "derived_image"}], [check()] * 31]:
        r = report() | {"external_checks": entries}
        with pytest.raises(HTTPException): validate_report(r)
        with pytest.raises(HTTPException): validate_graph({"source": "item", "reports": [r]})


def test_deep_pass_carries_records_and_legacy_reports_remain_valid():
    r = report(); assert records(r) == []
    assert validate_report(r)["external_checks"] == []
    r["external_checks"] = [check()]; fresh = report()
    original = copy.deepcopy(fresh["consensus"])
    _carry_researcher_fields(r, fresh)
    assert fresh["external_checks"] == r["external_checks"]
    assert fresh["consensus"] == original


def test_not_checked_can_have_no_reply():
    assert ExternalCheck.model_validate(check("not_checked") | {"response": ""}).response == ""
