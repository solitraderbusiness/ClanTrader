#!/usr/bin/env bash
# deploy-unpack.sh — Run on Iran VPS to deploy from tarball
# Usage: ./scripts/deploy-unpack.sh [path-to-tarball]
#   or:  ~/clantrader/scripts/deploy-unpack.sh ~/deploy.tar.gz
set -euo pipefail

APP_DIR="/home/ubuntu/clantrader"
TARBALL="${1:-$HOME/deploy.tar.gz}"

if [ ! -f "$TARBALL" ]; then
  echo "Error: Tarball not found at $TARBALL"
  echo "Usage: $0 [path-to-deploy.tar.gz]"
  exit 1
fi

echo "=== ClanTrader Deploy Unpack ==="
echo "Tarball: $TARBALL"
echo "App dir: $APP_DIR"
echo ""

# Step 1: Create app directory if needed
mkdir -p "$APP_DIR"

# Step 2: Extract tarball
echo "[1/4] Extracting..."
tar xzf "$TARBALL" -C "$APP_DIR"
echo ""

# Step 3: Run database migrations (if DB is reachable)
echo "[2/4] Running database migrations..."
cd "$APP_DIR"
if npx prisma db push --accept-data-loss 2>/dev/null; then
  echo "  Database synced."
else
  echo "  Warning: Database sync failed (may need .env configured first)."
fi
echo ""

# Step 4: Update ecosystem config paths for Iran VPS
echo "[3/4] Updating PM2 config..."
# Create Iran-specific ecosystem config
cat > "$APP_DIR/ecosystem.config.cjs" << 'EOFPM2'
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
echo ""

# Step 5: Restart PM2
echo "[4/4] Restarting app..."
mkdir -p "$APP_DIR/logs"

if pm2 describe clantrader > /dev/null 2>&1; then
  pm2 restart clantrader
else
  cd "$APP_DIR"
  pm2 start ecosystem.config.cjs
  pm2 save
fi

echo ""
echo "=== Deploy complete ==="
pm2 status clantrader
echo ""
echo "Check logs: pm2 logs clantrader"
