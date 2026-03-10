# ClanTrader — Source of Truth

## 0. Document Contract

- **This file is the authoritative operational truth for ClanTrader.**
- If any other `.md` file conflicts with this one, **this one wins** unless explicitly superseded by a dated entry in the Change Log below.
- Every material product, infrastructure, rule, or scope change **must update this file in the same work session**.
- Historical docs are references, not authority, unless explicitly marked ACTIVE in the Document Registry.
- Sections use these status labels:
  - `LIVE` — implemented, verified in code, deployed to dev
  - `PARTIAL` — some code exists but incomplete or not fully wired
  - `STUB` — route/folder exists but empty or non-functional
  - `PLANNED` — decided, not yet started
  - `DEFERRED` — explicitly pushed to post-MVP or later
  - `NEEDS VERIFICATION` — claim exists but not confirmed against code

---

## 1. Executive Snapshot

| Field | Value |
|-------|-------|
| **Phase** | MVP QA (Phase A: Mar 9–13, 2026) |
| **MVP timeline** | Mar 9 – Apr 8, 2026 (5 phases: QA → Harden → Infra → Beta → Launch) |
| **Target users** | Iranian forex/gold traders in competitive clans |
| **Stack** | Next.js 16.1, React 19, Prisma 7, PostgreSQL 16, Socket.io 4.8, Redis 7, TypeScript strict |
| **Dev server** | 31.97.211.86 (clantrader.com), root user |
| **Prod/Stage** | Germany VPS — TBD, staging port 3001, prod port 3000 |
| **Board status** | ~88 DONE, ~61 TODO, ~11 BACKLOG (as of 2026-03-10) |

### What Is Shipped (verified in code)

- Auth (credentials + phone OTP + EA token)
- Clans (create, join, leave, switch, delete, roles, tiers)
- Real-time chat (Socket.io, topics, images, reactions, presence)
- DMs
- Trade cards (signal + analysis, MT-linked actions, version history)
- EA bridge (full lifecycle: register, login, heartbeat, trade sync, pending actions)
- Signal qualification (20s window, frozen snapshots)
- 7-condition integrity contract (deny-by-default)
- Auto-generated statements from MT data
- Live open risk overlay (floating PnL, drawdown, stale warning)
- Effective rank with open-loss penalty
- Leaderboards (6 lenses + composite)
- Badges (rank/performance/trophy)
- Admin panel (9 routes: flags, paywall rules, plans, impersonate, badges, referrals, statements, testing, dashboard)
- i18n (English + Persian, 1200+ keys, RTL support)
- Mobile responsive (Tailwind breakpoints + logical CSS)
- Rate limiting (6 tiers, Redis-backed)
- Error tracking (Sentry + Telegram notifications)
- PM2 process management
- Deploy scripts (pack, staging, promote-to-prod)
- Price pool (5-layer Redis cache, source-aware, verification-grade)
- Channel posts (backend API — no UI yet)
- Onboarding (minimal modal)

### What Is Blocking Launch

See Section 5.

### What Is Intentionally Deferred

- Broker history import
- Manual statement file upload
- AI features (folder exists, empty)
- Payment processing / ZarinPal (DB models exist, no processor)
- Public channel post UI
- Multi-step onboarding flow
- Prometheus / APM monitoring
- CI/CD pipeline
- Dedicated `/api/health` endpoint
- Database backup automation

---

## 2. Active Product Truth

### Auth
**Status: LIVE**
- NextAuth v5 (JWT strategy)
- Providers: credentials (email/username + password), EA token (Redis one-time use)
- Email verification required for email login
- Phone OTP: routes exist (`send-otp`, `verify-otp`, `phone-signup`), Kavenegar SDK integrated, falls back to console.log in dev when API key missing
- Phone OTP is **not required for MVP launch** — it works but is an optional auth path
- Password hashing: bcryptjs

