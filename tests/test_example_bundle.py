"""Release boundaries use synthetic bytes; these tests never call providers."""
import hashlib
import json
import zipfile

import pytest

from scripts import bake_showcase as bake
from scripts import package_candidate as candidate
from scripts.build_showcase import cache_files
from scripts.example_bundle import hashes, load_bundle


@pytest.fixture
def bundle(tmp_path):
    root = tmp_path / "bundle"
    (root / "originals").mkdir(parents=True)
    for name in ("README.md", "CREDITS.md"):
        (root / name).write_text("Public review text")
    entries = []
    for name in ("Example-817.png", "Example-203.pdf"):
        content = ("test fixture " + name).encode()
        (root / "originals" / name).write_bytes(content)
        entries.append({"filename": name, "sha256": hashlib.sha256(content).hexdigest()})
    (root / "manifest.json").write_text(json.dumps({"schema_version": 1, "examples": entries}))
    return root


def fake_cache(bundle, tmp_path):
    selected = load_bundle(bundle)
    expected = hashes(selected)
    cache = tmp_path / "cache"
    (cache / "reports").mkdir(parents=True)
    entries = []
    for name in selected:
        rid = bake._slug(name)
        entry = {"name": name, "id": rid, "sha256": expected[name], "report": f"reports/{rid}.json"}
        (cache / entry["report"]).write_text(json.dumps({
            "meta": {"filename": name, "input_sha256": expected[name]}, "providers": [], "consensus": {}}))
        entries.append(entry)
    (cache / "manifest.json").write_text(json.dumps({"examples": entries}))
    return cache, selected, expected


def test_bundle_rejects_changed_original(bundle):
    assert len(load_bundle(bundle)) == 2
    (bundle / "originals/Example-817.png").write_bytes(b"different image")
    with pytest.raises(ValueError, match="hash mismatch"):
        load_bundle(bundle)


def test_descriptive_catalogue_includes_podcast_and_more_than_ten_items(tmp_path):
    root = tmp_path / "named"
    (root / "originals").mkdir(parents=True)
    for name in ("README.md", "CREDITS.md"):
        (root / name).write_text("Public credits")
    names = ["podcast.m4a", "presentation.pptx", "infographic.pdf",
             *[f"illustration-{i}.png" for i in range(1, 9)]]
    entries = []
    for name in names:
        content = name.encode()
        (root / "originals" / name).write_bytes(content)
        entries.append({"filename": name, "sha256": hashlib.sha256(content).hexdigest()})
    (root / "manifest.json").write_text(json.dumps({"schema_version": 1, "examples": entries}))
    assert list(load_bundle(root)) == names


@pytest.mark.parametrize("name", ["../podcast.m4a", "OpenAI-illustration.png", "human-illustration.png"])
def test_descriptive_names_reject_paths_and_origin_labels(bundle, name):
    document = json.loads((bundle / "manifest.json").read_text())
    document["examples"][0]["filename"] = name
    (bundle / "manifest.json").write_text(json.dumps(document))
    with pytest.raises(ValueError, match="unique neutral"):
        load_bundle(bundle)


@pytest.mark.parametrize("filename", ["originals/private-source-key.md", "private.json", "originals/film.mp4"])
def test_bundle_rejects_unlisted_material(bundle, filename):
    (bundle / filename).write_text("private")
    with pytest.raises(ValueError, match="unlisted"):
        load_bundle(bundle)


@pytest.mark.parametrize("name", ["../Example-817.png", "OpenAI-817.png", "Example-817.pdf"])
def test_bundle_rejects_unsafe_names_or_duplicate_ids(bundle, name):
    document = json.loads((bundle / "manifest.json").read_text())
    document["examples"][1]["filename"] = name
    (bundle / "manifest.json").write_text(json.dumps(document))
    with pytest.raises(ValueError, match="unique neutral"):
        load_bundle(bundle)


def test_bundle_rejects_symlink(bundle, tmp_path):
    source = tmp_path / "private.png"
    source.write_bytes(b"private")
    path = bundle / "originals/Example-817.png"
    path.unlink()
    path.symlink_to(source)
    with pytest.raises(ValueError, match="Symlinks"):
        load_bundle(bundle)


@pytest.mark.parametrize("digest", [None, "0" * 64])
def test_cache_requires_matching_original_hash(bundle, tmp_path, digest):
    cache, selected, expected = fake_cache(bundle, tmp_path)
    document = json.loads((cache / "manifest.json").read_text())
    document["examples"][0]["sha256"] = digest
    (cache / "manifest.json").write_text(json.dumps(document))
    with pytest.raises(ValueError, match="hash does not match"):
        bake.validate_cache(cache, list(selected), expected)


