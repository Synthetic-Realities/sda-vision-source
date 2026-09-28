#!/usr/bin/env bash
# Builds local candidates. Use --replace-existing only for an intentional refresh.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/usr/local/opt/node@20/bin:$PATH"
exec .venv/bin/python scripts/build_showcase.py "$@"
