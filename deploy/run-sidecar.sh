#!/usr/bin/env bash
# Supervised launcher for the theseus transport-sidecar (the Ames carrier).
#
# Fixes the silent-death failure: if the sidecar ever exits, this restarts it.
# Also auto-detects the host planet's Ames UDP port, which drifts every boot,
# so you don't have to look it up by hand.
#
# Run in the foreground:   deploy/run-sidecar.sh
# Run detached (then you can close the terminal):
#   nohup deploy/run-sidecar.sh >/dev/null 2>&1 &
# Watch it:   tail -f deploy/sidecar.log
# Stop it:    pkill -f run-sidecar.sh ; pkill -f transport-sidecar.mjs
set -u

HERE="$(cd "$(dirname "$0")/.." && pwd)"        # theseus repo root
SIDECAR="$HERE/bin/transport-sidecar.mjs"
LOG="${LOG:-$HERE/deploy/sidecar.log}"

# --- config (override via env) ------------------------------------------
HOST_SHIP="${HOST_SHIP:-disden-talhes}"
HOST_PIER="${HOST_PIER:-/Users/chris/disden-talhes}"
HOST_URL="${HOST_URL:-http://localhost:80}"
MOON="${MOON:-~dozlet-disden-talhes}"
CODE="${CODE:-winwyx-noslys-misryl-winryx}"
BIND="${BIND:-0.0.0.0:39999}"
GATEWAY_PORT="${GATEWAY_PORT:-59332}"           # fallback if auto-detect fails

log() { echo "[supervisor $(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

# find the host planet's live Ames UDP port: match its serf by pier, walk to
# the king (which holds the socket), read the UDP port. Falls back to config.
find_ames_port() {
  local pid ppid pids port
  pid="$(pgrep -f -- "snap-dir $HOST_PIER" 2>/dev/null | head -1)"
  if [ -n "$pid" ]; then
    ppid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
    pids="$pid${ppid:+,$ppid}"
    port="$(lsof -nP -iUDP -a -p "$pids" 2>/dev/null \
            | awk 'NR>1{print $NF}' | sed 's/.*://' | sort -un | tail -1)"
  fi
  echo "${port:-$GATEWAY_PORT}"
}

log "starting; logging to $LOG"
while true; do
  PORT="$(find_ames_port)"
  log "launching sidecar -> gateway 127.0.0.1:$PORT (moon $MOON)"
  node "$SIDECAR" \
    --url "$HOST_URL" --ship "$HOST_SHIP" --code "$CODE" \
    --moon "$MOON" --gateway "$HOST_SHIP=127.0.0.1:$PORT" --bind "$BIND" \
    >>"$LOG" 2>&1
  log "sidecar exited (code $?); restarting in 2s"
  sleep 2
done
