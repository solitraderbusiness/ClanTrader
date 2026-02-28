#!/usr/bin/env bash
# setup-iran-vps.sh — One-time setup for fresh Ubuntu VPS (Iran production server)
# Run as: sudo bash setup-iran-vps.sh
#
# Installs: Node 20, PostgreSQL 16, Redis 7, nginx, PM2, Certbot
# Configures: database, firewall, nginx reverse proxy, SSL
set -euo pipefail

DOMAIN="${1:-clantrader.ir}"
STAGING_DOMAIN="staging.$DOMAIN"
APP_USER="ubuntu"
APP_DIR="/home/$APP_USER/clantrader"
STAGING_DIR="/home/$APP_USER/clantrader-staging"
DB_NAME="clantrader_prod"
DB_STAGING="clantrader_staging"
DB_USER="clantrader"
DB_PASS="$(openssl rand -hex 16)"

echo "============================================"
echo "  ClanTrader Iran VPS Setup"
echo "  Production: $DOMAIN"
echo "  Staging:    $STAGING_DOMAIN"
echo "============================================"
echo ""

# -----------------------------------------------
# 1. System update
# -----------------------------------------------
echo "[1/8] Updating system..."
apt update && apt upgrade -y
apt install -y curl wget gnupg2 lsb-release software-properties-common ufw git
echo ""

# -----------------------------------------------
# 2. Node.js 20
# -----------------------------------------------
echo "[2/8] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "  Node: $(node -v)"
echo "  npm: $(npm -v)"

# Install PM2 globally
npm install -g pm2
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" || true
echo ""

# -----------------------------------------------
# 3. PostgreSQL 16
# -----------------------------------------------
echo "[3/8] Installing PostgreSQL 16..."
if ! command -v psql &> /dev/null; then
  sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
  apt update
  apt install -y postgresql-16
fi

# Create database and user
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "  User $DB_USER already exists"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || echo "  Database $DB_NAME already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -c "CREATE DATABASE $DB_STAGING OWNER $DB_USER;" 2>/dev/null || echo "  Database $DB_STAGING already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_STAGING TO $DB_USER;"
echo "  PostgreSQL ready (production + staging databases)"
echo ""

# -----------------------------------------------
# 4. Redis
# -----------------------------------------------
echo "[4/8] Installing Redis..."
if ! command -v redis-server &> /dev/null; then
  apt install -y redis-server
fi
systemctl enable redis-server
systemctl start redis-server
echo "  Redis: $(redis-server --version | head -1)"
echo ""

# -----------------------------------------------
# 5. nginx
# -----------------------------------------------
echo "[5/8] Installing nginx..."
if ! command -v nginx &> /dev/null; then
  apt install -y nginx
fi
systemctl enable nginx

# Create nginx config
cat > "/etc/nginx/sites-available/$DOMAIN" << EOFNGINX
server {
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Socket.io support
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Increase max upload size for images
    client_max_body_size 10M;

    listen 80;
    listen [::]:80;
}
EOFNGINX

# Create staging nginx config
cat > "/etc/nginx/sites-available/$STAGING_DOMAIN" << EOFNGINX_STAGING
server {
    server_name $STAGING_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Socket.io support
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Increase max upload size for images
    client_max_body_size 10M;

    listen 80;
    listen [::]:80;
}
EOFNGINX_STAGING

ln -sf "/etc/nginx/sites-available/$DOMAIN" /etc/nginx/sites-enabled/
ln -sf "/etc/nginx/sites-available/$STAGING_DOMAIN" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  nginx configured for $DOMAIN + $STAGING_DOMAIN"
echo ""

# -----------------------------------------------
# 6. Certbot (SSL)
# -----------------------------------------------
echo "[6/8] Installing Certbot..."
apt install -y certbot python3-certbot-nginx
echo ""
echo "  Run this AFTER DNS is pointed to this server:"
echo "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -d $STAGING_DOMAIN"
echo ""

