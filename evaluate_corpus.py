#!/usr/bin/env python3
"""Benchmark the pipeline against the labelled corpus (the "learn from the
training set" step). Maps each folder to an expected verdict, runs the
providers, and scores agreement vs that ground truth. Writes a CSV + JSON to
reports/.

Usage:
  python evaluate_corpus.py            # free providers only (C2PA + forensics)
  python evaluate_corpus.py --vision   # also call the paid vision APIs (slower, $$)
  python evaluate_corpus.py --limit 20 # cap files per label
"""
from __future__ import annotations

import argparse
import asyncio
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from app.config import CORPUS_DIR, REPORTS_DIR, settings
from app.ingest import ingest
from app.pipeline import analyse
from app.schema import Verdict

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}

# Folder name (prefix) -> expected verdict for scoring.
EXPECTED = {
    "01_camera_photos_with_provenance": Verdict.AUTHENTIC_LIKELY,
    "02_camera_photos_without_provenance": Verdict.AUTHENTIC_LIKELY,
    "03_known_ai_illustrations": Verdict.SYNTHETIC_LIKELY,
    "04_known_ai_photoreal_images": Verdict.SYNTHETIC_LIKELY,
    "05_edited_or_composite_images": Verdict.PARTIALLY_SYNTHETIC,
    "06_google_ai_synthid_examples": Verdict.SYNTHETIC_LIKELY,
    "07_ai_generated_with_c2pa_provenance": Verdict.SYNTHETIC_LIKELY,
    "08_ai_generated_with_cloud_credentials_or_watermark": Verdict.SYNTHETIC_LIKELY,
    "09_ai_generated_with_partial_provenance": Verdict.SYNTHETIC_LIKELY,
}


def expected_for(rel: Path) -> Verdict | None:
    return EXPECTED.get(rel.parts[0])


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vision", action="store_true", help="also call paid vision APIs")
    ap.add_argument("--limit", type=int, default=0, help="max files per label (0 = all)")
    args = ap.parse_args()

    if not CORPUS_DIR.exists():
        raise SystemExit(f"Corpus not found at {CORPUS_DIR}")

    if not args.vision:
        # Force the vision providers off for a free, fast structural benchmark.
        object.__setattr__(settings, "disable_anthropic", True)
        object.__setattr__(settings, "disable_openai", True)
        object.__setattr__(settings, "disable_google", True)

    per_label: dict[str, int] = {}
    rows = []
    correct = scored = 0

    for path in sorted(CORPUS_DIR.rglob("*")):
        if not (path.is_file() and path.suffix.lower() in IMAGE_EXT):
            continue
        rel = path.relative_to(CORPUS_DIR)
        label = rel.parts[0]
        if args.limit and per_label.get(label, 0) >= args.limit:
            continue
        per_label[label] = per_label.get(label, 0) + 1

        try:
            report = await analyse(ingest(path.read_bytes(), path.name), caption="", mode="general")
        except Exception as exc:
            rows.append({"path": str(rel), "label": label, "error": str(exc)})
            print(f"  ! {rel}: {exc}")
            continue

        cons = report["consensus"]
        expected = expected_for(rel)
        predicted = cons["overall_verdict"]
        hit = expected is not None and predicted == expected.value
        if expected is not None:
            scored += 1
            correct += int(hit)

        c2pa = next((p for p in report["providers"] if p["id"] == "c2pa"), {})
        rows.append({
            "path": str(rel),
            "label": label,
            "expected": expected.value if expected else "",
            "predicted": predicted,
            "rating": cons["overall_rating"],
            "confidence": cons["confidence"],
            "hit": hit,
            "c2pa_status": c2pa.get("status"),
            "c2pa_verdict": c2pa.get("verdict"),
            "c2pa_summary": c2pa.get("summary"),
        })
        mark = "✓" if hit else ("·" if expected is None else "✗")
        print(f"  {mark} {rel}  →  {predicted} ({cons['overall_rating']})")

    REPORTS_DIR.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    # Stamp the run configuration into every artifact so a vision-off run can
    # never be mistaken for a benchmark of the full instrument.
    config_note = ("full instrument (vision models on)" if args.vision else
                   "VISION OFF - C2PA + local forensics only; NOT the instrument's accuracy")
    (REPORTS_DIR / f"benchmark_{stamp}.json").write_text(
        json.dumps({"accuracy": correct / scored if scored else None,
                    "vision": args.vision, "config": config_note,
                    "scored": scored, "correct": correct, "rows": rows}, indent=2))
    with (REPORTS_DIR / f"benchmark_{stamp}.csv").open("w", newline="") as f:
        f.write(f"# config: {config_note}\n")
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["path"])
        w.writeheader()
        w.writerows(rows)

    print("\n" + "=" * 60)
    if scored:
        caveat = "" if args.vision else "  (VISION OFF - structural signals only)"
        print(f"Accuracy on labelled folders: {correct}/{scored} = {correct/scored:.0%}{caveat}")
    print(f"Reports written to {REPORTS_DIR}/benchmark_{stamp}.(csv|json)")


if __name__ == "__main__":
    asyncio.run(main())
