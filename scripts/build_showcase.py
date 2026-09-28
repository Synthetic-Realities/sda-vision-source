"""Build static showcase candidates without modifying historical outputs by default."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts.bake_showcase import CURATED, EXAMPLES, _slug, diffusion, validate_cache, validate_inputs, write_set_graph
from scripts.staged_output import project_path, staged_outputs
from scripts.example_bundle import hashes, load_bundle


def cache_files(source: Path, names: list[str], expected_hashes: dict | None = None) -> list[Path]:
    """Allow generated surfaces only, before starting a frontend build."""
    manifest = validate_cache(source, names, expected_hashes)
    for entry in manifest["examples"]:
        preview = entry.get("preview")
        if preview is not None and preview != f"images/{entry['name']}":
            raise ValueError("Unexpected preview path in showcase cache.")
    allowed = {"manifest.json", "baked_at.txt", "graph.json", "graph_summary.json",
               "sda-showcase.gexf", "sda-showcase-csv.zip"}
    pngs = [f"-by-{mode}{theme}.png" for mode in diffusion.PNG_COLOUR_MODES
            for theme in ("", "-light")]
    allowed.update("sda-showcase" + suffix for suffix in pngs)
    for name in names:
        rid = _slug(name)
        if Path(name).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            allowed.add("images/" + name)
        allowed.update("reports/" + rid + suffix for suffix in (".json", "_vmap.json", "_vmap_summary.json"))
        allowed.update("exports/" + rid + suffix for suffix in (
            ".md", ".csv", ".pdf", ".pptx", "_vmap.gexf", "_vmap-csv.zip",
            *["_vmap" + png for png in pngs]))
    files = sorted(path for path in source.rglob("*") if path.is_file())
    for path in files:
        if path.relative_to(source).as_posix() not in allowed:
            raise ValueError(f"Unlisted showcase file: {path.relative_to(source)}")
    return files


def configure_workshop_starter(stage: Path, name: str) -> None:
    """Keep an exact-file opening report separate from menu examples and their graph."""
    folder = stage / "showcase"
    manifest_path = folder / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    entries = manifest["examples"]
    matches = [entry for entry in entries if entry["name"] == name]
    if len(matches) != 1 or len(entries) < 2:
        raise ValueError("Select one cached workshop illustration and at least one menu example.")
    original = folder / "originals" / name
    illustration = ROOT / "frontend/src/assets/community-illustration.png"
    digest = hashlib.sha256(illustration.read_bytes()).hexdigest()
    entry = matches[0]
    report = json.loads((folder / entry["report"]).read_text())
    if (hashlib.sha256(original.read_bytes()).hexdigest() != digest
            or entry.get("sha256") != digest or report["meta"].get("input_sha256") != digest):
        raise ValueError("Opening illustration, original and saved report must have matching hashes.")
    manifest["workshop_starter"] = entry
    manifest["examples"] = [entry for entry in entries if entry["name"] != name]
    reports = [json.loads((folder / entry["report"]).read_text()) for entry in manifest["examples"]]
    write_set_graph(reports, folder)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


def build(variant: str, source: Path, output_root: Path, replace_existing: bool = False,
          example_bundle: Path | None = None, workshop_starter: str | None = None):
    selected = load_bundle(example_bundle) if example_bundle is not None else None
    names = list(selected) if selected is not None else CURATED
    original_root = example_bundle / "originals" if example_bundle is not None else EXAMPLES
    validate_inputs(names, original_root)
    files = cache_files(source, names, hashes(selected) if selected is not None else None)
    frontend = ROOT / "frontend"
    vite = frontend / "node_modules" / ".bin" / "vite"
    if not vite.is_file():
        raise FileNotFoundError("Frontend build dependencies are missing; run ./setup.sh first.")
    variants = ["public", "workshop"] if variant == "both" else [variant]
    targets = {v: output_root / ("dist-showcase" if v == "public" else "dist-showcase-workshop")
               for v in variants}
    # Both variants finish building before either existing output is moved.
    with staged_outputs(list(targets.values()), replace_existing=replace_existing) as stages:
        for name, target in targets.items():
            stage = stages[target]
            env = {**os.environ, "VITE_SHOWCASE": "1",
                   "VITE_HIDE_SECOND_OPINION": "1" if name == "workshop" else ""}
            subprocess.run([str(vite), "build", "--base=./", "--outDir", str(stage)],
                           cwd=frontend, env=env, check=True)
            for path in files:
                target_file = stage / "showcase" / path.relative_to(source)
                target_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(path, target_file)
            originals = stage / "showcase" / "originals"
            originals.mkdir(exist_ok=True)
            for filename in names:
                shutil.copy2(original_root / filename, originals / filename)
            if workshop_starter is not None:
                configure_workshop_starter(stage, workshop_starter)
            if example_bundle is not None:
                for filename in ("README.md", "CREDITS.md"):
                    shutil.copy2(example_bundle / filename, stage / "showcase" / filename)
            # Preserve package/font/sample notices alongside browser bundles.
            shutil.copytree(ROOT / "third_party", stage / "third_party", dirs_exist_ok=True)
            shutil.copy2(ROOT / "LICENSE", stage / "LICENSE.txt")
            if not (stage / "index.html").is_file():
                raise ValueError(f"The {name} frontend did not produce index.html.")
    for target in targets.values():
        print(f"Local showcase output ready: {target}")


def cli():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("variant", nargs="?", choices=["both", "public", "workshop"], default="both")
    parser.add_argument("--source", default="frontend/showcase-data")
    parser.add_argument("--output-root", default=".review-cache/showcase-candidates")
    parser.add_argument("--replace-existing", action="store_true")
    parser.add_argument("--example-bundle", help="Explicit neutral originals with matching hashes and public credits")
    parser.add_argument("--workshop-starter", help="Cached opening illustration kept outside the example menu and set graph")
    args = parser.parse_args()
    try:
        build(args.variant, project_path(args.source, ROOT),
              project_path(args.output_root, ROOT), args.replace_existing,
              project_path(args.example_bundle, ROOT) if args.example_bundle else None,
              args.workshop_starter)
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"Build not published: {exc}\n")


if __name__ == "__main__":
    cli()
