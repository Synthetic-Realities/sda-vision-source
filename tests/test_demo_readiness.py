from pathlib import Path

import pytest
from fastapi import HTTPException

from app.corpus import is_visible_corpus_rel
from app.narrate import graph_summary


def _graph(verdicts: list[str]) -> dict:
    return {
        "nodes": [
            {"verdict": v, "degree": 0, "betweenness": 0, "source": "01_camera"}
            for v in verdicts
        ],
        "stats": {"clusters": len(verdicts), "edges": 0},
    }


def test_corpus_visibility_only_exposes_numbered_label_folders():
    assert is_visible_corpus_rel(Path("01_camera_photos_with_provenance/example.jpg"))
    assert is_visible_corpus_rel(Path("13_synthetic_presentation_screenshots/example.png"))
    assert not is_visible_corpus_rel(Path("_notes/contact_sheet.jpg"))
    assert not is_visible_corpus_rel(Path("README.md"))


def test_corpus_summary_does_not_claim_a_model_ran():
    text = graph_summary(
        _graph(["synthetic_likely", "partially_synthetic", "authentic_likely", "inconclusive"]),
        source="corpus",
    )["paragraph"]
    assert "folder labels" in text
    assert "model rated" not in text.lower()


def test_safe_corpus_path_rejects_hidden_working_notes(monkeypatch, tmp_path):
    from app import main

    corpus = tmp_path / "corpus"
    notes = corpus / "_notes"
    label = corpus / "01_camera_photos_with_provenance"
    notes.mkdir(parents=True)
    label.mkdir()
    (notes / "contact_sheet.jpg").write_bytes(b"private")
    (label / "example.jpg").write_bytes(b"public")
    monkeypatch.setattr(main, "CORPUS_DIR", corpus)

    assert main._safe_corpus_path("01_camera_photos_with_provenance/example.jpg").read_bytes() == b"public"
    with pytest.raises(HTTPException):
        main._safe_corpus_path("_notes/contact_sheet.jpg")
