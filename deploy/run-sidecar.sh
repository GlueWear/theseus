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
HEARTBEAT="${HEARTBEAT:-$HERE/deploy/.sidecar-heartbeat}"
STALE_SECS="${STALE_SECS:-90}"                  # restart if heartbeat older than this

log() { echo "[supervisor $(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }
# file mtime in epoch seconds (BSD stat on macOS, GNU stat on Linux)
mtime() { stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0; }

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
  rm -f "$HEARTBEAT"                              # clear any stale heartbeat
  node "$SIDECAR" \
    --url "$HOST_URL" --ship "$HOST_SHIP" --code "$CODE" \
    --moon "$MOON" --gateway "$HOST_SHIP=127.0.0.1:$PORT" --bind "$BIND" \
    --heartbeat "$HEARTBEAT" \
    >>"$LOG" 2>&1 &
  NODE_PID=$!

  # watchdog: if the carrier's heartbeat goes stale (alive but wedged), kill it
  # so this loop restarts it. Grace period first so startup isn't flagged.
  (
    sleep 45
    while kill -0 "$NODE_PID" 2>/dev/null; do
      if [ -f "$HEARTBEAT" ]; then
        age=$(( $(date +%s) - $(mtime "$HEARTBEAT") ))
        if [ "$age" -gt "$STALE_SECS" ]; then
          log "carrier heartbeat stale (${age}s > ${STALE_SECS}s) -- killing to restart"
          kill "$NODE_PID" 2>/dev/null
          break
        fi
      fi
      sleep 15
    done
  ) &
  WATCH_PID=$!

  wait "$NODE_PID"; code=$?
  kill "$WATCH_PID" 2>/dev/null
  log "sidecar exited (code $code); restarting in 2s"
  sleep 2
done
