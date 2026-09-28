import copy
import io
import zipfile

import networkx as nx
from PIL import Image

from app import diffusion, narrate


def report():
    digest = "a" * 64
    return {"meta": {"filename": "fixture.mp4", "input_sha256": digest},
            "consensus": {"overall_verdict": "synthetic_likely", "overall_rating": 85},
            "providers": [{"id": name, "name": name, "kind": "vision", "status": "ok",
                           "verdict": "synthetic_likely", "rating": 85}
                          for name in ("claude", "openai", "gemini")],
            "audio_inspection": {"input_sha256": digest, "status": "present", "stream_count": 1},
            "audio_assessment": {"input_sha256": digest, "status": "ok", "content_type": "music",
                                 "model": "fixture", "track_index": 1, "start_seconds": 0, "duration_seconds": 20},
            "suno_check": {"input_sha256": digest, "status": "ok", "verdict": "verified_suno"}}


def test_observations_never_enter_votes_or_agreement_edges():
    rep = report()
    before = copy.deepcopy(rep)
    graph = diffusion.verdict_map(rep)
    observations = [n for n, data in graph.nodes(data=True) if data.get("source") == "observation"]
    assert len(observations) == 3
    for nid in observations:
        assert list(graph.neighbors(nid)) == ["item"]
        assert graph[nid]["item"]["kind"] == "observation"
        assert graph.nodes[nid]["rating"] == -1
        assert graph.nodes[nid]["verdict"] == "not_applicable"
        for mode in diffusion.PNG_COLOUR_MODES:
            assert diffusion._png_node_colour(graph.nodes[nid], mode) == "1b878a"
    summary = narrate.verdict_map_summary(diffusion.graph_to_json(graph))
    assert summary["headline"].startswith("Three visual LLMs")
    assert "rating is 85" in summary["caption"]
    assert "Suno Credentials (ok; Vendor reports verified_suno)" in summary["caption"]
    assert "visual model count is unchanged" in summary["caption"]
    assert "AI-origin detection from sound is outside this workflow" in summary["caption"]
    assert rep == before


def test_missing_and_mismatched_observations_are_not_invented():
    rep = report()
    rep["audio_assessment"]["input_sha256"] = "b" * 64
    rep.pop("suno_check")
    graph = diffusion.verdict_map(rep)
    assert "obs_audio_inspection" in graph
    assert "obs_audio_assessment" not in graph and "obs_suno_check" not in graph
    rep.pop("audio_inspection")
    assert not any(d.get("source") == "observation" for _, d in diffusion.verdict_map(rep).nodes(data=True))


def test_failures_stay_failures_not_negative_origin_findings():
    rep = report()
    rep["suno_check"].update(status="error", verdict=None)
    graph = diffusion.verdict_map(rep)
    value = graph.nodes["obs_suno_check"]
    assert value["finding"] == "No usable vendor result"
    assert value["status"] == "error" and value["rating"] == -1


def test_graph_exports_retain_observation_scope(tmp_path):
    graph = diffusion.verdict_map(report())
    data = diffusion.graph_to_json(graph)
    assert next(n for n in data["nodes"] if n["id"] == "obs_suno_check")["rating"] is None
    with zipfile.ZipFile(io.BytesIO(diffusion.csv_zip_bytes(graph))) as archive:
        nodes = archive.read("nodes.csv").decode()
        edges = archive.read("edges.csv").decode()
        assert "verified_suno" in nodes and "AI-origin detection from sound is outside this workflow" in nodes
        assert "reported by Suno" in nodes and "local signer trust is assessed separately" in nodes
        assert "observation" in edges
    exported = nx.read_gexf(io.BytesIO(diffusion.gexf_bytes(graph)))
    assert exported.nodes["obs_audio_assessment"]["finding"] == "music"
    png = tmp_path / "graph.png"
    diffusion.render_png(graph, png, False, labels=True, theme="light")
    image = Image.open(png).convert("RGB")
    assert image.size == (1400, 1000)
    assert any(colour == (27, 135, 138) for _, colour in image.getcolors(1400 * 1000))


def test_batch_keeps_audio_context_without_changing_relationships():
    rep = report()
    bare = {key: value for key, value in rep.items() if key not in {"audio_inspection", "audio_assessment", "suno_check"}}
    with_audio = diffusion.graph_for_payload("batch", [rep])
    without = diffusion.graph_for_payload("batch", [bare])
    assert list(with_audio.edges) == list(without.edges)
    assert with_audio.nodes["n0000"]["rating"] == without.nodes["n0000"]["rating"]
    text = narrate.graph_summary(diffusion.graph_to_json(with_audio), "batch")["caption"]
    assert "audio/vendor observations accompany one item(s)" in text