# -----------------------------------------------
# 7. Firewall
# -----------------------------------------------
echo "[7/8] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo ""

# -----------------------------------------------
# 8. App directory + .env
# -----------------------------------------------
echo "[8/8] Setting up app directories..."

# Production directory
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/public/uploads"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# Staging directory
mkdir -p "$STAGING_DIR/logs"
mkdir -p "$STAGING_DIR/public/uploads"
chown -R "$APP_USER:$APP_USER" "$STAGING_DIR"

# Generate auth secrets
AUTH_SECRET="$(openssl rand -hex 32)"
AUTH_SECRET_STAGING="$(openssl rand -hex 32)"

# Create production .env
cat > "$APP_DIR/.env" << EOFENV
# ClanTrader Production Environment (Iran VPS)
# Generated on $(date -u +%Y-%m-%dT%H:%M:%SZ)

DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
AUTH_SECRET=$AUTH_SECRET
AUTH_URL=https://$DOMAIN
AUTH_TRUST_HOST=true
REDIS_URL=redis://localhost:6379/0
NEXT_PUBLIC_APP_URL=https://$DOMAIN
NEXT_PUBLIC_APP_NAME=ClanTrader
PORT=3000

NODE_OPTIONS=--max-old-space-size=512
UPLOAD_DIR=public/uploads
MAX_AVATAR_SIZE_MB=2

# Kavenegar SMS (fill in your API key)
KAVENEGAR_API_KEY=
KAVENEGAR_OTP_TEMPLATE=clantrader-otp

# SMTP (optional — leave empty for dev mode)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
EOFENV

chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

# Create staging .env
cat > "$STAGING_DIR/.env" << EOFENV_STAGING
# ClanTrader Staging Environment (Iran VPS)
# Generated on $(date -u +%Y-%m-%dT%H:%M:%SZ)

DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_STAGING
AUTH_SECRET=$AUTH_SECRET_STAGING
AUTH_URL=https://$STAGING_DOMAIN
AUTH_TRUST_HOST=true
REDIS_URL=redis://localhost:6379/1
NEXT_PUBLIC_APP_URL=https://$STAGING_DOMAIN
NEXT_PUBLIC_APP_NAME=ClanTrader (Staging)
PORT=3001

NODE_OPTIONS=--max-old-space-size=512
UPLOAD_DIR=public/uploads
MAX_AVATAR_SIZE_MB=2

# Kavenegar SMS (fill in your API key)
KAVENEGAR_API_KEY=
KAVENEGAR_OTP_TEMPLATE=clantrader-otp

# SMTP (optional — leave empty for dev mode)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
EOFENV_STAGING

chown "$APP_USER:$APP_USER" "$STAGING_DIR/.env"
chmod 600 "$STAGING_DIR/.env"

echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "  Database:"
echo "    Production: $DB_NAME"
echo "    Staging:    $DB_STAGING"
echo "    User:       $DB_USER"
echo "    Pass:       $DB_PASS"
echo ""
echo "  .env files:"
echo "    Production: $APP_DIR/.env"
echo "    Staging:    $STAGING_DIR/.env"
echo "    -> Edit both to add KAVENEGAR_API_KEY"
echo ""
echo "  Ports:"
echo "    Production: 3000 ($DOMAIN)"
echo "    Staging:    3001 ($STAGING_DOMAIN)"
echo ""
echo "  Redis:"
echo "    Production: DB 0 (redis://localhost:6379/0)"
echo "    Staging:    DB 1 (redis://localhost:6379/1)"
echo ""
echo "  Next steps:"
echo "  1. Point DNS: $DOMAIN + $STAGING_DOMAIN -> this server's IP"
echo "  2. Run: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN -d $STAGING_DOMAIN"
echo "  3. Deploy to staging: scripts/deploy-staging.sh ~/deploy.tar.gz"
echo "  4. Test staging, then promote: scripts/promote-to-prod.sh"
echo ""
echo "  SAVE THESE CREDENTIALS — they won't be shown again!"
echo "============================================"
