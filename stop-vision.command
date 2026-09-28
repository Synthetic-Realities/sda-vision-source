#!/usr/bin/env bash
# stop-vision.command — double-clickable stop for SAM Vision.
#
# Finds this app's own server by the uvicorn binary inside this folder's
# virtualenv, rather than by a fixed port or a generic "app.main:app" match.
# Safe when nothing is running.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UVICORN="$ROOT/.venv/bin/uvicorn"
PIDFILE="$ROOT/.vision-server.pid"

pids=""
add_pid() {
  case " $pids " in *" $1 "*) ;; *) pids="${pids:+$pids }$1" ;; esac
}
matches_this_app() {
  local cmd
  cmd="$(ps -p "$1" -o command= 2>/dev/null || true)"
  [[ "$cmd" == *"$UVICORN"* && "$cmd" == *"app.main:app"* ]]
}
own_pids() {
  pids=""
  if [[ -f "$PIDFILE" ]]; then
    old_pid="$(cat "$PIDFILE" 2>/dev/null || true)"
    if [[ "$old_pid" =~ ^[0-9]+$ ]] && matches_this_app "$old_pid"; then
      add_pid "$old_pid"
    fi
  fi
  while read -r pid; do
    [[ -z "$pid" ]] && continue
    if matches_this_app "$pid"; then add_pid "$pid"; fi
  done < <(pgrep -f 'uvicorn app.main:app' 2>/dev/null || true)
  printf '%s' "$pids"
}

echo "Stopping SAM Vision..."
pids="$(own_pids)"
if [[ -z "$pids" ]]; then
  echo "  nothing running for this app"
  echo "You can close this window."; exit 0
fi

echo "  stopping pid $pids"
# shellcheck disable=SC2086
kill $pids 2>/dev/null || true

for _ in 1 2 3 4 5 6 7 8; do
  sleep 0.5
  [[ -z "$(own_pids)" ]] && break
done
still="$(own_pids)"
if [[ -n "$still" ]]; then
  echo "  still up, force-stopping pid $still"
  # shellcheck disable=SC2086
  kill -9 $still 2>/dev/null || true
fi
rm -f "$PIDFILE"

echo "Done. You can close this window."