def test_cache_keeps_source_labelled_report_out(bundle, tmp_path):
    cache, selected, expected = fake_cache(bundle, tmp_path)
    path = cache / "reports/example_817.json"
    path.write_text(json.dumps({"meta": {"filename": "OpenAI.png"}, "providers": [], "consensus": {}}))
    with pytest.raises(ValueError, match="report filename"):
        bake.validate_cache(cache, list(selected), expected)


def test_cache_rejects_report_from_different_bytes(bundle, tmp_path):
    cache, selected, expected = fake_cache(bundle, tmp_path)
    path = cache / "reports/example_817.json"
    document = json.loads(path.read_text())
    document["meta"]["input_sha256"] = "0" * 64
    path.write_text(json.dumps(document))
    with pytest.raises(ValueError, match="report input hash"):
        bake.validate_cache(cache, list(selected), expected)


def test_new_bundle_does_not_authorise_inference(bundle, tmp_path, monkeypatch):
    async def forbidden(*args, **kwargs):
        pytest.fail("provider pipeline must not run")
    monkeypatch.setattr(bake, "analyse", forbidden)
    with pytest.raises(ValueError, match="allow-provider-calls"):
        bake.run_build(source=tmp_path, output=tmp_path / "out", exports=False, example_bundle=bundle)
    assert not (tmp_path / "out").exists()


def test_showcase_allows_generated_graphs_but_rejects_private_extra(bundle, tmp_path):
    cache, selected, expected = fake_cache(bundle, tmp_path)
    (cache / "sda-showcase-by-community-light.png").write_bytes(b"graph fixture")
    (cache / "exports").mkdir()
    (cache / "exports/example_817_vmap-by-provider.png").write_bytes(b"graph fixture")
    assert len(cache_files(cache, list(selected), expected)) == 5
    (cache / "private-source-key.md").write_text("private")
    with pytest.raises(ValueError, match="Unlisted showcase file"):
        cache_files(cache, list(selected), expected)


def test_candidate_includes_selected_neutral_media_only(bundle, tmp_path, monkeypatch):
    monkeypatch.setattr(candidate, "FILES", {"README.md", "examples/CREDITS.md"})
    monkeypatch.setattr(candidate, "TREES", {})
    (tmp_path / "README.md").write_text("Source review")
    (tmp_path / "examples").mkdir()
    (tmp_path / "examples/CREDITS.md").write_text("PRIVATE DEVELOPMENT INVENTORY")
    (tmp_path / "examples/restricted-video.mp4").write_bytes(b"private")
    (tmp_path / "examples/OpenAI-source.png").write_bytes(b"source labelled original")
    (tmp_path / "private-source-key.md").write_text("private")
    output = candidate.package(tmp_path, example_bundle=bundle)
    with zipfile.ZipFile(output) as archive:
        names = {name.removeprefix("sda-vision-candidate/") for name in archive.namelist()}
        assert {name for name in names if name.startswith("examples/")} == {
            "examples/Example-817.png", "examples/Example-203.pdf", "examples/README.md",
            "examples/CREDITS.md", "examples/manifest.json"}
        assert "private-source-key.md" not in names
        assert archive.read("sda-vision-candidate/examples/CREDITS.md") == b"Public review text"
        for name, path in load_bundle(bundle).items():
            assert archive.read("sda-vision-candidate/examples/" + name) == path.read_bytes()

def test_bundle_rejects_withdrawn_bytes_even_if_renamed(bundle, monkeypatch):
    from scripts import example_bundle
    document = json.loads((bundle / "manifest.json").read_text())
    digest = document["examples"][0]["sha256"]
    monkeypatch.setattr(example_bundle, "WITHDRAWN_SHA256", {digest})
    with pytest.raises(ValueError, match="withdrawn"):
        load_bundle(bundle)


@pytest.mark.parametrize("extension", ["mov", "mp4"])
def test_neutral_animated_video_bundle_preserves_original(bundle, extension):
    name = "animated-video." + extension
    raw = b"synthetic test bytes for neutral video bundle"
    (bundle / "originals" / name).write_bytes(raw)
    document = json.loads((bundle / "manifest.json").read_text())
    document["examples"].append({"filename": name, "sha256": hashlib.sha256(raw).hexdigest()})
    (bundle / "manifest.json").write_text(json.dumps(document))
    assert load_bundle(bundle)[name].read_bytes() == raw
