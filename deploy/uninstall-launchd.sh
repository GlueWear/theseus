#!/usr/bin/env bash
# Remove the theseus launchd agents (stop + delete). After this, use stack.sh
# for manual control again.
set -u

HERE="$(cd "$(dirname "$0")/.." && pwd)"
AGENTS="$HOME/Library/LaunchAgents"
GUID="gui/$(id -u)"

for label in com.theseus.sidecar com.theseus.caddy com.theseus.broker; do
  launchctl bootout "$GUID/$label" 2>/dev/null \
    || launchctl unload -w "$AGENTS/$label.plist" 2>/dev/null || true
  rm -f "$AGENTS/$label.plist"
  echo "removed $label"
done

# make sure nothing lingers
pkill -f run-sidecar.sh 2>/dev/null || true
pkill -f transport-sidecar.mjs 2>/dev/null || true
pkill -f "caddy run --config" 2>/dev/null || true
pkill -f broker.mjs 2>/dev/null || true
echo "done"