### Onboarding
**Status: PARTIAL**
- Single welcome modal on first login (`OnboardingIntentModal.tsx`)
- No multi-step setup, clan selection, or EA configuration flow
- Marks `onboardingComplete = true` immediately

### Clans
**Status: LIVE**
- Create, join (direct + join requests with approval), leave, switch, delete
- Roles: LEADER, CO_LEADER, MEMBER
- One clan per user (enforced by DB unique index)
- Leader cannot leave without transferring leadership if members exist
- Clan settings: name, description, trading focus, public/private, avatar
- Tier-based member limits

### Clan Membership Model
**Status: LIVE**
- **Switch flow**: Leave current → join target (transactional)
- Public clans: automatic join on switch
- Private clans: user submits join request, stays in current clan until approved
- Leader restrictions: must transfer leadership before leaving if clan has other members
- No "leave before join" — it's a single transactional operation

### Chat
**Status: LIVE**
- Socket.io 4.8 with real-time messaging
- Topics per clan (default topic auto-created)
- Features: send/receive/edit/delete, pinning, emoji reactions, presence tracking, image upload (JPEG/PNG/WebP, 5MB limit, 10 images max)
- Rate limiting: 5 messages per 10 seconds per user
- Message types: TEXT, TRADE_CARD, IMAGE

### DMs
**Status: LIVE**
- Direct messaging with conversation model
- Read status tracking
- Full CRUD API

### Trade Cards
**Status: LIVE**
- Two types: SIGNAL (SL+TP required, leader/co-leader only) and ANALYSIS (optional SL/TP, any member)
- Fields: instrument, direction, entry, stopLoss, targets[], timeframe, riskPct, note, tags
- Version history tracking (TradeCardVersion)
- In-message embedding in chat
- MT-linked actions route through EA pending action system
- Auto-tagging: signal cards get "signal" tag, analysis get "analysis" tag

### EA Bridge
**Status: LIVE**
- 12 API endpoints (register, login, heartbeat, trade-event, trades/sync, poll-actions, action result, accounts CRUD, calendar-events, mt-status)
- MQL4 + MQL5 EA source files in `ea/` directory
- Heartbeat: every 30s with full open-trade snapshot
- Trade events: immediate on open/close/modify (MT5 via OnTradeTransaction, MT4 via OnTick detection)
- Pending actions: 5-min expiry, piggybacked on heartbeat response
- Bearer token auth (32-byte hex API key per account)
- Multiple MT accounts per user supported
- Rate limit: 1 heartbeat per 10s per account
- Trade sync: up to 5000 closed trades per batch (every 5 min)

### Signal Qualification
**Status: LIVE**
- 20-second window from MT open time
- Origin types: `AT_OPEN` (SL+TP at open) or `WITHIN_WINDOW` (added within 20s)
- Missed window → permanent analysis-origin (never statements/leaderboard)
- Frozen official risk snapshot: immutable entry, SL, TP, riskAbs, riskMoney
- Risk money backfill: computed from floating P&L when price moves enough

### Integrity Contract
**Status: LIVE**
- 7 conditions, ALL must pass for `statementEligible = true`:
  1. MT-linked
  2. Not manually unverified
  3. Trusted resolution source (EA_VERIFIED or EVALUATOR)
  4. Signal card pre-existed MT trade open
  5. Initial risk snapshot captured
  6. No duplicate MT ticket
  7. Official signal qualified (20s window)
- 12 known loopholes identified and fixed (see `docs/INTEGRITY-CONTRACT-CHECKLIST.md`)
- Deny-by-default: trades start ineligible and must earn eligibility

### Statements
**Status: LIVE**
- Auto-generated from MT data (no manual upload)
- Metrics: win rate, avg R, total R, profit factor, best/worst R, instrument/direction distribution
- Only counts closed, verified, signal-qualified, statement-eligible trades with cardType=SIGNAL
- Per-season aggregation for leaderboards
- Multi-account: all eligible trades from all MT accounts feed ONE statement per trader per clan

