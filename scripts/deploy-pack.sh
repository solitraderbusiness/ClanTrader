#!/usr/bin/env bash
# deploy-pack.sh — Run on US VPS to create a deployment tarball
# Usage: ./scripts/deploy-pack.sh
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"
DEPLOY_FILE="$PROJECT_DIR/deploy.tar.gz"

echo "=== ClanTrader Deploy Pack ==="
echo "Project: $PROJECT_DIR"
echo ""

# Step 1: Build
echo "[1/3] Building..."
npm run build
npx prisma generate
echo ""

# Step 2: Collect files list
echo "[2/3] Packing deployment tarball..."

# Build list of files to include
FILES=(
  .next/
  node_modules/
  prisma/
  public/
  src/
  server.ts
  package.json
  package-lock.json
  tsconfig.json
  ecosystem.config.cjs
  scripts/deploy-unpack.sh
  scripts/deploy-staging.sh
  scripts/promote-to-prod.sh
  CLAUDE.iran.md
)

# Add optional config files if they exist
for f in next.config.ts tailwind.config.ts postcss.config.mjs components.json; do
  [ -f "$f" ] && FILES+=("$f")
done

tar czf "$DEPLOY_FILE" \
  --exclude='node_modules/.cache' \
  --exclude='.next/cache' \
  --exclude='public/uploads/*' \
  "${FILES[@]}"

echo ""

# Step 3: Show result
SIZE=$(du -h "$DEPLOY_FILE" | cut -f1)
echo "[3/3] Done!"
echo ""
echo "  File: $DEPLOY_FILE"
echo "  Size: $SIZE"
echo ""
echo "=== Transfer to Iran VPS ==="
echo ""
echo "  1. Download to your laptop (Starlink):"
echo "     scp root@$(hostname -I | awk '{print $1}'):$DEPLOY_FILE ."
echo ""
echo "  2. Switch to Iranian ISP, upload:"
echo "     scp deploy.tar.gz ubuntu@37.32.10.153:~/"
echo ""
echo "  3. SSH to Iran VPS and deploy to STAGING first:"
echo "     ssh ubuntu@37.32.10.153"
echo "     ~/clantrader-staging/scripts/deploy-staging.sh ~/deploy.tar.gz"
echo ""
echo "  4. Test staging at https://staging.clantrader.ir"
echo ""
echo "  5. Promote staging to production:"
echo "     ~/clantrader/scripts/promote-to-prod.sh"
echo ""
