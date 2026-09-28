"""Bake real analyses of the bundled examples into static JSON for the showcase build.

Runs the actual pipeline (your keys, general mode) once over each example, then writes
everything the static showcase frontend needs into frontend/showcase-data/:
  manifest.json, reports/<id>.json, images/<file>, exports/<id>.(md|csv|pptx|pdf),
  graph.json, graph_summary.json, sda-showcase.gexf, sda-showcase-csv.zip, baked_at.txt

The exports/ files are generated with the SAME server-side builders the full tool uses,
so the static showcase offers full-parity downloads with no backend.

New analyses (explicit consent):  python scripts/bake_showcase.py --allow-provider-calls --output frontend/showcase-next
Regenerate exports only (no API):  python scripts/bake_showcase.py --exports-only --output frontend/showcase-refreshed
(--exports-only rebuilds exports/ from the existing cached reports, preserving any
second-opinion notes that were injected into them.)
"""
from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # project root on path

from app import diffusion
from app.config import ROOT
from scripts.staged_output import project_path, reject_symlinks, staged_outputs
from scripts.example_bundle import hashes, load_bundle
from app.ingest import ingest
from app.media import report_thumbnail
from app.pipeline import analyse

EXAMPLES = ROOT / "examples"
# Baked data lives outside frontend/public so it is NOT pulled into the normal
# app build; the showcase build script copies it into dist-showcase/showcase.
OUT = ROOT / "frontend" / "showcase-data"
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

# Curated, face-free, public set. Edit this list to add/swap featured items.
CURATED = [
    "synthetic_vaccine_illustration.png",
    "synthetic_journal_figure.png",
    "c2pa_ai_example_firefly_cat.jpg",
    "authentic_nasa_earth_apollo17.jpg",  # real NASA photo (public domain) — authentic contrast
    "The_Networked_Divide.pptx",
    "Digital_Vaccine_Intelligence.pdf",
    # Self-generated ground-truth podcast (SynthID-verified; Zenodo
    # doi:10.5281/zenodo.21302104; see examples/CREDITS.md).
    "From_Mask_to_Vaccine_Mandates_podcast.m4a",
]


def _slug(name: str) -> str:
    return re.sub(r"\W+", "_", Path(name).stem)[:50].strip("_").lower()


def write_exports(rid: str, report: dict, out: Path) -> None:
    """Pre-bake the four server-generated export formats for one cached record,
    using the exact builders the full tool serves - full parity, no backend."""
    from app.export import build_csv, build_markdown, build_pdf, build_pptx
    exp = out / "exports"
    exp.mkdir(exist_ok=True)
    image_b64 = report.get("meta", {}).get("thumbnail")  # data URL accepted
    (exp / f"{rid}.md").write_text(build_markdown(report))
    (exp / f"{rid}.csv").write_text(build_csv(report))
    (exp / f"{rid}.pptx").write_bytes(build_pptx(report, image_b64))
    (exp / f"{rid}.pdf").write_bytes(build_pdf(report, image_b64))


def write_vmap(rid: str, report: dict, out: Path) -> None:
    """Pre-bake the per-item verdict map (graph + deterministic summary + GEXF/CSV)
    with the same server code the full tool runs, so the showcase's 'Current item'
    graph source has full parity."""
    from app.narrate import verdict_map_summary
    g = diffusion.verdict_map(report)
    data = diffusion.graph_to_json(g)
    (out / "reports" / f"{rid}_vmap.json").write_text(json.dumps({"source": "item", **data}))
    (out / "reports" / f"{rid}_vmap_summary.json").write_text(
        json.dumps({**verdict_map_summary(data), "stats": data["stats"]}))
    exp = out / "exports"
    exp.mkdir(exist_ok=True)
    (exp / f"{rid}_vmap.gexf").write_bytes(diffusion.gexf_bytes(g))
    (exp / f"{rid}_vmap-csv.zip").write_bytes(diffusion.csv_zip_bytes(g))
    # One PNG per colour mode AND theme, so the showcase download honours both
    # the on-screen "Colour by" choice and the light/dark interface theme
    # exactly like the full tool's live renderer.
    for mode in diffusion.PNG_COLOUR_MODES:
        diffusion.render_png(g, exp / f"{rid}_vmap-by-{mode}.png",
                             anonymise=False, labels=True, colour_by=mode)
        diffusion.render_png(g, exp / f"{rid}_vmap-by-{mode}-light.png",
                             anonymise=False, labels=True, colour_by=mode, theme="light")
    (exp / f"{rid}_vmap.png").unlink(missing_ok=True)  # pre-colour-mode leftover


