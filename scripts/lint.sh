#!/usr/bin/env bash
# Lint all projects. Pass --fix to auto-fix where supported.
# Usage: npm run lint   |   npm run lint:fix
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ARGS=()
if [ "${1:-}" = "--fix" ]; then
  ARGS+=(-- --fix)
fi

echo "==> ESLint (apps/api, database)"
npm run lint --workspaces --if-present "${ARGS[@]}"

echo "==> Flutter analyze (apps/mobile)"
if command -v flutter >/dev/null 2>&1; then
  (cd apps/mobile && flutter analyze)
else
  echo "!! flutter not found; skipping flutter analyze"
fi

echo "Lint complete."
