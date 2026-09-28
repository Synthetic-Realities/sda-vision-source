"""Read an explicit neutral-example bundle; never infer inclusion from a folder."""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from scripts.staged_output import reject_symlinks

NEUTRAL_NAME = re.compile(
    r"(?:Example-[0-9]{3}|(?:podcast|presentation|infographic|illustration|"
    r"journal-diagram|journal-image|social-media-image|animal-portrait|earth-image|animated-video)"
    r"(?:-[1-9][0-9]{0,2})?)\.(?:png|jpg|jpeg|webp|pdf|pptx|m4a|mov|mp4)\Z"
)
# Catalogue size is separate from the UI's ten-item queue/five-item batch limits.
MAX_BUNDLE_EXAMPLES = 50
WITHDRAWN_SHA256 = {"17442d095e61a319e806d0a58993fcb5b4a89705867bda5ead74b82bec4b8add"}


def load_bundle(root: Path) -> dict[str, Path]:
    """Reject extra files, unsafe names, duplicates and changed original bytes.

    Bundles contain neutral originals and public credit text only. The private
    original-name mapping and source key are deliberately not part of the schema.
    This is input validation, not approval to publish the bundle.
    """
    reject_symlinks(root)
    document = json.loads((root / "manifest.json").read_text())
    if not isinstance(document, dict) or set(document) != {"schema_version", "examples"} or document["schema_version"] != 1:
        raise ValueError("Example bundle must use the public manifest schema.")
    entries = document["examples"]
    if not isinstance(entries, list) or not 1 <= len(entries) <= MAX_BUNDLE_EXAMPLES:
        raise ValueError(f"Select one to {MAX_BUNDLE_EXAMPLES} neutral examples.")
    files, ids = {}, set()
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {"filename", "sha256"}:
            raise ValueError("Public example entries contain only filename and sha256.")
        name, digest = entry["filename"], entry["sha256"]
        if not isinstance(name, str) or not NEUTRAL_NAME.fullmatch(name) or Path(name).stem in ids:
            raise ValueError("Use unique neutral example IDs and supported extensions.")
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ValueError("Each example needs a SHA-256 digest.")
        path = root / "originals" / name
        if not path.is_file() or not 0 < path.stat().st_size <= 200 * 1024 * 1024:
            raise ValueError("Example is missing, empty or larger than 200 MiB.")
        if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
            raise ValueError(f"Example hash mismatch: {name}")
        if digest in WITHDRAWN_SHA256:
            raise ValueError("This example has been withdrawn from distribution.")
        files[name] = path
        ids.add(Path(name).stem)
    expected = {"manifest.json", "README.md", "CREDITS.md", "originals"}
    expected |= {"originals/" + name for name in files}
    actual = {p.relative_to(root).as_posix() for p in root.rglob("*")}
    if actual != expected or any(not (root / name).is_file() for name in ("README.md", "CREDITS.md")):
        raise ValueError("Example bundle has missing or unlisted files; keep private records outside it.")
    return files


def hashes(files: dict[str, Path]) -> dict[str, str]:
    return {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in files.items()}
