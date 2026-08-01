#!/usr/bin/env bash
# Installs the repository git hooks via core.hooksPath.
# Hooks live in .githooks/ and are plain executables (no extra tooling).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

mkdir -p .githooks
git config core.hooksPath .githooks

for hook in .githooks/*; do
  [ -f "$hook" ] && chmod +x "$hook"
done

echo "Git hooks installed from .githooks/"
