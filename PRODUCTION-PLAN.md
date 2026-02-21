# ClanTrader Production Operating Plan

> **Status:** NOT STARTED — saved for pre-launch implementation
> **Created:** 2026-02-21
> **Priority:** Implement before onboarding real users (after Phase 6 & 7)

## Context
ClanTrader is a competitive social trading platform deployed on a single VPS (31.97.211.86). The codebase is mature (Phase 8 — Polish & Launch) but has zero production infrastructure: no CI/CD, no process manager, no structured logging, no error tracking, no staging environment. This plan establishes an AI-native production operating system to close those gaps.

---

## 1. Executive Summary

### 5 Biggest Risks
1. **No process manager** — app crash = indefinite downtime until manual restart
2. **No CI/CD** — every deploy is manual SSH + git pull + restart, high human-error risk
3. **No structured logging** — `console.log` everywhere makes incident debugging slow
4. **No error tracking** — exceptions silently vanish; users discover bugs before developers
5. **Single point of failure** — one VPS, no health checks, no automated recovery

### 5 Fastest Wins (effort < 1 day each)
1. Add **PM2** with auto-restart + cluster mode (30 min)
2. Add **GitHub Actions CI** — lint, type-check, build on every push (1 hour)
3. Add **Pino structured logging** replacing console.log (2 hours)
4. Add **GlitchTip** (self-hosted Sentry alternative, Iranian-compatible) for error tracking (2 hours)
5. Add **uptime monitor** hitting `/api/health` every 60s with Telegram alerts (30 min)

---

## 2. Current State Audit

### 2.1 Architecture Map

```
                     +--------------------------+
                     |   VPS: 31.97.211.86      |
                     |                          |
  HTTPS:3000 -----> |  server.ts               |
                     |  ├── Next.js 16.1        |
                     |  │   (App Router, SSR)    |
                     |  └── Socket.io 4.8       |
                     |      (path: /api/socketio)|
                     |                          |
                     |  PostgreSQL 16 (Docker)  |
                     |  Redis 7 (Docker)        |
                     +--------------------------+
```

### 2.2 Services & Entrypoints

| Service | Entrypoint | Port | Process Manager |
|---------|-----------|------|-----------------|
| App (Next.js + Socket.io) | `server.ts` | 3000 | None (manual) |
| PostgreSQL 16 | docker-compose.yml | 5432 | Docker |
| Redis 7 | docker-compose.yml | 6379 | Docker |

### 2.3 Key Files

| Purpose | File |
|---------|------|
| Custom server | `server.ts` |
| Socket.io handlers | `src/lib/socket-handlers.ts` |
| Socket.io auth | `src/lib/socket-auth.ts` |
| Socket.io client | `src/lib/socket-client.ts` |
| Auth config | `src/lib/auth.ts` |
| DB client | `src/lib/db.ts` |
| Redis client | `src/lib/redis.ts` |
| Health check | `src/app/api/health/route.ts` |
| Env template | `.env.example` |
| DB schema | `prisma/schema.prisma` (26+ models) |
| Docker services | `docker-compose.yml` |
| Next.js config | `next.config.ts` |
| E2E tests | `e2e/` + `playwright.config.ts` |

### 2.4 Data Storage

| Store | Purpose | Persistence |
|-------|---------|-------------|
| PostgreSQL 16 | Primary data (users, clans, messages, trades) | Docker volume `pgdata` |
| Redis 7 | Caching, Socket.io adapter, rate limiting | Docker volume `redisdata` |
| Local filesystem | User uploads (`UPLOAD_DIR` env var) | Server disk |

### 2.5 External Integrations
- **None at runtime** (Iranian-first constraint)
- SMTP (Nodemailer) for transactional emails — optional, works with local/Iranian SMTP

### 2.6 Observability Gaps

