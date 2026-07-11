#!/usr/bin/env bash
# theseus stack control — one command for the whole web stack:
#   Caddy (per-moon web front) + supervised transport-sidecar (Ames carrier).
#
# Usage:
#   deploy/stack.sh start     # bring everything up (detached, idempotent)
#   deploy/stack.sh stop      # take everything down
#   deploy/stack.sh restart
#   deploy/stack.sh status    # what's up / down
#   deploy/stack.sh logs      # follow the carrier log
#
# Detached + logged, so you never babysit a terminal. Safe to re-run start.
set -u

HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$HERE/deploy"

CADDY_MATCH="caddy run --config"     # our caddy invocation
SUP_MATCH="run-sidecar.sh"           # the supervisor loop
SIDE_MATCH="transport-sidecar.mjs"   # the carrier itself

is_up() { pgrep -f "$1" >/dev/null 2>&1; }

start() {
  if is_up "$CADDY_MATCH"; then
    echo "caddy      : already up"
  elif ! command -v caddy >/dev/null 2>&1; then
    echo "caddy      : NOT INSTALLED (brew install caddy)"
  else
    nohup caddy run --config "$DEPLOY/Caddyfile" >"$DEPLOY/caddy.log" 2>&1 &
    echo "caddy      : started (log: deploy/caddy.log)"
  fi

  if is_up "$SUP_MATCH"; then
    echo "sidecar    : supervisor already up"
  else
    nohup "$DEPLOY/run-sidecar.sh" >/dev/null 2>&1 &
    echo "sidecar    : supervisor started (log: deploy/sidecar.log)"
  fi
  echo; status
}

stop() {
  # kill the supervisor FIRST so it doesn't relaunch the carrier we're stopping
  pkill -f "$SUP_MATCH"  2>/dev/null && echo "sidecar    : supervisor stopped" || echo "sidecar    : supervisor not running"
  pkill -f "$SIDE_MATCH" 2>/dev/null && echo "sidecar    : carrier stopped"    || true
  pkill -f "$CADDY_MATCH" 2>/dev/null && echo "caddy      : stopped"           || echo "caddy      : not running"
}

status() {
  echo "--- theseus stack ---"
  is_up "$CADDY_MATCH" && echo "caddy      : UP"   || echo "caddy      : down"
  is_up "$SUP_MATCH"   && echo "supervisor : UP"   || echo "supervisor : down"
  if is_up "$SIDE_MATCH"; then
    echo "carrier    : UP (pid $(pgrep -f "$SIDE_MATCH" | tr '\n' ' '))"
  else
    echo "carrier    : down"
  fi
  if lsof -nP -iUDP:39999 >/dev/null 2>&1; then
    echo "udp 39999  : bound"
  else
    echo "udp 39999  : FREE (carrier not listening)"
  fi
}

case "${1:-status}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; sleep 1; start ;;
  status)  status ;;
  logs)    tail -n 40 -f "$DEPLOY/sidecar.log" ;;
  *) echo "usage: $0 {start|stop|restart|status|logs}"; exit 1 ;;
esac
