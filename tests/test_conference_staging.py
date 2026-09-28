import hashlib
import json

import pytest

from scripts.prepare_conference import stage


def test_staging_copies_only_listed_media_and_explicit_code(tmp_path):
    source = tmp_path / "source"
    filenames = ["requirements.lock", "app/main.py", "frontend/src/App.tsx",
        "frontend/package.json", "frontend/package-lock.json", "frontend/index.html",
        "frontend/tsconfig.json", "frontend/tsconfig.node.json", "frontend/vite.config.ts",
        "deploy/conference/Dockerfile", "deploy/conference/.dockerignore", "deploy/conference/render.yaml",
        "examples/selected.png", "examples/private.png", ".env", "dev_runs/private.json"]
    for name in filenames:
        path = source / name; path.parent.mkdir(parents=True, exist_ok=True); path.write_text("Fixture bytes")
    manifest = source / "manifest.json"
    manifest.write_text(json.dumps({"examples": [{"filename": "selected.png",
        "sha256": hashlib.sha256(b"Fixture bytes").hexdigest()}]}))
    output = tmp_path / "review"
    result = stage(manifest, output, source)
    assert result["examples"] == 1
    assert (output / "examples/selected.png").read_text() == "Fixture bytes"
    for name in ["examples/private.png", ".env", "dev_runs", "manifest.json", ".git"]:
        assert not (output / name).exists()
    for entry in json.loads((output / "CONTEXT_MANIFEST.json").read_text())["files"]:
        assert hashlib.sha256((output / entry["path"]).read_bytes()).hexdigest() == entry["sha256"]
    with pytest.raises(ValueError, match="Output exists"):
        stage(manifest, output, source)