def exports_only(out: Path, names: list[str] | None = None, expected_hashes: dict | None = None) -> None:
    """Regenerate exports/ from the existing cached reports (no analyses, no API)."""
    manifest = validate_cache(out, names, expected_hashes)
    count = 0
    reports = []
    for entry in manifest["examples"]:
        p = out / entry["report"]
        report = json.loads(p.read_text())
        reports.append(report)
        write_exports(p.stem, report, out)
        write_vmap(p.stem, report, out)
        count += 1
    write_set_graph(reports, out)
    print(f"Regenerated exports for {count} cached record(s) -> {out / 'exports'}")


def _write_set_pngs(g, out: Path) -> None:
    for mode in diffusion.PNG_COLOUR_MODES:
        diffusion.render_png(g, out / f"sda-showcase-by-{mode}.png",
                             anonymise=False, labels=True, colour_by=mode)
        diffusion.render_png(g, out / f"sda-showcase-by-{mode}-light.png",
                             anonymise=False, labels=True, colour_by=mode, theme="light")
    (out / "sda-showcase.png").unlink(missing_ok=True)  # pre-colour-mode leftover


def write_set_graph(reports: list[dict], out: Path) -> None:
    from app.narrate import graph_summary
    g = diffusion.graph_for_payload("batch", reports, edge_mode="attributes")
    graph = diffusion.graph_to_json(g)
    (out / "graph.json").write_text(json.dumps({"source": "showcase", **graph}))
    (out / "graph_summary.json").write_text(json.dumps(graph_summary(graph)))
    (out / "sda-showcase.gexf").write_bytes(diffusion.gexf_bytes(g))
    (out / "sda-showcase-csv.zip").write_bytes(diffusion.csv_zip_bytes(g))
    _write_set_pngs(g, out)


async def bake(out: Path, names: list[str] | None = None, examples: Path | None = None) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / "reports").mkdir(exist_ok=True)
    (out / "images").mkdir(exist_ok=True)

    manifest = []
    reports_for_graph = []

    for fname in CURATED if names is None else names:
        path = (EXAMPLES if examples is None else examples) / fname
        if not path.is_file():
            raise FileNotFoundError(f"Missing curated example: {fname}")
        raw = path.read_bytes()
        ext = path.suffix.lower()
        print(f"-> analysing {fname} ...")
        ing = ingest(raw, fname, None)
        report = await analyse(ing, "", "general")

        # Thumbnail (for the diffusion graph + a fallback preview): the same
        # image / first-frame / cover-art / waveform visual the full tool uses.
        thumb = report_thumbnail(raw, ing)
        report.setdefault("meta", {})["thumbnail"] = thumb

        rid = _slug(fname)
        (out / "reports" / f"{rid}.json").write_text(json.dumps(report, indent=1))
        write_exports(rid, report, out)
        write_vmap(rid, report, out)
        reports_for_graph.append(report)

        # Copy a preview image for image examples; docs use a placeholder in the UI.
        preview = None
        if ext in IMG_EXT:
            shutil.copy2(path, out / "images" / fname)
            preview = f"images/{fname}"

        manifest.append({
            "id": rid, "name": fname, "kind": report["meta"].get("kind", ""),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "report": f"reports/{rid}.json", "preview": preview, "thumb": thumb,
            "verdict": report["consensus"]["overall_verdict"],
            "rating": report["consensus"].get("overall_rating"),
        })

    # One diffusion graph over the whole curated set (real, not the hand-authored example).
    print("-> building diffusion graph ...")
    write_set_graph(reports_for_graph, out)

    models = sorted({m for r in reports_for_graph for m in r["meta"].get("models", [])})
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    (out / "manifest.json").write_text(json.dumps({
        "baked_at": stamp, "models": models, "examples": manifest,
    }, indent=1))
    (out / "baked_at.txt").write_text(f"{stamp} | {', '.join(models)}\n")

    print(f"\nBaked {len(manifest)} examples + graph -> {out}")
    print(f"   models: {', '.join(models)}   date: {stamp}")


def validate_inputs(names: list[str] | None = None, examples: Path | None = None) -> None:
    names = CURATED if names is None else names
    examples = EXAMPLES if examples is None else examples
    missing = [name for name in names if not (examples / name).is_file()]
    if missing:
        raise FileNotFoundError("Missing curated examples: " + ", ".join(missing))
    for name in names:
        if (examples / name).is_symlink():
            raise ValueError("Curated examples must not be symlinks.")


