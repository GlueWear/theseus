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
GUID="gui/$(id -u)"

mkdir -p "$AGENTS"

# stop any hand-run / stack.sh instances first so we don't double up
pkill -f run-sidecar.sh 2>/dev/null || true
pkill -f transport-sidecar.mjs 2>/dev/null || true
pkill -f "caddy run --config" 2>/dev/null || true
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

for label in com.theseus.sidecar com.theseus.caddy; do
  plist="$AGENTS/$label.plist"
  [ -f "$plist" ] || continue
  launchctl bootout "$GUID/$label" 2>/dev/null || true
  launchctl bootstrap "$GUID" "$plist" 2>/dev/null || launchctl load -w "$plist" 2>/dev/null || true
  echo "loaded $label"
done

echo
echo "Installed. The stack now starts at login and auto-restarts."
echo "Check:  launchctl list | grep theseus"
echo "Logs:   tail -f $DEPLOY/sidecar.launchd.log"
echo "Remove: deploy/uninstall-launchd.sh"
