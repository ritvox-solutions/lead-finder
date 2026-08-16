#!/usr/bin/env bash
# update-tunnel-url.sh
# Polls the cloudflared quick-tunnel log, detects a URL change, and
# automatically updates LEADFINDER_AGENT_URL on the Vercel project so the
# dashboard always points at the current tunnel.

set -euo pipefail

TOK_FILE="/home/anikethan/Desktop/leadfinder/.data/.vercel-token"
CF_LOG="/home/anikethan/Desktop/leadfinder/.data/cloudflared.log"
STATE_FILE="/home/anikethan/Desktop/leadfinder/.data/last-tunnel-url.txt"
INTERVAL=120   # check every 2 min

# Read the Vercel token (avoid putting it inline in the script).
if [ -f "$TOK_FILE" ]; then
  VERCEL_TOKEN="$(cat "$TOK_FILE")"
else
  echo "[tunnel-url] $TOK_FILE missing — skipping Vercel update" >&2
  exit 0
fi
export VERCEL_TOKEN

mkdir -p /home/anikethan/Desktop/leadfinder/.data

LAST_URL=""
if [ -f "$STATE_FILE" ]; then LAST_URL="$(cat "$STATE_FILE")"; fi

while true; do
  sleep "$INTERVAL"
  if [ ! -f "$CF_LOG" ]; then continue; fi
  NEW_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$CF_LOG" | grep -v 'https://api\.trycloudflare\.com' | tail -1 || true)"
  if [ -z "$NEW_URL" ]; then continue; fi
  if [ "$NEW_URL" = "$LAST_URL" ]; then continue; fi

  echo "[tunnel-url] URL changed: $LAST_URL -> $NEW_URL"
  LAST_URL="$NEW_URL"
  echo "$NEW_URL" > "$STATE_FILE"

  # Update the Vercel env var for both production + preview, then redeploy.
  set +e
  npx vercel env rm LEADFINDER_AGENT_URL production --yes >/dev/null 2>&1
  npx vercel env add LEADFINDER_AGENT_URL production <<< "$NEW_URL" >/dev/null 2>&1
  npx vercel env rm LEADFINDER_AGENT_URL preview --yes >/dev/null 2>&1
  npx vercel env add LEADFINDER_AGENT_URL preview <<< "$NEW_URL" >/dev/null 2>&1
  npx vercel --prod --token "$VERCEL_TOKEN" --confirm --no-clipboard >/dev/null 2>&1
  set -e
  echo "[tunnel-url] Vercel env updated + redeployed for $NEW_URL"
done
