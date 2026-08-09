#!/usr/bin/env bash
# Run tests for all projects.
# Usage: npm run test
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Vitest (apps/api)"
npm run test --workspace apps/api

echo "==> Vitest (etl)"
npm run test --workspace etl

echo "==> Vitest (apps/web)"
npm run test --workspace apps/web

echo "==> Flutter test (apps/mobile)"
if command -v flutter >/dev/null 2>&1; then
  (cd apps/mobile && flutter test)
else
  echo "!! flutter not found; skipping flutter test"
fi

echo "Tests complete."
