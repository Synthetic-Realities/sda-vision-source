#!/usr/bin/env bash
# Installed-app startup only. Installation/building is explicit in setup.sh.
set -euo pipefail
exec bash "$(dirname "$0")/boot-vision.command" "$@"