| Area | Current State | Target |
|------|--------------|--------|
| Logging | `console.log` (15+ files) | Pino structured JSON |
| Error tracking | None | GlitchTip (self-hosted Sentry) |
| APM | None | Basic health + uptime monitoring |
| Metrics | None | PM2 metrics + custom `/api/health` |
| Alerting | None | Telegram bot alerts |
| Log aggregation | None | journalctl (systemd) or PM2 logs |

### 2.7 Test Setup

| Type | Tool | Coverage |
|------|------|----------|
| E2E | Playwright | 3 projects (smoke, full, simulator) |
| Unit | None | 0% |
| Integration | None | 0% |
| Type checking | `tsc --noEmit` | Full (strict mode) |
| Linting | ESLint | Full |

### 2.8 Security Basics

| Area | Status |
|------|--------|
| Auth | Auth.js v5, JWT sessions, Credentials provider |
| Input validation | Zod at API boundaries |
| CSRF | Auth.js built-in |
| Rate limiting | Redis-backed per-IP on Socket.io |
| Secrets | `.env` file, not committed |
| HTTPS | Assumed at reverse proxy level |
| SQL injection | Prisma ORM (parameterized) |
| XSS | React auto-escaping + no `dangerouslySetInnerHTML` |

---

## 3. Risk Matrix & Approval Model

### 3.1 Change Categories

| Risk | Examples | Approval |
|------|----------|----------|
| **LOW** | Typo fixes, CSS tweaks, copy changes, new static page | Auto-merge after CI passes |
| **MEDIUM** | New component, new API route, service logic, store changes | AI review + human scan |
| **HIGH** | Schema migration, auth changes, Socket.io protocol changes, service file edits | Human must approve PR |
| **CRITICAL** | `server.ts`, `src/lib/auth.ts`, `src/lib/db.ts`, `prisma/schema.prisma`, `.env`, deploy scripts | Human must approve + test in staging first |

### 3.2 Risk Classification Rules

Files/patterns that trigger **CRITICAL**:
- `server.ts`
- `src/lib/auth.ts`, `src/lib/socket-auth.ts`
- `src/lib/db.ts`, `src/lib/redis.ts`
- `prisma/schema.prisma`, `prisma/migrations/`
- `.env*`, `docker-compose.yml`
- Any deploy/infra scripts

Files/patterns that trigger **HIGH**:
- `src/services/*.service.ts`
- `src/lib/socket-handlers.ts`
- `next.config.ts`
- `package.json` (dependency changes)

Files/patterns that trigger **MEDIUM**:
- `src/app/api/**/*.ts` (API routes)
- `src/stores/*.ts` (Zustand stores)
- `src/components/**/*.tsx` (with business logic)

Everything else: **LOW**

### 3.3 Definition of Done

A change is ready to merge when:
- [ ] `npm run lint` passes with zero errors
- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] No secrets in diff (`grep -r "password\|secret\|key" --include="*.ts"` — false positives reviewed)
- [ ] Prisma schema changes have a migration file
- [ ] New API routes have Zod input validation
- [ ] New components use logical CSS properties (ms/me not ml/mr)
- [ ] HIGH/CRITICAL changes tested in staging
- [ ] PR description includes what changed, why, and how to verify

---

## 4. CI/CD Pipeline

### 4.1 GitHub Actions CI (`.github/workflows/ci.yml`)

```yaml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci

      # Parallel quality checks
      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npm run type-check

      - name: Secret Scan
        run: |
          ! grep -rn "password\s*=" --include="*.ts" --include="*.tsx" \
            --exclude-dir=node_modules --exclude-dir=.next \
            | grep -v "\.env" | grep -v "schema.prisma" | grep -v "test"

      - name: Build
        run: npm run build

  migration-safety:
    runs-on: ubuntu-latest
    if: contains(github.event.pull_request.changed_files, 'prisma/')
    steps:
      - uses: actions/checkout@v4
      - name: Check migration exists for schema changes
        run: |
          if git diff --name-only origin/main | grep -q "schema.prisma"; then
            if ! git diff --name-only origin/main | grep -q "prisma/migrations/"; then
              echo "::error::Schema changed but no migration file found"
              exit 1
            fi
          fi
```

