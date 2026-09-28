import hashlib
import json

import pytest

from scripts import build_showcase


@pytest.mark.parametrize("matched", [True, False])
def test_workshop_starter_matches_artwork_and_stays_outside_menu_graph(tmp_path, monkeypatch, matched):
    monkeypatch.setattr(build_showcase, "ROOT", tmp_path)
    artwork = tmp_path / "frontend/src/assets/community-illustration.png"
    artwork.parent.mkdir(parents=True)
    artwork.write_bytes(b"approved artwork")
    digest = hashlib.sha256(artwork.read_bytes()).hexdigest()
    stage = tmp_path / "candidate"
    folder = stage / "showcase"
    (folder / "originals").mkdir(parents=True)
    (folder / "reports").mkdir()
    (folder / "originals/illustration-1.png").write_bytes(artwork.read_bytes() if matched else b"other image")
    entries = []
    for name in ["illustration-1.png", "podcast.m4a"]:
        rid = name.split(".")[0].replace("-", "_")
        report_path = f"reports/{rid}.json"
        (folder / report_path).write_text(json.dumps({"meta": {"filename": name, "input_sha256": digest}}))
        entries.append({"name": name, "sha256": digest, "report": report_path})
    manifest = folder / "manifest.json"
    manifest.write_text(json.dumps({"examples": entries}))
    report_path = folder / entries[0]["report"]
    original_report = report_path.read_bytes()
    graphs = []
    monkeypatch.setattr(build_showcase, "write_set_graph", lambda reports, out: graphs.append(reports))
    if matched:
        build_showcase.configure_workshop_starter(stage, "illustration-1.png")
        result = json.loads(manifest.read_text())
        assert [e["name"] for e in result["examples"]] == ["podcast.m4a"]
        assert result["workshop_starter"] == entries[0]
        assert [r["meta"]["filename"] for r in graphs[0]] == ["podcast.m4a"]
        assert report_path.read_bytes() == original_report
    else:
        with pytest.raises(ValueError, match="matching hashes"):
            build_showcase.configure_workshop_starter(stage, "illustration-1.png")
        assert json.loads(manifest.read_text()) == {"examples": entries}
        assert not graphs
