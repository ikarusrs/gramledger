#!/usr/bin/env bash
# Copies the keys you set in <repo>/keys.txt into the local untracked files the
# dev servers read: apps/api/.dev.vars and database/.env.
# Usage: bash scripts/apply-keys.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

[ -f keys.txt ] || { echo "keys.txt not found; create it from the template first."; exit 1; }

# shellcheck disable=SC1090
# Source so $VAR names already set in the shell keep working; values here win.
set -a
# shellcheck disable=SC1091
source keys.txt
set +a

if [ -n "${DATABASE_URL:-}" ]; then
  : > apps/api/.dev.vars
  printf 'ENVIRONMENT=development\nLOG_LEVEL=debug\nDATABASE_URL=%s\n' "$DATABASE_URL" > apps/api/.dev.vars
  printf 'DATABASE_URL=%s\n' "$DATABASE_URL" > database/.env
  echo "Wrote DATABASE_URL to apps/api/.dev.vars and database/.env"
else
  echo "!! DATABASE_URL is empty in keys.txt — API will run but /v1 returns 503 until you set it."
fi

echo "Done. Paste your keys into keys.txt and re-run this script."
echo "Run: npm run dev:api (Worker on :8787) and npm run dev:web (web on :5173)."