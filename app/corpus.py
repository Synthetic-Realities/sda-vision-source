"""Shared rules for what the dev-only corpus surface may expose.

The private corpus folder can also contain README files and working notes. Keep
those files on disk, but only expose top-level labelled folders such as
``01_camera_photos_with_provenance`` through the app and graph endpoints.
"""
from __future__ import annotations

import re
from pathlib import Path

LABELLED_FOLDER = re.compile(r"^\d{2}_.+")


def is_labelled_folder(name: str) -> bool:
    return bool(LABELLED_FOLDER.match(name))


def is_visible_corpus_rel(rel: str | Path) -> bool:
    parts = Path(rel).parts
    return bool(parts) and is_labelled_folder(parts[0])


def is_visible_corpus_file(path: Path, corpus_dir: Path) -> bool:
    try:
        rel = path.relative_to(corpus_dir)
    except ValueError:
        return False
    return path.is_file() and is_visible_corpus_rel(rel)
