import io
import json
import zipfile
from dataclasses import replace

import networkx as nx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import diffusion, main
from app.aggregate import aggregate, aggregate_frames
from app.schema import Kind, ProviderResult, Status, Verdict, verdict_from_rating


def record(sha=None):
    return {"meta": {"filename": "same.png", "input_sha256": sha},
            "consensus": {"overall_verdict": "inconclusive", "overall_rating": None},
            "providers": [{"id": "openai", "rating": 90}], "phashes": ["0" * 16]}


def test_graph_retains_distinct_bytes_and_legacy_records():
    records = [record("a" * 64), record("b" * 64), record("a" * 64), record(), record()]
    g = diffusion.graph_for_payload("batch", records)
    p = g.graph["population"]
    assert p["source_items"] == 5 and p["displayed_items"] == 4
    assert p["excluded_duplicates"] == 1
    assert all(d["rating"] == -1 for _, d in g.nodes(data=True))


def test_corpus_population_and_default_isolates(monkeypatch, tmp_path):
    folder = tmp_path / "01_camera"
    folder.mkdir()
    Image.new("RGB", (20, 20), "red").save(folder / "valid.png")
    (folder / "broken.png").write_bytes(b"not an image")
    (folder / "text.pdf").write_bytes(b"not opened by graph")
    monkeypatch.setattr(diffusion, "CORPUS_DIR", tmp_path)
    guard = Image.MAX_IMAGE_PIXELS
    g = diffusion.graph_for_payload("corpus", None)
    p = g.graph["population"]
    assert (p["source_items"], p["eligible_items"], p["displayed_items"]) == (3, 2, 1)
    assert p["excluded_unreadable"] == p["excluded_unsupported"] == p["isolated_displayed"] == 1
    assert Image.MAX_IMAGE_PIXELS == guard
    filtered = diffusion.graph_for_payload("corpus", None, min_component=2)
    assert filtered.number_of_nodes() == 0
    assert filtered.graph["population"]["excluded_by_filter"] == 1


def test_population_survives_all_graph_exports(tmp_path):
    g = diffusion.graph_for_payload("batch", [record("a" * 64)])
    p = g.graph["population"]
    assert diffusion.graph_to_json(g)["population"] == p
    with zipfile.ZipFile(io.BytesIO(diffusion.csv_zip_bytes(g))) as archive:
        assert json.loads(archive.read("population.json")) == p
    parsed = nx.read_gexf(io.BytesIO(diffusion.gexf_bytes(g)))
    assert json.loads(parsed.graph["name"].split(": ", 1)[1]) == p
    output = tmp_path / "graph.png"
    diffusion.render_png(g, output, False)
    with Image.open(output) as im:
        assert json.loads(im.info["sda_population"]) == p


@pytest.mark.parametrize("payload", [
    {"source": "unknown"}, {"threshold": "bad"}, {"threshold": 65},
    {"min_component": 0}, {"edge_mode": "invalid"},
    {"source": "item", "reports": []}, {"source": "item", "reports": [None]},
])
def test_malformed_graph_requests_are_controlled_errors(monkeypatch, payload):
    monkeypatch.setattr(main, "settings", replace(main.settings, dev_mode=True))
    with TestClient(main.app) as client:
        for route in ("", "/csv", "/gexf", "/png", "/summary"):
            assert client.post("/api/diffusion" + route, json=payload).status_code == 400


@pytest.mark.parametrize("rating", [0, 20, 45, 80, 100])
def test_one_model_cannot_decide_either_direction(rating):
    row = ProviderResult("test", "Test", Kind.VISION, Status.OK,
                         rating=rating, verdict=verdict_from_rating(rating))
    assert aggregate([row], "", "general")["overall_verdict"] == "inconclusive"


def test_forensics_cannot_break_model_disagreement():
    rows = [ProviderResult("a", "A", Kind.VISION, Status.OK, rating=90, verdict=Verdict.SYNTHETIC_LIKELY),
            ProviderResult("b", "B", Kind.VISION, Status.OK, rating=10, verdict=Verdict.AUTHENTIC_LIKELY),
            ProviderResult("local", "Local", Kind.FORENSIC, Status.OK, rating=90)]
    assert aggregate(rows, "", "general")["overall_verdict"] == "inconclusive"


@pytest.mark.parametrize("decisive", ["synthetic_likely", "authentic_likely"])
@pytest.mark.parametrize("total", [2, 3, 4])
def test_frame_minority_or_tie_cannot_decide(decisive, total):
    frames = [{"overall_verdict": decisive, "overall_rating": None}]
    frames += [{"overall_verdict": "inconclusive", "overall_rating": None}] * (total - 1)
    assert aggregate_frames(frames, [], "", "general")["overall_verdict"] == "inconclusive"


def test_partial_frame_majority_is_not_upgraded_by_one_synthetic_frame():
    frames = [{"overall_verdict": v, "overall_rating": None} for v in
              ["synthetic_likely", "partially_synthetic", "partially_synthetic"]]
    assert aggregate_frames(frames, [], "", "general")["overall_verdict"] == "partially_synthetic"
