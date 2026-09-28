import json
from pathlib import Path

import pytest

from scripts import bake_showcase as bake
from scripts.staged_output import staged_outputs


def test_existing_output_requires_explicit_replacement(tmp_path):
    target = tmp_path / "cache"
    target.mkdir()
    (target / "note.txt").write_text("keep")
    with pytest.raises(FileExistsError):
        with staged_outputs([target]):
            pytest.fail("must reject before entering build")
    assert (target / "note.txt").read_text() == "keep"


def test_failure_during_staging_leaves_every_original_untouched(tmp_path):
    targets = [tmp_path / name for name in ("public", "workshop")]
    for target in targets:
        target.mkdir()
        (target / "note.txt").write_text(target.name)
    with pytest.raises(RuntimeError):
        with staged_outputs(targets, replace_existing=True) as stages:
            (stages[targets[0]] / "new.txt").write_text("candidate")
            raise RuntimeError("second build failed")
    for target in targets:
        assert (target / "note.txt").read_text() == target.name
    assert not list(tmp_path.glob(".*.staging-*"))
    assert not list(tmp_path.glob("*.build.lock"))


def test_success_keeps_recovery_copy(tmp_path):
    target = tmp_path / "cache"
    target.mkdir()
    (target / "report.json").write_text("original note")
    with staged_outputs([target], replace_existing=True) as stages:
        (stages[target] / "report.json").write_text("new run")
    assert (target / "report.json").read_text() == "new run"
    backups = list(tmp_path.glob("cache.backup-*"))
    assert len(backups) == 1
    assert (backups[0] / "report.json").read_text() == "original note"


def test_promotion_failure_restores_both_outputs(monkeypatch, tmp_path):
    targets = [tmp_path / name for name in ("public", "workshop")]
    for target in targets:
        target.mkdir()
        (target / "record").write_text("original")
    rename = Path.rename
    def fail_second_stage(path, destination):
        if path.name.startswith(".workshop.staging-"):
            raise OSError("simulated promotion failure")
        return rename(path, destination)
    monkeypatch.setattr(Path, "rename", fail_second_stage)
    with pytest.raises(OSError):
        with staged_outputs(targets, replace_existing=True) as stages:
            for stage in stages.values():
                (stage / "record").write_text("candidate")
    assert all((target / "record").read_text() == "original" for target in targets)


def test_missing_example_fails_before_cloud_or_output(monkeypatch, tmp_path):
    monkeypatch.setattr(bake, "EXAMPLES", tmp_path)
    monkeypatch.setattr(bake, "CURATED", ["missing.png"])
    out = tmp_path / "output"
    with pytest.raises(FileNotFoundError):
        bake.run_build(source=tmp_path, output=out, exports=False, allow_provider_calls=True)
    assert not out.exists()


def test_new_bake_requires_explicit_provider_permission(monkeypatch, tmp_path):
    monkeypatch.setattr(bake, "CURATED", [])
    with pytest.raises(ValueError, match="allow-provider-calls"):
        bake.run_build(source=tmp_path, output=tmp_path / "output", exports=False)
    assert not (tmp_path / "output").exists()


def test_export_refresh_preserves_exact_cached_report_bytes(monkeypatch, tmp_path):
    monkeypatch.setattr(bake, "CURATED", ["example.png"])
    monkeypatch.setattr(bake, "EXAMPLES", tmp_path)
    (tmp_path / "example.png").write_bytes(b"fixture")
    source = tmp_path / "cache"
    (source / "reports").mkdir(parents=True)
    content = b'{"meta":{"filename":"example.png"},"providers":[],"consensus":{}, "second_opinion_gemini":"manual note"}\n'
    (source / "reports/example.json").write_bytes(content)
    (source / "manifest.json").write_text(json.dumps({"examples": [{
        "name": "example.png", "id": "example", "report": "reports/example.json"}]}))
    def fake_exports(out, names=None, expected_hashes=None):
        (out / "exports").mkdir()
        for fmt in ("md", "csv", "pdf", "pptx"):
            (out / "exports" / f"example.{fmt}").write_bytes(b"export")
    monkeypatch.setattr(bake, "exports_only", fake_exports)
    out = tmp_path / "refreshed"
    bake.run_build(source=source, output=out, exports=True)
    assert (out / "reports/example.json").read_bytes() == content
    assert (source / "reports/example.json").read_bytes() == content


def test_symlink_output_is_rejected(tmp_path):
    real = tmp_path / "real"
    real.mkdir()
    target = tmp_path / "link"
    target.symlink_to(real)
    with pytest.raises(ValueError, match="Symlinks"):
        with staged_outputs([target], replace_existing=True):
            pytest.fail("must not follow output link")
