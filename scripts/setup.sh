#!/usr/bin/env bash
# Bootstraps the repository: installs dependencies, sets up git hooks.
# Usage: npm run setup   (or bash scripts/setup.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Installing JS/TS workspace dependencies (apps/api, database)"
npm install

echo "==> Installing Flutter dependencies (apps/mobile)"
if command -v flutter >/dev/null 2>&1; then
  (cd apps/mobile && flutter pub get)
else
  echo "!! flutter not found in PATH. Run setup again after installing Flutter."
fi

echo "==> Installing git hooks"
bash scripts/install-git-hooks.sh

echo "==> Copying example environment files (if absent)"
[ -f apps/api/.dev.vars ] || cp apps/api/.dev.vars.example apps/api/.dev.vars
[ -f database/.env ] || cp database/.env.example database/.env

echo "Setup complete."
