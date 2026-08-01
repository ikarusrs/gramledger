#!/usr/bin/env bash
# Build all projects. No deployment artifacts are produced.
# Usage: npm run build
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Type-check (apps/api)"
npm run build --workspace apps/api

echo "==> Flutter build web (apps/mobile)"
if command -v flutter >/dev/null 2>&1; then
  (cd apps/mobile && flutter build web)
else
  echo "!! flutter not found; skipping flutter build"
fi

echo "Build complete."
