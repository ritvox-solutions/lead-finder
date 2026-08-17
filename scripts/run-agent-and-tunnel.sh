#!/usr/bin/env bash
# run-agent-and-tunnel.sh
# Runs the LeadFinder agent (with its HTTP state server) and a Cloudflare
# quick-tunnel in front of it, as a single supervised process.

set -euo pipefail

export PATH="/home/anikethan/.local/bin:$PATH"
cd /home/anikethan/Desktop/leadfinder

# Load env
if [ -f .env ]; then export $(grep -v '^#' .env | xargs); fi

export AGENT_PORT=8090
export AGENT_INTERVAL_SECONDS="${AGENT_INTERVAL_SECONDS:-1800}"
export AUTO_SCAN_ENABLED="${AUTO_SCAN_ENABLED:-false}"

mkdir -p .data
CF_LOG=".data/cloudflared.log"
URL_FILE=".data/last-tunnel-url.txt"

# Start cloudflared in the background, logging to a file we can poll.
: > "$CF_LOG"
cloudflared tunnel --url "http://localhost:${AGENT_PORT}" >"$CF_LOG" 2>&1 &
CF_PID=$!
echo "[run] cloudflared PID=$CF_PID (logging to $CF_LOG)"

cleanup() {
  echo "[run] shutting down..."
  kill "$CF_PID" 2>/dev/null || true
  wait "$CF_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for the first tunnel URL to appear, then record it.
for i in $(seq 1 15); do
  if grep -qE "Your quick Tunnel has been created" "$CF_LOG" 2>/dev/null; then
    NEW_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" | tail -1)"
    echo "$NEW_URL" > "$URL_FILE"
    echo "[run] tunnel live: $NEW_URL"
    break
  fi
  sleep 2
done

# Run the agent (foreground — systemd restarts on exit).
echo "[run] starting agent loop (interval=${AGENT_INTERVAL_SECONDS}s, autoScan=${AUTO_SCAN_ENABLED})"
exec npx tsx agent/index.ts
