#!/usr/bin/env bash
# Explicit network-capable installation. Never called by the demo launcher.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="/usr/local/opt/node@20/bin:$PATH"

if [[ "${1:-}" != "" && "${1:-}" != "--build-only" ]]; then
  echo "Usage: ./setup.sh [--build-only]"
  exit 2
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Install Node 20.19+ (20.x) or Node 22.12+ before building the frontend."
  exit 1
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if (!((a===20 && b>=19)||(a===22 && b>=12)||a>22)) { console.error("Node 20.19+ (20.x) or 22.12+ required"); process.exit(1); }'

if [[ "${1:-}" != "--build-only" ]]; then
  PY="${PYTHON:-python3}"
  if [[ -x .venv/bin/python ]]; then PY=.venv/bin/python; fi
  "$PY" -c 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ required"'
  "$PY" -c 'import platform; assert not (platform.system()=="Darwin" and platform.machine()=="x86_64"), "This lock requires native ARM Python on macOS; set PYTHON to a native Python 3.12 executable. Intel macOS needs a separately reviewed build."'
  if [[ ! -x .venv/bin/python ]]; then "$PY" -m venv .venv; fi
  .venv/bin/python -m pip install --cache-dir .review-cache/pip-cache --require-hashes -r requirements.lock
  .venv/bin/python -m pip check
  (cd frontend && npm ci --cache ../.review-cache/npm-cache)
fi
if [[ ! -d frontend/node_modules ]]; then
  echo "Frontend dependencies missing. Run ./setup.sh once."
  exit 1
fi
(cd frontend && npm run build)
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env. Add only the provider keys approved for your use."
fi
echo "Setup complete. Start the installed app with ./run.sh."
