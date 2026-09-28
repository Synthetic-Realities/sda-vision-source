"""Build a separate conference frontend without replacing existing demos."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.staged_output import project_path, staged_outputs

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=".review-cache/conference-candidate/frontend")
    args = parser.parse_args()
    target = project_path(args.output, ROOT)
    with staged_outputs([target], replace_existing=False) as stages:
        subprocess.run([str(ROOT / "frontend/node_modules/.bin/vite"), "build", "--outDir", str(stages[target])],
            cwd=ROOT / "frontend", env={**os.environ, "VITE_CONFERENCE": "1", "VITE_SHOWCASE": "0"}, check=True)
    print(target)