def validate_cache(source: Path, names: list[str] | None = None,
                   expected_hashes: dict[str, str] | None = None) -> dict:
    names = CURATED if names is None else names
    reject_symlinks(source)
    manifest = json.loads((source / "manifest.json").read_text())
    entries = manifest.get("examples")
    if not isinstance(entries, list) or {e.get("name") for e in entries if isinstance(e, dict)} != set(names):
        raise ValueError("Cached manifest must contain every curated example exactly once.")
    if len(entries) != len(names):
        raise ValueError("Cached manifest contains duplicate entries.")
    expected = {f"{_slug(name)}{suffix}.json" for name in names
                for suffix in ("", "_vmap", "_vmap_summary")}
    if any(path.name not in expected for path in (source / "reports").glob("*.json")):
        raise ValueError("Cache contains reports outside the curated manifest.")
    for entry in entries:
        if expected_hashes is not None and entry.get("sha256") != expected_hashes[entry["name"]]:
            raise ValueError(f"Cached original hash does not match {entry['name']}.")
        rid = _slug(entry["name"])
        if entry.get("id") != rid or entry.get("report") != f"reports/{rid}.json":
            raise ValueError("Unexpected report identity/path in cached manifest.")
        report = json.loads((source / entry["report"]).read_text())
        if report.get("meta", {}).get("filename") != entry["name"]:
            raise ValueError(f"Cached report filename does not match {entry['name']}.")
        if expected_hashes is not None and report.get("meta", {}).get("input_sha256") != expected_hashes[entry["name"]]:
            raise ValueError(f"Cached report input hash does not match {entry['name']}.")
        if not isinstance(report.get("providers"), list) or not isinstance(report.get("consensus"), dict):
            raise ValueError("Malformed cached report.")
    return manifest


def run_build(*, source: Path, output: Path, exports: bool,
              replace_existing: bool = False, allow_provider_calls: bool = False,
              example_bundle: Path | None = None) -> None:
    selected = load_bundle(example_bundle) if example_bundle is not None else None
    names = list(selected) if selected is not None else None
    originals = example_bundle / "originals" if example_bundle is not None else None
    expected_hashes = hashes(selected) if selected is not None else None
    validate_inputs(names, originals)
    if exports:
        validate_cache(source, names, expected_hashes)
    elif not allow_provider_calls:
        raise ValueError("A new analysis requires --allow-provider-calls (media leaves this machine and API charges may apply).")
    with staged_outputs([output], replace_existing=replace_existing) as stages:
        stage = stages[output]
        if exports:
            shutil.copytree(source, stage, dirs_exist_ok=True)
            exports_only(stage, names, expected_hashes)
        else:
            asyncio.run(bake(stage, names, originals))
        manifest = validate_cache(stage, names, expected_hashes)
        for entry in manifest["examples"]:
            for fmt in ("md", "csv", "pdf", "pptx"):
                path = stage / "exports" / f"{entry['id']}.{fmt}"
                if not path.is_file() or not path.stat().st_size:
                    raise ValueError(f"Incomplete export: {path.name}")
    print(f"Complete output: {output}")


def cli() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exports-only", action="store_true", help="No inference; preserve cached report bytes and researcher notes.")
    parser.add_argument("--source", default=str(OUT), help="Existing cache for export-only builds.")
    parser.add_argument("--output", default=str(OUT), help="Output directory inside this project.")
    parser.add_argument("--replace-existing", action="store_true", help="Retain a dated backup before replacing an existing output.")
    parser.add_argument("--allow-provider-calls", action="store_true", help="Explicitly authorise media submission and possible API charges for a new bake.")
    parser.add_argument("--example-bundle", help="Use an explicit neutral-example bundle instead of historical curated originals.")
    args = parser.parse_args()
    try:
        run_build(source=project_path(args.source, ROOT), output=project_path(args.output, ROOT),
                  exports=args.exports_only, replace_existing=args.replace_existing,
                  allow_provider_calls=args.allow_provider_calls,
                  example_bundle=project_path(args.example_bundle, ROOT) if args.example_bundle else None)
    except (ValueError, OSError, KeyError) as exc:
        parser.exit(1, f"Build not published: {exc}\n")


if __name__ == "__main__":
    cli()
