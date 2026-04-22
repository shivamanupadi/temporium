#!/usr/bin/env bash
# Refuses the push if any previously-committed file under src/db/migrations/
# has been modified or deleted. Migrations are append-only — once a migration
# has shipped, its SQL and the associated snapshot entry are frozen. To change
# schema, add a new migration via `yarn db:generate --name <...>`.
#
# Editing history silently defeats `yarn db:check` (drizzle-kit diffs schema.ts
# against meta/*_snapshot.json, so tampering with both in sync looks clean).
# This check is the independent reference point — it trusts git, not the file.

set -euo pipefail

BASE="${1:-origin/main}"
MIGRATIONS_DIR="src/db/migrations"

# Fetch quietly so comparison works offline-ish; ignore if no network.
git fetch --quiet origin main 2>/dev/null || true

# Any file under migrations/ that exists at $BASE and is modified or deleted
# between $BASE and HEAD counts as history tampering. New files (added) are OK.
#
# meta/_journal.json is the one exception — `drizzle-kit generate` appends to
# it when a new migration is created. Snapshots are per-migration files
# (meta/NNNN_snapshot.json), so old snapshot files should never be modified.
tampered=$(git diff --name-only --diff-filter=MD "$BASE"...HEAD -- "$MIGRATIONS_DIR" \
  | grep -v '^apps/wallet/api/src/db/migrations/meta/_journal\.json$' \
  || true)

if [ -n "$tampered" ]; then
  echo ""
  echo "✗ Migration history was modified or deleted. Migrations are append-only."
  echo "  Generate a new migration instead: yarn db:generate --name <descriptive_name>"
  echo ""
  echo "  Offending files:"
  echo "$tampered" | sed 's/^/    /'
  echo ""
  exit 1
fi
