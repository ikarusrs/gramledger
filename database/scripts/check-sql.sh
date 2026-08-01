#!/usr/bin/env bash
# Lightweight SQL lint: enforces consistent formatting on migration/seed files
# using pg_format if available; otherwise a no-op with a notice.
# Pass --fix to rewrite files in place (needs pg_format installed).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

FIX=0
[ "${1:-}" = "--fix" ] && FIX=1

if ! command -v pg_format >/dev/null 2>&1; then
  echo "!! pg_format not found. Install pg_format (Python: pip install pg_format) "
  echo "   or add your own SQL formatter to 'database/scripts/check-sql.sh'."
  echo "   Skipping SQL formatting."
  exit 0
fi

FILES=()
while IFS= read -r f; do FILES+=("$f"); done < <(find migrations seeds -name '*.sql' -type f 2>/dev/null || true)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No SQL files to format."
  exit 0
fi

if [ "$FIX" = "1" ]; then
  pg_format -i "${FILES[@]}"
  echo "Formatted ${#FILES[@]} SQL file(s)."
else
  for f in "${FILES[@]}"; do
    if ! pg_format --no-extra-line "$f" | diff -q "$f" - >/dev/null; then
      echo "!! $f is not formatted. Run 'npm run db:lint -- --fix'."
      exit 1
    fi
  done
  echo "SQL formatting OK."
fi