### Leaderboards / Rankings
**Status: LIVE**
- 6 lenses: profit, low_risk, consistency, risk_adjusted, activity, composite
- Effective rank: `closedOfficialR + openLossPenaltyR` (open losses penalize, open profits ignored)
- Ranking status: RANKED (all accounts active), PROVISIONAL (stale heartbeat), UNRANKED (lost tracking)
- Min-max normalization, configurable minimum trade count

### Live Open Risk
**Status: LIVE**
- Overlay on statement page showing floating PnL, floating R, equity drawdown, biggest open loser, unprotected count
- 15-second Redis cache
- `staleWarning` flag when any MT account is STALE or TRACKING_LOST
- UI shows yellow triangle + warning banner when stale

### Badges
**Status: LIVE**
- 3 categories: rank (trade count ladder), performance (metrics-based), trophy (season leaderboard placement)
- Signal validity rules: resolved trades with unedited entry/SL count (SET_BE and MOVE_SL don't invalidate)
- Admin recompute with dry-run and audit trail

### Admin Panel
**Status: LIVE**
- Routes: dashboard, feature-flags, paywall-rules, plans, impersonate, badges, referrals, statements, testing
- Session-based auth, admin role required
- Kanban board at `/admin/kanban`

### Mobile Responsiveness
**Status: LIVE**
- Tailwind responsive breakpoints throughout (sm/md/lg/xl/2xl)
- Logical CSS properties only (ms/me/ps/pe) for RTL support
- Self-hosted fonts

### News / Geopolitics
**Status: STUB**
- Page at `/geo-news` with static curated external links (LiveUAMap)
- No feeds, calendar integration, or news ingestion
- Economic calendar events sync from MT5 EA (backend only)

### AI Features
**Status: STUB**
- `/api/ai/` directory exists but is empty
- No LLM integration

### Monetization
**Status: PARTIAL**
- DB models: SubscriptionPlan, PaywallRule, User.isPro
- Admin UI: plans + paywall rules CRUD
- Feature flag gating
- Referral tracking (signup events)
- **No payment processor integration** (ZarinPal folder empty, no Stripe)

### Channel Posts
**Status: PARTIAL**
- DB model: ChannelPost
- API routes: `/api/me/channels`, `/api/me/feed`
- No UI components yet

---

## 3. Active Operational Truth

### Environments

| Env | Host | Port | Status |
|-----|------|------|--------|
| Dev | 31.97.211.86 (clantrader.com) | 3000 | LIVE |
| Staging | Germany VPS (TBD) | 3001 | PLANNED |
| Production | Germany VPS (TBD) | 3000 | PLANNED |

### Process Management
**Status: LIVE**
- PM2 with `ecosystem.config.cjs`
- Single fork instance, 1GB memory limit, auto-restart (10 max, 5s delay)
- Logs: `/root/projects/clantrader/logs/pm2-{error,out}.log`

### Deployment
**Status: PARTIAL**
- Scripts exist: `deploy-pack.sh`, `deploy-staging.sh`, `deploy-unpack.sh`, `promote-to-prod.sh`
- **Known issue**: deploy scripts reference `/home/ubuntu/` paths (old Iran VPS). Must be updated for Germany VPS before staging/prod deployment.
- Dev deployment: manual build + PM2 restart on 31.97.211.86

### Error Tracking
**Status: LIVE**
- **Sentry** (`@sentry/nextjs@^10.42.0`) — NOT GlitchTip as CLAUDE.md previously stated
- Config: `sentry.server.config.ts`, `sentry.client.config.ts`, `src/instrumentation.ts`
- Telegram error notifications via Sentry `beforeSend` hook (`src/lib/telegram.ts`)
- Conditional on `NEXT_PUBLIC_SENTRY_DSN` env var

### Rate Limiting
**Status: LIVE**
- Redis-backed sliding window (`src/lib/rate-limit.ts`)
- 6 tiers: AUTH_STRICT (5/60s), AUTH_OTP (3/300s), EA (60/60s), PUBLIC_READ (60/60s), AUTHENTICATED (120/60s), UPLOAD (10/60s)
- Fail-open if Redis down
- Returns 429 with Retry-After header

### Health Endpoint
**Status: MISSING**
- No dedicated `/api/health` route
- Deploy scripts do inline HTTP checks (curl to port, check 200/302)

### Backups
**Status: PARTIAL**
- `promote-to-prod.sh` creates file-level backup before deployment
- No automated database backup scripts
- `pg-backup.log` exists (suggests manual/external backup runs)

### Monitoring
**Status: BASIC**
- Sentry for errors + Telegram notifications
- PM2 auto-restart + memory limits
- No Prometheus, DataDog, or APM
- No dedicated health endpoint

### Redis
**Status: LIVE**
- ioredis client, lazy connect, single database (default DB 0)
- Usage: rate limits, EA login tokens, price cache (5 layers), live-risk cache, signal dedup locks, heartbeat rate limits, event reminder dedup

### Background Workers
**Status: PARTIAL**
- In-process intervals in `server.ts`:
  - Trade evaluator: 60s (feature-flagged)
  - Event reminder: 30s
- Cron-intended endpoint: `/api/admin/stale-check` (every 60s) — **must be configured externally**
- Manual scripts with cron suggestions: `scripts/daily-digest.ts` (8 AM Iran), `scripts/evening-digest.ts` (10 PM Iran) — **not auto-scheduled in repo**

### Testing
**Status: LIVE**
- Unit tests: Vitest (`npm run test:unit`)
- E2E tests: Playwright (`npm run test:e2e`, `npm run test:e2e:smoke`)
- Pre-commit: ESLint via lint-staged
- CI/CD: not configured

### Security
- Auth: session-based (web) + Bearer token (EA)
- Rate limiting on all public endpoints
- Zod validation on all request bodies
- No external CDN/font dependencies (self-hosted)
- Password hashing: bcryptjs
- CORS: scoped to app URL
- Socket.io: JWT auth via cookie

### Known Ops Gaps
1. No `/api/health` endpoint
2. No automated database backups
3. No CI/CD pipeline
4. Deploy scripts need path updates for Germany VPS
5. Stale-check cron must be configured externally (or moved to in-process interval)
6. Digest scripts not auto-scheduled
7. No APM/metrics collection

---

## 4. Active Business / Scope Decisions

### Launch Market
- **Primary audience**: Iranian forex/gold traders
- **Iran-first** applies to: no external CDN dependencies, self-hosted fonts, Farsi translations, RTL support
- **Iran-first does NOT mean**: hosted in Iran. Dev server is in Iran, but prod/staging will be Germany VPS
- Kavenegar (SMS) and ZarinPal (payments) are API-based services that work from any server

### Phone OTP / Kavenegar
- **Status: IMPLEMENTED but NOT required for MVP launch**
- Routes exist: `send-otp`, `verify-otp`, `phone-signup`
- Kavenegar SDK integrated with fallback to console.log when API key missing
- This is an optional auth path, not a blocker
- Can be enabled by setting `KAVENEGAR_API_KEY` env var

### MVP Boundary
**In MVP**: Auth, clans, chat, DMs, trade cards, EA bridge, integrity, statements, leaderboards, badges, admin panel, i18n, responsive design, error tracking, PM2

**NOT in MVP**: AI features, payment processing, channel post UI, broker history import, manual statement upload, CI/CD, APM monitoring, multi-step onboarding

### Priority Lens
The product prioritizes:
1. **Risk reduction**: Integrity contract prevents fake/manipulated trading records
2. **Time saving**: Auto-generated statements, auto-created signals from EA, real-time data
3. **Trust**: Deny-by-default eligibility, frozen snapshots, source-aware pricing
4. **Competition**: Clan-based leaderboards, effective rank that penalizes hiding losses

### Product Philosophy
- **Deny-by-default**: Trades must earn eligibility through 7 verified conditions
- **No trust without verification**: EA bridge provides real-time verification, not self-reported stats
- **Conservative ranking**: Open losses penalize rank, open profits do not help
- **Transparency**: Stale data is flagged, not hidden. Tracking status is public.
- **One statement per trader per clan**: All MT accounts feed one public record

---

## 5. Launch Blockers

### Hard Launch Blockers
1. **Germany VPS provisioning** — staging + prod environments not yet set up
2. **Deploy script path updates** — scripts reference `/home/ubuntu/` (Iran VPS), need Germany paths
3. **Stale-check cron configuration** — must be running every 60s in production or converted to in-process interval
4. **QA pass on EA auth flow** — currently in testing (user verification pending)

### Important But Not Blocking
1. **`/api/health` endpoint** — should exist for production monitoring, but deploy scripts have inline checks
2. **Automated database backups** — critical for production but can be set up during infra phase (Mar 17-21)
3. **Digest script scheduling** — cron needs to be configured for daily/evening digests
4. **Trade card staleness indicator in chat** — cards don't show stale warning, only statement page does

### Deferred by Decision
1. AI features — post-MVP
2. Payment processing (ZarinPal) — post-MVP
3. Channel post UI — post-MVP
4. Broker history import — not planned
5. Manual statement upload — not planned
6. CI/CD pipeline — post-MVP (manual deploy acceptable for beta)
7. Multi-step onboarding — post-MVP
8. Pending order tracking — not planned for MVP

---

## 6. Known Contradictions Resolved

| Old Statement | New Truth | Reason |
|---------------|-----------|--------|
| CLAUDE.md: error tracking is "GlitchTip" | Error tracking is **Sentry** (`@sentry/nextjs`) + Telegram notifications | Code inspection: `sentry.server.config.ts`, `sentry.client.config.ts`, `@sentry/nextjs` in package.json. No GlitchTip dependency exists. |
| PRODUCTION-PLAN.md: ops are "NOT STARTED" | PM2, Sentry, deploy scripts, and rate limiting **all exist** | `ecosystem.config.cjs`, `src/lib/rate-limit.ts`, `sentry.*.config.ts` all present and functional. Doc was written 2026-02-21 before these were implemented. |
| PM-ROADMAP.md: Phone OTP is MVP blocker | Phone OTP is **implemented but optional** — not a launch blocker | Routes exist (`send-otp`, `verify-otp`, `phone-signup`), Kavenegar SDK integrated. Falls back to console.log without API key. Users can sign up via email/password. |
| PLATFORM_REPORT.md: "leave before join" clan model | Clan switch is a **single transactional operation** (leave + join atomically) | `clan.service.ts` `switchClan()` performs both in a transaction. No intermediate "unclanned" state. |
| Deploy scripts reference Iran VPS paths | Dev is on Iranian VPS, but **prod/staging will be Germany VPS** | Decision made post-Feb 2026. Deploy scripts need path updates before Germany deployment. |
| CLAUDE.md: `clan-digest.service.ts` listed as service file | Digest runs from **manual scripts** (`scripts/daily-digest.ts`, `scripts/evening-digest.ts`), not an auto-running service | Scripts exist with suggested cron schedules but are not auto-scheduled. |
| price-system-report.md: single Redis key per symbol | Price pool now uses **5-layer source-aware Redis cache** | `price-pool.service.ts` implements trade, account, group, display, and active-groups layers with source-group isolation. |
| PRODUCTION-PLAN.md: single VPS, no staging | **Staging planned on Germany VPS** port 3001, prod port 3000 | MVP.md (Mar 8) reflects current plan. PRODUCTION-PLAN.md (Feb 21) is outdated. |

---

## 7. Document Registry

| File | Status | Purpose | Trust Level | Notes |
|------|--------|---------|-------------|-------|
| `SOURCE_OF_TRUTH.md` | **ACTIVE** | Authoritative project truth | Highest | This file. Wins all conflicts. |
| `CLAUDE.md` | **ACTIVE** | Dev workflow rules, architecture quick-ref | High | Must stay aligned with SOURCE_OF_TRUTH.md |
| `docs/MVP.md` | **ACTIVE** | Launch scope, timeline, feature status | High | Closest to current reality among old docs |
| `docs/FEATURES.md` | **ACTIVE** | QA feature test checklist | High | Testing reference, not product truth |
| `docs/TESTING-CHECKLIST.md` | **ACTIVE** | Full QA test matrix | High | Testing reference, not product truth |
| `docs/E2E-INTEGRITY-TEST.md` | **ACTIVE** | 41 E2E test scenarios | High | Technical test spec |
| `docs/INTEGRITY-CONTRACT-CHECKLIST.md` | **ACTIVE** | 12 integrity loopholes + fixes | High | Needs update: missing 20s qualification window detail |
| `docs/BADGES.md` | **ACTIVE** | Badge system spec | Medium | Missing effective rank context |
| `docs/ANALYSIS-CARD-REPORT.md` | **ACTIVE** | Analysis vs signal card system | High | Accurate technical reference |
| `docs/MT_LINKED_SIGNAL_ACTIONS_NOTES.md` | **ACTIVE** | MT-linked trade action routing | High | Accurate technical reference |
| `docs/PRODUCTION-PLAN.md` | **HISTORICAL** | Original ops planning doc | Low | Many claims outdated (see Contradictions). Useful for future ops checklist items only. |
| `docs/price-system-report.md` | **HISTORICAL** | Original price data flow | Low | Superseded by implemented 5-layer system |
| `docs/price-system-review-response.md` | **HISTORICAL** | Price system improvements proposal | Low | Proposals are now implemented in code |
| `docs/README.md` | **ACTIVE** | Docs index and navigation | Medium | Accurate index |
| `docs/archive/*` | **ARCHIVED** | 12 archived docs with deprecation banners | None | Historical reference only |

---

## 8. Maintenance Policy

### Update Triggers

Update this file whenever any of the following changes:

- Product scope or feature status
- Launch scope or timeline
- Auth requirements or providers
- Clan membership rules
- Trade integrity rules or conditions
- EA bridge behavior or endpoints
- Infrastructure or deployment setup
- Blocker status (added, removed, resolved)
- Feature shipped or deferred
- Major UX behavior change
- Environment or server changes
- Document authority rules

### Update Workflow

For each material change:
1. Update code / config / behavior
2. Update `SOURCE_OF_TRUTH.md` (relevant section + change log entry)
3. If an older doc became misleading, update its status banner
4. Task completion is not done until this file is current

---

## 9. Change Log

Newest first. Append-only.

| Date | Change | Reason | Affected Files |
|------|--------|--------|----------------|
| 2026-03-10 | Added `/project-update` skill for doc maintenance | Durable mechanism to keep SOURCE_OF_TRUTH.md current after every material task | .claude/skills/project-update/SKILL.md, CLAUDE.md |
| 2026-03-10 | Created SOURCE_OF_TRUTH.md | Reconcile all docs into single authority after audit found 8+ contradictions across CLAUDE.md, PRODUCTION-PLAN.md, PM-ROADMAP.md, PLATFORM_REPORT.md, and MVP.md | SOURCE_OF_TRUTH.md, CLAUDE.md, all docs/ files |
| 2026-03-10 | Corrected error tracking: GlitchTip → Sentry | Code inspection found @sentry/nextjs, no GlitchTip dependency | CLAUDE.md, SOURCE_OF_TRUTH.md |
| 2026-03-10 | Marked PRODUCTION-PLAN.md as HISTORICAL | Most claims outdated (ops infra partially exists now) | docs/PRODUCTION-PLAN.md |
| 2026-03-10 | Marked price system docs as HISTORICAL | 5-layer source-aware price pool is implemented, superseding both original report and review response | docs/price-system-report.md, docs/price-system-review-response.md |
| 2026-03-10 | Added doc status banners to all major docs | Establish clear authority hierarchy | All docs/ files |
