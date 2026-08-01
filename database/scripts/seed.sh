#!/usr/bin/env bash
# Runs all seed scripts against DATABASE_URL from database/.env.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env ]; then
  echo "!! database/.env not found. Run 'npm run setup' or copy .env.example." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "!! DATABASE_URL is empty in database/.env" >&2
  exit 1
fi

for seed in seeds/*.sql; do
  [ -e "$seed" ] || continue
  echo "==> Applying $seed"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$seed"
done

echo "Seed complete."