### 4.2 Deploy Script (`scripts/deploy.sh`)

```bash
#!/bin/bash
set -euo pipefail

APP_DIR="/root/projects/clantrader"
BACKUP_DIR="/root/backups"

echo "=== ClanTrader Deploy ==="
date -Iseconds

# 1. Pull latest
cd "$APP_DIR"
git pull origin main

# 2. Install deps
npm ci --production=false

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations
npx prisma migrate deploy

# 5. Build
npm run build

# 6. Restart
pm2 restart clantrader --update-env

echo "=== Deploy complete ==="
pm2 status clantrader
```

---

## 5. Environments & Deployment

### 5.1 Environment Matrix

| Environment | URL | Database | Purpose |
|-------------|-----|----------|---------|
| Local Dev | localhost:3000 | Docker (docker-compose.yml) | Development |
| Staging | VPS:3001 | Separate PostgreSQL DB | Pre-production testing |
| Production | VPS:3000 | Production PostgreSQL DB | Live traffic |

### 5.2 Staging Setup

Create a staging instance on the same VPS using a different port and database:

```bash
# Clone repo to staging directory
git clone /root/projects/clantrader /root/staging/clantrader
cd /root/staging/clantrader

# Create staging .env (different DB, port 3001)
cp .env .env.staging
# Edit: DATABASE_URL -> staging DB, PORT=3001, NEXT_PUBLIC_APP_URL=http://31.97.211.86:3001

# Create staging database
psql -U postgres -c "CREATE DATABASE clantrader_staging;"

# Run with PM2
pm2 start npm --name clantrader-staging -- run start
```

### 5.3 PM2 Configuration (`ecosystem.config.cjs`)

```javascript
module.exports = {
  apps: [{
    name: "clantrader",
    script: "server.ts",
    interpreter: "node_modules/.bin/tsx",
    interpreter_args: "-r tsconfig-paths/register",
    instances: 1,  // Single instance (Socket.io sticky sessions needed for cluster)
    env: {
      NODE_ENV: "production",
      PORT: 3000,
    },
    max_memory_restart: "1G",
    error_file: "/root/logs/clantrader-error.log",
    out_file: "/root/logs/clantrader-out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: "10s",
  }]
};
```

---

## 6. Observability Stack

### 6.1 Structured Logging (Pino)

Replace all `console.log` with Pino structured logger.

**New file: `src/lib/logger.ts`**
```typescript
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});
```

**Files to update** (replace `console.log`/`console.error`):
- `server.ts` — server startup, socket connections
- `src/lib/socket-handlers.ts` — socket events
- `src/lib/email.ts` — email sending
- `src/app/api/*/route.ts` — API error logging

### 6.2 Error Tracking (GlitchTip)

GlitchTip is a self-hosted Sentry-compatible error tracker (works in Iran, no external APIs).

**Setup:**
```bash
# Add to docker-compose.yml
# glitchtip:
#   image: glitchtip/glitchtip
#   ports: ["8000:8000"]
#   environment:
#     DATABASE_URL: postgres://...
#     SECRET_KEY: <random>
```

**Integration: `src/lib/error-tracking.ts`**
```typescript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.GLITCHTIP_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

### 6.3 Uptime Monitoring

Simple cron-based health check with Telegram alerts:

**`scripts/health-check.sh`**
```bash
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/health"
TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID"

response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL")

if [ "$response" != "200" ]; then
  message="ClanTrader DOWN! Health check returned $response at $(date -Iseconds)"
  curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
    -d "chat_id=$TELEGRAM_CHAT_ID&text=$message"
