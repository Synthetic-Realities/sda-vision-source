"""Presentation attribution, separate from recorded findings and input authorship."""
from __future__ import annotations
import json
from pathlib import Path

_CREDITS = json.loads((Path(__file__).resolve().parents[1] / "config/citation.json").read_text())

def software_citation(version: str | None = None) -> str:
    c = _CREDITS
    edition = f"version {version}" if version else "version not recorded"
    return (f"{c['author']} ({c['year']}) {c['title']} ({edition}) [Computer software]. "
            f"{c['publisher']}. Available at: {c['url']}")

def citation_rows(meta: dict) -> list[tuple[str, str]]:
    return [
        ("Software citation", software_citation(meta.get("version"))),
        ("Software creator", _CREDITS["creator"]),
        ("Funding acknowledgement", _CREDITS["funding"]),
        ("Analysis record", f"File: {meta.get('filename', 'not recorded')}; media type: {meta.get('kind', 'not recorded')}; "
         f"recorded at: {meta.get('generated_at', 'not recorded')}; models: {', '.join(meta.get('models') or []) or 'not recorded'}."),
    ]
