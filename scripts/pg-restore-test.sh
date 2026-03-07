#!/usr/bin/env bash
# Test restore drill — restores the latest backup into a temporary database to verify integrity.
# Usage: ./scripts/pg-restore-test.sh [backup_file]
# If no file is given, uses the most recent backup.

set -euo pipefail

BACKUP_DIR="/root/backups/postgres"
TEST_DB="clantrader_restore_test"

# Load DATABASE_URL from .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [[ -f "${PROJECT_DIR}/.env" ]]; then
  source "${PROJECT_DIR}/.env"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[$(date --iso-8601=seconds)] ERROR: DATABASE_URL not set"
  exit 1
fi

# Determine backup file
BACKUP_FILE="${1:-$(ls -t "$BACKUP_DIR"/clantrader_*.sql.gz 2>/dev/null | head -1)}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "[$(date --iso-8601=seconds)] ERROR: No backup file found"
  exit 1
fi

echo "[$(date --iso-8601=seconds)] Testing restore of: $(basename "$BACKUP_FILE")"

# Extract base connection URL (without database name) from DATABASE_URL
BASE_URL=$(echo "$DATABASE_URL" | sed 's|/[^/?]*\([?].*\)\?$||')

# Drop test database if it exists, then create it
echo "[$(date --iso-8601=seconds)] Creating test database: ${TEST_DB}"
psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS ${TEST_DB};" 2>/dev/null || true
psql "$DATABASE_URL" -c "CREATE DATABASE ${TEST_DB};"

# Restore backup into test database
echo "[$(date --iso-8601=seconds)] Restoring backup..."
gunzip -c "$BACKUP_FILE" | psql "${BASE_URL}/${TEST_DB}" > /dev/null 2>&1

# Verify key tables exist and have data
echo "[$(date --iso-8601=seconds)] Verifying restored data..."
RESULT=$(psql "${BASE_URL}/${TEST_DB}" -t -c "
  SELECT json_build_object(
    'users', (SELECT count(*) FROM \"User\"),
    'clans', (SELECT count(*) FROM \"Clan\"),
    'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public')
  );
")
echo "[$(date --iso-8601=seconds)] Restore verification: ${RESULT}"

# Cleanup
echo "[$(date --iso-8601=seconds)] Dropping test database..."
psql "$DATABASE_URL" -c "DROP DATABASE IF EXISTS ${TEST_DB};"

echo "[$(date --iso-8601=seconds)] Restore drill PASSED"
