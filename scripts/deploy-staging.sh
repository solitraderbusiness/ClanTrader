#!/usr/bin/env bash
# deploy-staging.sh — Deploy tarball to staging environment on Iran VPS
# Usage: ./scripts/deploy-staging.sh [path-to-tarball]
#   or:  ~/clantrader-staging/scripts/deploy-staging.sh ~/deploy.tar.gz
set -euo pipefail

STAGING_DIR="/home/ubuntu/clantrader-staging"
TARBALL="${1:-$HOME/deploy.tar.gz}"

if [ ! -f "$TARBALL" ]; then
  echo "Error: Tarball not found at $TARBALL"
  echo "Usage: $0 [path-to-deploy.tar.gz]"
  exit 1
fi

echo "=== ClanTrader Deploy to Staging ==="
echo "Tarball: $TARBALL"
echo "Staging: $STAGING_DIR"
echo ""

# Step 1: Create staging directory if needed
mkdir -p "$STAGING_DIR"

# Step 2: Backup .env before extraction (tar will overwrite everything)
ENV_BACKUP=""
if [ -f "$STAGING_DIR/.env" ]; then
  ENV_BACKUP="$(mktemp)"
  cp "$STAGING_DIR/.env" "$ENV_BACKUP"
  echo "[1/5] Backed up .env"
else
  echo "[1/5] No existing .env to backup"
fi
echo ""

# Step 3: Extract tarball
echo "[2/5] Extracting..."
tar xzf "$TARBALL" -C "$STAGING_DIR"
echo ""

# Step 4: Restore .env
if [ -n "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" "$STAGING_DIR/.env"
  rm -f "$ENV_BACKUP"
  echo "[3/5] Restored .env"
else
  echo "[3/5] Warning: No .env file — run setup-iran-vps.sh first or create one manually"
fi
echo ""

# Step 5: Run database migrations
echo "[4/5] Running database migrations..."
cd "$STAGING_DIR"
if npx prisma db push --accept-data-loss 2>/dev/null; then
  echo "  Database synced."
else
  echo "  Warning: Database sync failed (check .env DATABASE_URL)."
fi
echo ""

# Step 6: Update PM2 config and restart
echo "[5/5] Restarting staging app..."
mkdir -p "$STAGING_DIR/logs"

# Create staging-specific ecosystem config
cat > "$STAGING_DIR/ecosystem.config.cjs" << 'EOFPM2'
module.exports = {
  apps: [
    {
      name: "clantrader-staging",
      script: "node_modules/.bin/tsx",
      args: "-r tsconfig-paths/register server.ts",
      cwd: "/home/ubuntu/clantrader-staging",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: "1G",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/home/ubuntu/clantrader-staging/logs/pm2-error.log",
      out_file: "/home/ubuntu/clantrader-staging/logs/pm2-out.log",
      merge_logs: true,
    },
  ],
};
EOFPM2

if pm2 describe clantrader-staging > /dev/null 2>&1; then
  pm2 restart clantrader-staging
else
  cd "$STAGING_DIR"
  pm2 start ecosystem.config.cjs
  pm2 save
fi

# Health check with retries
echo ""
echo "Waiting for staging to start..."
for i in 1 2 3 4 5 6; do
  sleep 5
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "  Staging is up! (HTTP $HTTP_CODE)"
    break
  fi
  if [ "$i" = "6" ]; then
    echo "  Warning: Staging health check failed after 30s (HTTP $HTTP_CODE)"
    echo "  Check logs: pm2 logs clantrader-staging"
  else
    echo "  Attempt $i/6: HTTP $HTTP_CODE — retrying..."
  fi
done

echo ""
echo "=== Staging deploy complete ==="
pm2 status clantrader-staging
echo ""
echo "Staging URL: https://staging.clantrader.ir"
echo "Check logs:  pm2 logs clantrader-staging"
echo ""
echo "After testing, promote to production:"
echo "  ~/clantrader/scripts/promote-to-prod.sh"
