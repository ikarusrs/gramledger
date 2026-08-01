#!/usr/bin/env bash
# Runs node-pg-migrate with DATABASE_URL loaded from an environment file.
# Usage: bash scripts/run-migrate.sh [--env FILE] [args...]
#   (default env file: .env for dev; --env .env.test for test DB)
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env"
if [ "${1:-}" = "--env" ]; then
  ENV_FILE="$2"
  shift 2
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "!! $ENV_FILE not found. Copy $ENV_FILE.example and set DATABASE_URL." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "!! DATABASE_URL is empty in $ENV_FILE" >&2
  exit 1
fi

exec npx node-pg-migrate "$@"
