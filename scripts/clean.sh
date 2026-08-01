#!/usr/bin/env bash
# Remove generated/build artifacts. Does not remove node_modules or .dart_tool caches
# unless --full is passed.
# Usage: npm run clean
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FULL=0
[ "${1:-}" = "--full" ] && FULL=1

echo "==> Cleaning build artifacts"
rm -rf apps/api/dist apps/api/coverage
rm -rf etl/dist etl/coverage etl/.dead-letter
rm -rf apps/mobile/build apps/mobile/coverage apps/mobile/.dart_tool/flutter_build
rm -rf database/node_modules/.cache

if [ "$FULL" = "1" ]; then
  echo "==> Full clean (node_modules, .dart_tool)"
  rm -rf node_modules
  rm -rf apps/api/node_modules database/node_modules etl/node_modules
  rm -rf apps/mobile/.dart_tool apps/mobile/.packages apps/mobile/pubspec.lock
fi

echo "Clean complete."
