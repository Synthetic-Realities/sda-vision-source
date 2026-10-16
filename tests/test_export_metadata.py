import copy
import io
from datetime import datetime, timezone

import pytest
from pptx import Presentation
from pypdf import PdfReader

from app import export
from app.aggregate import aggregate


@pytest.mark.parametrize("batch", [False, True])
def test_generated_metadata_identifies_export_without_changing_analysis(batch, monkeypatch):
    monkeypatch.setattr(export, "_batch_graph", lambda reports: None)
    report = {
        "meta": {"tool": "SDA Vision", "version": "0.1.0",
                 "filename": "fixture.png", "generated_at": "2026-09-19",
                 "models": [], "notes": [], "kind": "image", "frame_count": 1},
        "providers": [], "consensus": aggregate([], "", "general"), "frames": [],
    }
    original = copy.deepcopy(report)
    before = datetime.now(timezone.utc).replace(microsecond=0)
    if batch:
        pptx = export.build_batch_pptx([{"report": report}])
        pdf = export.build_batch_pdf([{"report": report}])
    else:
        pptx = export.build_pptx(report)
        pdf = export.build_pdf(report)
    after = datetime.now(timezone.utc)
    expected = "SDA Vision: Batch analysis reports" if batch else "SDA Vision: Analysis report"
    deck = Presentation(io.BytesIO(pptx))
    core = deck.core_properties
    assert core.author == core.last_modified_by == "SDA Vision"
    assert core.title == expected
    assert core.revision == 1
    for stamp in (core.created, core.modified):
        assert before <= stamp.replace(tzinfo=timezone.utc) <= after
    reader = PdfReader(io.BytesIO(pdf))
    assert reader.metadata.author == reader.metadata.creator == "SDA Vision"
    assert reader.metadata.title == expected
    assert before <= reader.metadata.creation_date <= after
    assert "2026-09-19" in "\n".join(page.extract_text() for page in reader.pages)
    assert report == original
