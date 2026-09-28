"""Inspect project-local original bytes using C2PA only; no uploads or inference."""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.media import Media
from app.providers import c2pa_provider


def inspect(path: Path, *, review_anchors: Path | None = None,
            review_sha256: str | None = None, root: Path = ROOT) -> Path:
    path = path.resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError("Input must be a regular file inside this project.")
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    media = Media(raw, path.name, mime, "", mime, None, None)
    row = c2pa_provider.run(media)
    report = {"inspection": "C2PA only; offline; no cloud inference", "input_sha256": digest,
              "input_bytes": len(raw), "filename": path.name, "provider": row.to_dict()}
    if review_anchors is not None:
        anchors_path = review_anchors.resolve()
        if not anchors_path.is_relative_to(root.resolve() / ".review-cache"):
            raise ValueError("Review anchors must be inside this project's .review-cache.")
        anchors = anchors_path.read_bytes()
        if not review_sha256 or hashlib.sha256(anchors).hexdigest() != review_sha256:
            raise ValueError("Review anchor SHA-256 mismatch.")
        if b"PRIVATE KEY" in anchors or b"-----BEGIN CERTIFICATE-----" not in anchors:
            raise ValueError("Expected public certificates only.")
        result = c2pa_provider._read_manifest_json(raw, mime, {"trust_anchors": anchors.decode("ascii")})
        comparison = c2pa_provider._interpret(json.loads(result), 0, policy_approved=False) if result else None
        report["unapproved_anchor_comparison"] = {
            "anchors_sha256": review_sha256, "policy_approved": False,
            "runtime_policy_changed": False, "provider": comparison.to_dict() if comparison else None,
        }
    if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
        raise ValueError("Input changed during inspection.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    output = root / ".review-cache" / "provenance" / f"inspection-{stamp}.json"
    if not output.resolve().is_relative_to(root.resolve()):
        raise ValueError("Output must stay inside this project.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    parser.add_argument("--review-anchors", type=Path)
    parser.add_argument("--review-sha256")
    args = parser.parse_args()
    print(inspect(args.file, review_anchors=args.review_anchors, review_sha256=args.review_sha256))


if __name__ == "__main__":
    main()
