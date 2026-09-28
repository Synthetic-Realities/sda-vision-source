#!/usr/bin/env bash
# boot-vision.command — double-clickable, PORT-POLITE boot for SAM Vision.
#
# Vision is single-origin (the FastAPI backend serves the built React app AND
# the /api/* endpoints on one port, and the frontend calls the API with
# relative paths). So the port is free to vary. Like the Geo launcher, this:
#   1. Restarts only its OWN previous instance (matched by "uvicorn app.main:app",
#      never someone else's process).
#   2. Then picks the first FREE port at or above 8100, skipping the ports the
#      other SAM launchers own (3000 / 8001 / 8000) so it never squats on them.
# It never kills a stranger to claim a port.
#
# The log streams into this window; close it or press Ctrl-C to stop.
#   SAM_BOOT_NO_OPEN=1 ./boot-vision.command   # skip opening the browser

set -euo pipefail
export PATH="/usr/local/opt/node@20/bin:$PATH"   # keg-only node@20, for a one-off build

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT" || { echo "Vision app folder not found at $ROOT"; read -r _; exit 1; }

HOST="$(grep -E '^HOST=' .env 2>/dev/null | cut -d= -f2 || true)";  HOST="${HOST:-127.0.0.1}"
DEV="$(grep -E '^DEV_MODE=' .env 2>/dev/null | cut -d= -f2 | tr '[:upper:]' '[:lower:]' || true)"
HOME_PORT="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || true)"; HOME_PORT="${HOME_PORT:-8100}"

UVICORN="$ROOT/.venv/bin/uvicorn"
PIDFILE="$ROOT/.vision-server.pid"
if [[ ! -x "$UVICORN" ]]; then
  echo "Backend not installed. Run ./setup.sh once before using the demo launcher."
  exit 1
fi

if [[ ! -f ".env" ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Providers will show as unconfigured until keys are added."
fi

echo "══════════════════════════════════════════════════════════════"
echo "  SAM Vision — booting (port-polite)"
echo "  Close this window or press Ctrl-C to stop it."
echo "══════════════════════════════════════════════════════════════"

if [[ ! -f "frontend/dist/index.html" ]]; then
  echo "Frontend build missing. Run ./setup.sh before the demo."
  exit 1
fi
echo "Serving installed frontend build. No dependency installation or build at startup."

# ── Restart our OWN previous instance only (never other apps) ────────
OWN=""
add_own_pid() {
  case " $OWN " in *" $1 "*) ;; *) OWN="${OWN:+$OWN }$1" ;; esac
}
pid_matches_this_app() {
  local cmd
  cmd="$(ps -p "$1" -o command= 2>/dev/null || true)"
  [[ "$cmd" == *"$UVICORN"* && "$cmd" == *"app.main:app"* ]]
}
if [[ -f "$PIDFILE" ]]; then
  old_pid="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [[ "$old_pid" =~ ^[0-9]+$ ]] && pid_matches_this_app "$old_pid"; then
    add_own_pid "$old_pid"
  fi
fi
while read -r pid; do
  [[ -z "$pid" ]] && continue
  if pid_matches_this_app "$pid"; then add_own_pid "$pid"; fi
done < <(pgrep -f "uvicorn app.main:app" 2>/dev/null || true)
if [[ -n "$OWN" ]]; then
  echo "Restarting: stopping our previous instance (pid $OWN)..."
  # shellcheck disable=SC2086
  kill $OWN 2>/dev/null || true
  sleep 1
fi

# ── Find a free port: first open >= HOME_PORT, skipping the other apps ─
RESERVED=" 3000 8001 8000 "   # platform UI, platform API, geo home
PORT=""
for cand in $(seq "$HOME_PORT" $((HOME_PORT + 50))); do
  case "$RESERVED" in *" $cand "*) continue ;; esac
  if ! lsof -ti tcp:"$cand" -sTCP:LISTEN >/dev/null 2>&1; then PORT="$cand"; break; fi
done
if [[ -z "$PORT" ]]; then
  echo "No free port found in ${HOME_PORT}-$((HOME_PORT + 50))."
  read -r _; exit 1
fi
APP_URL="http://localhost:${PORT}/"
echo "Using free port ${PORT} -> ${APP_URL}"

# ── Clean shutdown on window close / Ctrl-C ──────────────────────────
cleanup() {
  echo; echo "Shutting down SAM Vision..."
  kill "${SERVER_PID:-}" 2>/dev/null || true
  [[ -f "$PIDFILE" && "$(cat "$PIDFILE" 2>/dev/null || true)" == "${SERVER_PID:-}" ]] && rm -f "$PIDFILE"
  echo "Stopped."; exit 0
}
trap cleanup INT TERM HUP

# ── Start (uvicorn binary, so the process is identifiable by path) ────
if [[ "$DEV" == "true" && "${SAM_BOOT_RELOAD:-}" == "1" ]]; then
  echo "Dev mode: backend auto-reloads on changes in app/ (SAM_BOOT_RELOAD=1)"
  "$UVICORN" app.main:app --host "$HOST" --port "$PORT" --reload --reload-dir app &
else
  if [[ "$DEV" == "true" ]]; then
    echo "Dev mode: corpus browser and saved runs enabled; auto-reload off for stable demo boot."
  fi
  "$UVICORN" app.main:app --host "$HOST" --port "$PORT" &
fi
SERVER_PID=$!
echo "$SERVER_PID" > "$PIDFILE"

echo "Waiting for the server to come up..."
READY=0
for _ in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Server exited before becoming ready."
    wait "$SERVER_PID"
    exit 1
  fi
  if curl -sf -o /dev/null "$APP_URL" 2>/dev/null; then
    READY=1
    if [[ "${SAM_BOOT_NO_OPEN:-}" != "1" ]]; then echo "Up — opening ${APP_URL}"; open "$APP_URL"
    else echo "Up (browser open skipped: SAM_BOOT_NO_OPEN=1)."; fi
    break
  fi
  sleep 0.5
done

if [[ "$READY" != 1 ]]; then
  echo "Server did not become ready within 30 seconds."
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi
wait "$SERVER_PID"