fi
```

**Crontab:**
```
* * * * * /root/scripts/health-check.sh
```

### 6.4 Enhanced Health Check

Extend existing `/api/health` to include:
- PostgreSQL connection pool stats
- Redis ping latency
- Socket.io connected clients count
- Memory usage (`process.memoryUsage()`)
- Uptime (`process.uptime()`)

---

## 7. Runbooks

### 7.1 Site Down (HTTP 5xx or unreachable)

```
1. SSH into VPS: ssh root@31.97.211.86
2. Check PM2 status: pm2 status
3. If stopped/errored: pm2 restart clantrader
4. Check logs: pm2 logs clantrader --lines 100
5. Check disk space: df -h
6. Check memory: free -h
7. Check port: ss -tlnp | grep 3000
8. If port conflict: kill the conflicting process
9. If persistent crash: check error log at /root/logs/clantrader-error.log
10. If OOM: increase max_memory_restart in ecosystem.config.cjs
```

### 7.2 Auth Failures (users can't log in)

```
1. Check health endpoint: curl http://localhost:3000/api/health
2. Check PostgreSQL: docker exec -it clantrader-postgres-1 pg_isready
3. Check AUTH_SECRET env var is set: grep AUTH_SECRET .env
4. Check JWT token format in browser DevTools > Application > Cookies
5. Restart app: pm2 restart clantrader
6. If persistent: check src/lib/auth.ts for recent changes
```

### 7.3 Socket.io Failures (chat not working)

```
1. Test connection: wscat -c ws://localhost:3000/api/socketio
2. Check Redis (Socket.io adapter): docker exec -it clantrader-redis-1 redis-cli ping
3. Check Redis memory: docker exec -it clantrader-redis-1 redis-cli info memory
4. Check connected clients: curl http://localhost:3000/api/health (enhanced)
5. Restart app: pm2 restart clantrader
6. If Redis full: docker exec -it clantrader-redis-1 redis-cli FLUSHDB (CAUTION: clears cache)
```

### 7.4 Database Issues (slow queries, connection errors)

```
1. Check PostgreSQL: docker exec -it clantrader-postgres-1 pg_isready
2. Check connections: docker exec -it clantrader-postgres-1 psql -U clantrader -c "SELECT count(*) FROM pg_stat_activity;"
3. Check slow queries: docker exec -it clantrader-postgres-1 psql -U clantrader -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 5;"
4. Check disk usage: docker exec -it clantrader-postgres-1 psql -U clantrader -c "SELECT pg_size_pretty(pg_database_size('clantrader'));"
5. If connection pool exhausted: restart app (pm2 restart clantrader)
6. Backup: docker exec clantrader-postgres-1 pg_dump -U clantrader clantrader > /root/backups/clantrader-$(date +%Y%m%d).sql
```

### 7.5 Redis Issues

```
1. Check Redis: docker exec -it clantrader-redis-1 redis-cli ping
2. Check memory: docker exec -it clantrader-redis-1 redis-cli info memory
3. Check keys: docker exec -it clantrader-redis-1 redis-cli DBSIZE
4. If unresponsive: docker restart clantrader-redis-1
5. If data corruption: docker exec -it clantrader-redis-1 redis-cli FLUSHALL (CAUTION)
6. App will reconnect automatically (ioredis auto-reconnect)
```

---

## 8. Review Packet Template

For every HIGH/CRITICAL change, create a review packet:

```markdown
## Review Packet: [PR Title]

### Change Summary
- What: [1-2 sentences]
- Why: [motivation/issue link]
- Risk: [LOW/MEDIUM/HIGH/CRITICAL]

### Files Changed
| File | Change Type | Risk |
|------|-------------|------|
| path/to/file.ts | Modified | HIGH |

### Database Impact
- [ ] Schema migration required? If yes, is it reversible?
- [ ] Data migration needed?
- [ ] Index changes?

### Security Checklist
- [ ] No secrets in code
- [ ] Input validated with Zod
- [ ] Auth checks on new endpoints
- [ ] No SQL injection vectors
- [ ] No XSS vectors

### Testing
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run build` succeeds
- [ ] Manual testing steps documented
- [ ] Tested in staging (for HIGH/CRITICAL)

### Rollback Plan
[How to revert if something goes wrong]

### Deploy Notes
[Any special steps needed during deployment]
```

