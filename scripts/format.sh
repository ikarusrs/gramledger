#!/usr/bin/env bash
# Format all projects. Pass --check to verify without writing.
# Usage: npm run format   |   npm run format:check
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

PRETTIER_ARGS=(--write)
DART_ARGS=()
if [ "$CHECK" = "1" ]; then
  PRETTIER_ARGS=(--check)
  DART_ARGS=(--set-exit-if-changed --output=none)
fi

echo "==> Prettier"
npx prettier "${PRETTIER_ARGS[@]}" .

echo "==> dart format (apps/mobile)"
if command -v dart >/dev/null 2>&1; then
  (cd apps/mobile && dart format "${DART_ARGS[@]}" lib test)
else
  echo "!! dart not found; skipping dart format"
fi

echo "Format complete."
