#!/usr/bin/env bash
# Install launchd agents so the theseus stack survives reboot + logout and
# auto-restarts, with NO terminal and no manual command. macOS only.
#
#   deploy/install-launchd.sh     # install + start
#   deploy/uninstall-launchd.sh   # stop + remove
#
# NOTE: once installed, launchd OWNS the processes. Control them with launchctl
# or the uninstall script -- not `stack.sh stop` (KeepAlive would relaunch).
set -u

HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY="$HERE/deploy"
AGENTS="$HOME/Library/LaunchAgents"
CADDY="$(command -v caddy || true)"
NODE="$(command -v node || true)"
GUID="gui/$(id -u)"

mkdir -p "$AGENTS"

# 1) bootout any already-loaded agents FIRST so launchd cleanly stops its own
#    processes. (pkilling launchd-managed procs races with the re-bootstrap.)
for label in com.theseus.sidecar com.theseus.caddy com.theseus.broker; do
  launchctl bootout "$GUID/$label" 2>/dev/null || true
done
sleep 1
# 2) kill any leftover hand-run (nohup/stack.sh) instances
pkill -f run-sidecar.sh 2>/dev/null || true
pkill -f transport-sidecar.mjs 2>/dev/null || true
pkill -f "caddy run --config" 2>/dev/null || true
pkill -f broker.mjs 2>/dev/null || true
sleep 1

write_plist() {  # <label> <log> <program-args...>
  local label="$1" log="$2"; shift 2
  {
    echo '<?xml version="1.0" encoding="UTF-8"?>'
    echo '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
    echo '<plist version="1.0"><dict>'
    echo "  <key>Label</key><string>$label</string>"
    echo '  <key>ProgramArguments</key><array>'
    for a in "$@"; do echo "    <string>$a</string>"; done
    echo '  </array>'
    echo '  <key>RunAtLoad</key><true/>'
    echo '  <key>KeepAlive</key><true/>'
    echo "  <key>StandardOutPath</key><string>$log</string>"
    echo "  <key>StandardErrorPath</key><string>$log</string>"
    echo '</dict></plist>'
  } > "$AGENTS/$label.plist"
}

write_plist com.theseus.sidecar "$DEPLOY/sidecar.launchd.log" /bin/bash "$DEPLOY/run-sidecar.sh"

if [ -n "$CADDY" ]; then
  write_plist com.theseus.caddy "$DEPLOY/caddy.launchd.log" "$CADDY" run --config "$DEPLOY/Caddyfile"
else
  echo "WARNING: caddy not found; skipping caddy agent (brew install caddy, then re-run)"
fi

if [ -n "$NODE" ]; then
  write_plist com.theseus.broker "$DEPLOY/broker.launchd.log" "$NODE" "$DEPLOY/broker.mjs" --moons-file "$DEPLOY/broker-moons.json" --landing /
else
  echo "WARNING: node not found; skipping broker agent"
fi

for label in com.theseus.sidecar com.theseus.caddy com.theseus.broker; do
  plist="$AGENTS/$label.plist"
  [ -f "$plist" ] || continue
  if launchctl bootstrap "$GUID" "$plist" 2>/dev/null; then
    echo "loaded $label"
  elif launchctl print "$GUID/$label" >/dev/null 2>&1; then
    echo "loaded $label (already present)"
  else
    echo "WARN: failed to load $label -- retry: launchctl bootstrap $GUID \"$plist\""
  fi
done

echo
echo "Installed. The stack now starts at login and auto-restarts."
echo "Check:  launchctl list | grep theseus"
echo "Logs:   tail -f $DEPLOY/sidecar.launchd.log"
echo "Remove: deploy/uninstall-launchd.sh"