---

## 9. Implementation Roadmap

### Phase 1: Process Management (Day 1, ~2 hours)

| Step | Action | Files |
|------|--------|-------|
| 1 | Install PM2 globally | `npm i -g pm2` |
| 2 | Create ecosystem config | `ecosystem.config.cjs` (new) |
| 3 | Create log directory | `mkdir -p /root/logs` |
| 4 | Start app with PM2 | `pm2 start ecosystem.config.cjs` |
| 5 | Enable startup on boot | `pm2 startup && pm2 save` |
| 6 | Verify auto-restart | `pm2 restart clantrader && pm2 status` |

### Phase 2: CI Pipeline (Day 1, ~2 hours)

| Step | Action | Files |
|------|--------|-------|
| 1 | Create GitHub Actions workflow | `.github/workflows/ci.yml` (new) |
| 2 | Add type-check script if missing | `package.json` |
| 3 | Push and verify CI runs | GitHub Actions tab |

### Phase 3: Structured Logging (Day 2, ~3 hours)

| Step | Action | Files |
|------|--------|-------|
| 1 | Install pino + pino-pretty | `npm i pino pino-pretty` |
| 2 | Create logger module | `src/lib/logger.ts` (new) |
| 3 | Replace console.log in server.ts | `server.ts` |
| 4 | Replace console.log in socket handlers | `src/lib/socket-handlers.ts` |
| 5 | Replace console.log in email service | `src/lib/email.ts` |
| 6 | Replace console.log in API routes | `src/app/api/*/route.ts` (various) |

### Phase 4: Monitoring & Alerting (Day 2, ~2 hours)

| Step | Action | Files |
|------|--------|-------|
| 1 | Enhance health check endpoint | `src/app/api/health/route.ts` |
| 2 | Create health check script | `scripts/health-check.sh` (new) |
| 3 | Set up Telegram bot for alerts | Telegram BotFather |
| 4 | Add crontab entry | `crontab -e` |
| 5 | Create deploy script | `scripts/deploy.sh` (new) |

### Phase 5: Error Tracking (Day 3, ~3 hours)

| Step | Action | Files |
|------|--------|-------|
| 1 | Add GlitchTip to docker-compose | `docker-compose.yml` |
| 2 | Install Sentry SDK | `npm i @sentry/nextjs` |
| 3 | Create error tracking module | `src/lib/error-tracking.ts` (new) |
| 4 | Add to server.ts and API error handlers | `server.ts`, API routes |
| 5 | Verify errors appear in GlitchTip dashboard | Browser test |

### Phase 6: Staging Environment (Day 3, ~2 hours)

| Step | Action | Files |
|------|--------|-------|
| 1 | Create staging database | `psql` command |
| 2 | Clone to staging directory | `/root/staging/clantrader` |
| 3 | Create staging .env | `.env.staging` |
| 4 | Add staging to PM2 | `ecosystem.config.cjs` update |
| 5 | Verify staging runs on port 3001 | `curl http://localhost:3001/api/health` |

---

## 10. Reusable AI Agent Prompts

### 10.1 Builder Agent

```
You are a ClanTrader Builder Agent. You implement features and fixes.

Tech stack: Next.js 16.1 (App Router), React 19, TypeScript (strict), Tailwind CSS 4,
shadcn/ui, Prisma 7 + PostgreSQL 16, Auth.js v5 (JWT), Redis (ioredis),
Socket.io 4.8, Zod 4, Zustand, Pino for logging.

Rules:
- Server Components by default, Client Components only for interactivity
- Validate all API inputs with Zod
- Use logical CSS properties (ms/me/ps/pe not ml/mr/pl/pr)
- Use Prisma ORM, never raw SQL unless required for performance
- Self-hosted fonts only (src/fonts/)
- RTL support (Persian, English, Arabic)
- Iranian-first: no international APIs at runtime
- Import logger from src/lib/logger.ts, never use console.log
- Run `npm run lint && npm run build` before marking complete

File conventions:
- API routes: src/app/api/[resource]/route.ts
- Pages: src/app/(main)/[page]/page.tsx
- Components: src/components/[feature]/ComponentName.tsx
- Services: src/services/name.service.ts
- Stores: src/stores/name-store.ts
```

