#!/usr/bin/env bash
# Automated PostgreSQL backup with 7-day retention.
# Usage: ./scripts/pg-backup.sh
# Cron:  0 */6 * * * /root/projects/clantrader/scripts/pg-backup.sh >> /root/projects/clantrader/logs/pg-backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/root/backups/postgres"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/clantrader_${TIMESTAMP}.sql.gz"

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

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Run pg_dump with gzip compression
echo "[$(date --iso-8601=seconds)] Starting backup..."
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Verify the backup file is not empty
FILESIZE=$(stat -c%s "$BACKUP_FILE")
if [[ "$FILESIZE" -lt 100 ]]; then
  echo "[$(date --iso-8601=seconds)] ERROR: Backup file too small (${FILESIZE} bytes), likely failed"
  rm -f "$BACKUP_FILE"
  exit 1
fi

echo "[$(date --iso-8601=seconds)] Backup complete: ${BACKUP_FILE} ($(numfmt --to=iec "$FILESIZE"))"

# Remove backups older than retention period
DELETED=$(find "$BACKUP_DIR" -name "clantrader_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [[ "$DELETED" -gt 0 ]]; then
  echo "[$(date --iso-8601=seconds)] Cleaned up ${DELETED} old backup(s)"
fi

echo "[$(date --iso-8601=seconds)] Done. Active backups: $(ls -1 "$BACKUP_DIR"/clantrader_*.sql.gz 2>/dev/null | wc -l)"
