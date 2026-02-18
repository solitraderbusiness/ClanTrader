#!/bin/bash
# test-iranian-isolation.sh
#
# Tests that the ClanTrader application works with NO outbound international
# internet access. This simulates running on an Iranian server during a blackout.
#
# Usage: sudo bash scripts/test-iranian-isolation.sh
#
# Requirements:
# - The app must be built and ready to start (npm run build completed)
# - PostgreSQL and Redis must be running locally
# - Must run as root (for iptables)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:3000"
PASS=0
FAIL=0

log_pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  PASS=$((PASS + 1))
}

log_fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  FAIL=$((FAIL + 1))
}

log_info() {
  echo -e "${YELLOW}[INFO]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash scripts/test-iranian-isolation.sh"
  exit 1
fi

echo "=========================================="
echo "  ClanTrader Iranian Isolation Test"
echo "=========================================="
echo ""

# Step 1: Save current iptables rules
log_info "Saving current iptables rules..."
iptables-save > /tmp/iptables-backup-clantrader.rules

# Step 2: Block all outbound traffic except localhost
log_info "Blocking all outbound international traffic..."

# Flush OUTPUT chain custom rules (keep system defaults)
iptables -F OUTPUT 2>/dev/null || true

# Allow loopback
iptables -A OUTPUT -o lo -j ACCEPT

# Allow traffic to localhost
iptables -A OUTPUT -d 127.0.0.0/8 -j ACCEPT

# Allow already established connections (for the test itself)
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow DNS to local resolver only
iptables -A OUTPUT -p udp --dport 53 -d 127.0.0.53 -j ACCEPT

# Block everything else outbound
iptables -A OUTPUT -j REJECT

log_info "Outbound traffic blocked. Only localhost is reachable."
echo ""

# Step 3: Start the app in production mode (background)
log_info "Starting ClanTrader in production mode..."
cd /root/projects/clantrader

# Kill any existing instance
pkill -f "next start" 2>/dev/null || true
sleep 1

PORT=3000 npm run start &
APP_PID=$!
sleep 5

# Check if the app started
if ! kill -0 $APP_PID 2>/dev/null; then
  log_fail "App failed to start"
  iptables-restore < /tmp/iptables-backup-clantrader.rules
  exit 1
fi
log_pass "App started (PID: $APP_PID)"
echo ""

# Step 4: Test all critical endpoints
log_info "Testing endpoints..."

# Health check
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$HTTP_CODE" = "200" ]; then
  log_pass "GET /api/health -> $HTTP_CODE"
else
  log_fail "GET /api/health -> $HTTP_CODE (expected 200)"
fi

# Landing page
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/")
if [ "$HTTP_CODE" = "200" ]; then
  log_pass "GET / (landing page) -> $HTTP_CODE"
else
  log_fail "GET / (landing page) -> $HTTP_CODE (expected 200)"
fi

# Login page
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/login")
if [ "$HTTP_CODE" = "200" ]; then
  log_pass "GET /login -> $HTTP_CODE"
else
  log_fail "GET /login -> $HTTP_CODE (expected 200)"
fi

# Signup page
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/signup")
if [ "$HTTP_CODE" = "200" ]; then
  log_pass "GET /signup -> $HTTP_CODE"
else
  log_fail "GET /signup -> $HTTP_CODE (expected 200)"
fi

# Forgot password page
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/forgot-password")
if [ "$HTTP_CODE" = "200" ]; then
  log_pass "GET /forgot-password -> $HTTP_CODE"
else
  log_fail "GET /forgot-password -> $HTTP_CODE (expected 200)"
fi

# Signup API
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test-isolation@test.com","password":"test1234pass","confirmPassword":"test1234pass"}')
if [ "$HTTP_CODE" = "201" ]; then
  log_pass "POST /api/auth/signup -> $HTTP_CODE"
else
  log_fail "POST /api/auth/signup -> $HTTP_CODE (expected 201)"
fi

# Login API (with seeded user)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/api/auth/callback/credentials" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=admin@clantrader.ir&password=password123")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "302" ]; then
  log_pass "POST /api/auth/callback/credentials -> $HTTP_CODE"
else
  log_fail "POST /api/auth/callback/credentials -> $HTTP_CODE (expected 200 or 302)"
fi

# Dashboard (should redirect to login since no session)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE_URL/dashboard")
if [ "$HTTP_CODE" = "200" ]; then
  log_pass "GET /dashboard (redirects to login) -> $HTTP_CODE"
else
  log_fail "GET /dashboard -> $HTTP_CODE (expected 200 after redirect)"
fi

echo ""

# Step 5: Static code scan for external URLs
log_info "Scanning for external URLs in source code..."
EXTERNAL_URLS=$(grep -rn "https\?://" src/ --include="*.ts" --include="*.tsx" \
  | grep -v "localhost" \
  | grep -v "127.0.0.1" \
  | grep -v "clantrader" \
  | grep -v "node_modules" \
  | grep -v "example.com" \
  | grep -v "// " \
  || true)

if [ -z "$EXTERNAL_URLS" ]; then
  log_pass "No hardcoded external URLs found in src/"
else
  log_info "External URLs found (review manually):"
  echo "$EXTERNAL_URLS"
fi

echo ""

# Step 6: Cleanup
log_info "Stopping app..."
kill $APP_PID 2>/dev/null || true
wait $APP_PID 2>/dev/null || true

log_info "Restoring iptables rules..."
iptables-restore < /tmp/iptables-backup-clantrader.rules
rm -f /tmp/iptables-backup-clantrader.rules

# Clean up test user
log_info "Cleaning up test data..."
sudo -u postgres psql -d clantrader_dev -c "DELETE FROM \"User\" WHERE email='test-isolation@test.com';" 2>/dev/null || true

echo ""
echo "=========================================="
echo "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

echo ""
echo -e "${GREEN}All tests passed. ClanTrader works in Iranian isolation mode.${NC}"
