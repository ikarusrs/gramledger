#!/usr/bin/env bash
# Runs the API Worker (:8787) and the web app (:5173) together, one command.
# The web Vite dev server proxies /v1 and /health to the Worker, so the
# browser talks to one origin. Ctrl+C stops both.
#
# Usage: npm run dev   (or bash scripts/dev.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_PID=""
WEB_PID=""

cleanup() {
  echo ""
  echo "Stopping dev servers..."
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting API worker on :8787"
npm run dev:api &
API_PID=$!

sleep 1
echo "==> Starting web app on :5173"
npm run dev:web &
WEB_PID=$!

echo ""
echo "GramLedger dev servers:"
echo "  API   http://localhost:8787/health"
echo "  Web   http://localhost:5173  (proxies /v1 -> :8787)"
echo "Press Ctrl+C to stop both."
echo ""

wait "$API_PID"