#!/usr/bin/env bash
# promote-to-prod.sh — Promote staging build to production on Iran VPS
# Usage: ./scripts/promote-to-prod.sh
#   or:  ~/clantrader/scripts/promote-to-prod.sh
set -euo pipefail

STAGING_DIR="/home/ubuntu/clantrader-staging"
PROD_DIR="/home/ubuntu/clantrader"
BACKUP_DIR="/home/ubuntu/clantrader-backup-$(date +%Y%m%d-%H%M%S)"

echo "=== ClanTrader Promote Staging to Production ==="
echo "Staging:    $STAGING_DIR"
echo "Production: $PROD_DIR"
echo ""

# Step 1: Verify staging is running
echo "[1/6] Checking staging health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ] && [ "$HTTP_CODE" != "302" ]; then
  echo "  Error: Staging is not healthy (HTTP $HTTP_CODE)"
  echo "  Deploy to staging first: scripts/deploy-staging.sh"
  exit 1
fi
echo "  Staging is healthy (HTTP $HTTP_CODE)"
echo ""

# Step 2: Backup production
echo "[2/6] Backing up production..."
if [ -d "$PROD_DIR/.next" ]; then
  cp -a "$PROD_DIR" "$BACKUP_DIR"
  echo "  Backup: $BACKUP_DIR"
else
  echo "  No existing production build to backup (first deploy)"
fi
echo ""

# Step 3: Backup production .env
echo "[3/6] Preserving production .env..."
PROD_ENV_BACKUP=""
if [ -f "$PROD_DIR/.env" ]; then
  PROD_ENV_BACKUP="$(mktemp)"
  cp "$PROD_DIR/.env" "$PROD_ENV_BACKUP"
  echo "  .env backed up"
else
  echo "  Warning: No production .env found"
fi
echo ""

# Step 4: Sync staging to production
echo "[4/6] Syncing staging to production..."
mkdir -p "$PROD_DIR"
rsync -a --delete \
  --exclude='.env' \
  --exclude='logs/' \
  --exclude='public/uploads/' \
  --exclude='node_modules/.cache/' \
  --exclude='ecosystem.config.cjs' \
  "$STAGING_DIR/" "$PROD_DIR/"
echo "  Sync complete"

# Restore production .env
if [ -n "$PROD_ENV_BACKUP" ]; then
  cp "$PROD_ENV_BACKUP" "$PROD_DIR/.env"
  rm -f "$PROD_ENV_BACKUP"
  echo "  .env restored"
fi
echo ""

# Step 5: Run database migration (NO --accept-data-loss for production)
echo "[5/6] Running production database migration..."
cd "$PROD_DIR"
if npx prisma db push 2>&1; then
  echo "  Database synced."
else
  echo "  Error: Database migration failed!"
  echo "  This may mean the migration would cause data loss."
  echo "  Review the schema changes and run manually if safe."
  echo ""
  echo "  Rolling back..."
  if [ -d "$BACKUP_DIR" ]; then
    rm -rf "$PROD_DIR"
    mv "$BACKUP_DIR" "$PROD_DIR"
    echo "  Rollback complete."
  fi
  exit 1
fi
echo ""

# Ensure production ecosystem config exists
cat > "$PROD_DIR/ecosystem.config.cjs" << 'EOFPM2'
module.exports = {
  apps: [
    {
      name: "clantrader",
      script: "node_modules/.bin/tsx",
      args: "-r tsconfig-paths/register server.ts",
      cwd: "/home/ubuntu/clantrader",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: "1G",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/home/ubuntu/clantrader/logs/pm2-error.log",
      out_file: "/home/ubuntu/clantrader/logs/pm2-out.log",
      merge_logs: true,
    },
  ],
};
EOFPM2

# Step 6: Restart production
echo "[6/6] Restarting production..."
mkdir -p "$PROD_DIR/logs"

if pm2 describe clantrader > /dev/null 2>&1; then
  pm2 restart clantrader
else
  cd "$PROD_DIR"
  pm2 start ecosystem.config.cjs
  pm2 save
fi

# Health check with retries
echo ""
echo "Waiting for production to start..."
HEALTHY=false
for i in 1 2 3 4 5 6; do
  sleep 5
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "  Production is up! (HTTP $HTTP_CODE)"
    HEALTHY=true
    break
  fi
  if [ "$i" = "6" ]; then
    echo "  Error: Production health check failed after 30s (HTTP $HTTP_CODE)"
  else
    echo "  Attempt $i/6: HTTP $HTTP_CODE — retrying..."
  fi
done

# Auto-rollback if health check fails
if [ "$HEALTHY" = false ] && [ -d "$BACKUP_DIR" ]; then
  echo ""
  echo "=== AUTO-ROLLBACK ==="
  echo "Production failed health check. Rolling back..."
  rm -rf "$PROD_DIR"
  mv "$BACKUP_DIR" "$PROD_DIR"
  if pm2 describe clantrader > /dev/null 2>&1; then
    pm2 restart clantrader
  else
    cd "$PROD_DIR"
    pm2 start ecosystem.config.cjs
    pm2 save
  fi
  echo "Rollback complete. Production restored from backup."
  echo "Check staging logs for issues: pm2 logs clantrader-staging"
  exit 1
fi

echo ""
echo "=== Production deploy complete ==="
pm2 status clantrader
echo ""
echo "Production URL: https://clantrader.ir"
echo "Check logs:     pm2 logs clantrader"
if [ -d "$BACKUP_DIR" ]; then
  echo ""
  echo "Backup saved at: $BACKUP_DIR"
  echo "Remove when confirmed stable: rm -rf $BACKUP_DIR"
fi