### 10.2 Reviewer Agent

```
You are a ClanTrader Code Reviewer. Review PRs for correctness, security, and style.

Check for:
1. SECURITY: No secrets in code, Zod validation on all API inputs, auth checks on endpoints,
   no raw SQL injection vectors, no XSS (dangerouslySetInnerHTML)
2. CORRECTNESS: Prisma types match schema, Socket.io events match constants in chat-constants.ts,
   error handling present, edge cases covered
3. STYLE: Logical CSS properties (ms/me not ml/mr), Server Components default,
   no unnecessary Client Components, consistent naming
4. RISK: Classify as LOW/MEDIUM/HIGH/CRITICAL per risk matrix
5. MIGRATION: If schema.prisma changed, verify migration file exists

Output format:
- Risk level: [LOW/MEDIUM/HIGH/CRITICAL]
- Issues found: [list with file:line references]
- Suggestions: [optional improvements]
- Verdict: [APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION]
```

### 10.3 Test Agent

```
You are a ClanTrader Test Agent. Write and run tests.

Testing infrastructure:
- E2E: Playwright (playwright.config.ts) — 3 projects: smoke, full-e2e, simulator
- Run E2E: npm run test:e2e or npm run test:e2e:smoke
- No unit test framework currently configured

When writing E2E tests:
- Place in e2e/ directory
- Use Desktop Chrome device config
- Test against http://localhost:3000
- Screenshots on failure (automatic)
- Use data-testid attributes for selectors

When verifying changes:
1. npm run lint (must pass with 0 errors)
2. npm run type-check (must pass)
3. npm run build (must succeed)
4. npm run test:e2e:smoke (if E2E tests exist for the changed area)
```

### 10.4 Security & Infra Agent

```
You are a ClanTrader Security & Infrastructure Agent.

Current infrastructure:
- Single VPS: 31.97.211.86 (Ubuntu/Linux)
- App: server.ts (Node.js + Next.js + Socket.io) on port 3000
- DB: PostgreSQL 16 (Docker) on port 5432
- Cache: Redis 7 (Docker) on port 6379
- Process manager: PM2
- No reverse proxy (direct access to port 3000)

Security checklist:
- Auth: Auth.js v5 with JWT sessions, Credentials provider
- Passwords: bcrypt hashing in src/lib/auth.ts
- Rate limiting: Redis-backed on Socket.io connections
- Input validation: Zod at API boundaries
- CSRF: Auth.js built-in protection
- File uploads: sharp for image processing, size limits configured

When auditing:
1. Check for hardcoded secrets (grep for password, secret, key, token)
2. Check API routes for missing auth (getServerSession checks)
3. Check for missing Zod validation on POST/PATCH/DELETE handlers
4. Check Socket.io handlers for auth bypass
5. Check Prisma queries for user-scoping (prevent IDOR)
6. Check file upload handlers for path traversal
```

---

## Verification

After implementing this plan:

1. **PM2**: `pm2 status` shows clantrader running, `pm2 restart clantrader` recovers in <5s
2. **CI**: Push a commit, verify GitHub Actions runs lint + type-check + build
3. **Logging**: `pm2 logs clantrader --lines 10` shows JSON-formatted Pino output
4. **Health check**: `curl http://localhost:3000/api/health` returns DB, Redis, memory stats
5. **Uptime monitor**: Stop the app, verify Telegram alert fires within 60s
6. **Error tracking**: Trigger a test error, verify it appears in GlitchTip
7. **Staging**: `curl http://localhost:3001/api/health` returns OK
8. **Deploy**: Run `scripts/deploy.sh`, verify zero-downtime restart
