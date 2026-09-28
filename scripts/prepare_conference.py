"""Stage a review-only conference container context from explicit inputs; no deploy."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.conference import example_bytes, example_manifest
from scripts.package_candidate import SECRET


def stage(manifest: Path, output: Path, root: Path = ROOT):
    if output.exists():
        raise ValueError("Output exists; choose a fresh review folder.")
    settings = SimpleNamespace(conference_manifest=str(manifest))
    names = example_manifest(settings, root / "examples")
    for name in names:
        example_bytes(settings, root / "examples", name)
    files = {"requirements.lock": root / "requirements.lock"}
    for name in ["package.json", "package-lock.json", "index.html", "tsconfig.json", "tsconfig.node.json", "vite.config.ts"]:
        files[f"frontend/{name}"] = root / "frontend" / name
    for directory, extensions in [("app", {".py"}), ("frontend/src", {".ts", ".tsx", ".css", ".svg", ".png", ".ttf", ".txt"})]:
        for path in (root / directory).rglob("*"):
            if path.is_file() and path.suffix in extensions and "__pycache__" not in path.parts:
                files[path.relative_to(root).as_posix()] = path
    for name in ["Dockerfile", ".dockerignore", "render.yaml"]:
        files[name] = root / "deploy" / "conference" / name
    files["config/conference-examples.json"] = manifest
    files.update({f"examples/{name}": path for name, path in names.items()})
    records = []
    for name, path in files.items():
        if path.is_symlink():
            raise ValueError(f"Symlink is not a staging input: {name}")
        data = path.read_bytes()
        if SECRET.search(data):
            raise ValueError(f"Possible credential in {name}; context not created.")
        records.append({"path": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    output.mkdir(parents=True)
    (output / "examples").mkdir()
    for name, path in files.items():
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
    (output / "CONTEXT_MANIFEST.json").write_text(json.dumps({"status": "LOCAL_REVIEW_ONLY", "files": records}, indent=2))
    return {"output": str(output), "files": len(records), "examples": len(names), "status": "LOCAL_REVIEW_ONLY"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=ROOT / "config/conference-examples.template.json")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(stage(args.manifest.resolve(), args.output.resolve()), indent=2))
