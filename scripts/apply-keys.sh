#!/usr/bin/env bash
# Copies the keys you set in <repo>/keys.txt into the local untracked files the
# dev servers read: apps/api/.dev.vars and database/.env.
#
# DATABASE_URL resolution (blank in keys.txt = separate DB is optional):
#   1. If keys.txt sets DATABASE_URL, probe it — use it if reachable.
#   2. Otherwise fall back to the repository default local test database
#      (postgres://gramledger_test:gramledger_test@localhost:5432/gramledger_test).
#
# Usage: bash scripts/apply-keys.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Repository default: a local Postgres test database (seeded with LGD data).
LOCAL_TEST_DATABASE_URL="postgres://gramledger_test:gramledger_test@localhost:5432/gramledger_test"

[ -f keys.txt ] || {
  echo "keys.txt not found; create it from the template in keys.txt first."
  exit 1
}

set -a
# shellcheck disable=SC1091
source keys.txt
set +a

# Probing requires the `pg` client (hoisted from the etl workspace).
probe() {
  local url="$1"
  DB="$url" node -e '
    const { Client } = require("pg");
    const c = new Client({ connectionString: process.env.DB, connectionTimeoutMillis: 3000 });
    c.connect().then(() => c.end().then(() => process.exit(0))).catch(() => process.exit(1));
  ' 2>/dev/null
}

resolve_db() {
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "$LOCAL_TEST_DATABASE_URL"
  elif probe "$DATABASE_URL"; then
    echo "$DATABASE_URL"
  else
    echo "!! DATABASE_URL in keys.txt unreachable; using the local test DB instead." >&2
    echo "$LOCAL_TEST_DATABASE_URL"
  fi
}

DB_URL="$(resolve_db)"
echo "Using database: $DB_URL"

if probe "$DB_URL"; then
  echo "Using database: $DB_URL"
else
  echo "!! WARNING: chosen database unreachable; the API will return 503 until it is up." >&2
fi

: > apps/api/.dev.vars
printf 'ENVIRONMENT=development\nLOG_LEVEL=debug\nDATABASE_URL=%s\n' "$DB_URL" > apps/api/.dev.vars
printf 'DATABASE_URL=%s\n' "$DB_URL" > database/.env
echo "Wrote apps/api/.dev.vars and database/.env"

echo "Done. Restart the servers (Ctrl+C, then npm run dev) to pick up the new DATABASE_URL."