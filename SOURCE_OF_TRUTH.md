# ClanTrader — Source of Truth

## 0. Document Contract

- **This file is the authoritative operational truth for ClanTrader.**
- If any other `.md` file conflicts with this one, **this one wins** unless explicitly superseded by a dated entry in the Change Log below.
- Every material product, infrastructure, rule, or scope change **must update this file in the same work session**.
- Historical docs are references, not authority, unless explicitly marked ACTIVE in the Document Registry.
- Sections use these status labels (no others allowed):
  - `LIVE` — implemented, verified in code, running on dev server (not yet in production unless stated)
  - `PARTIAL` — some code exists but incomplete or not fully wired
  - `STUB` — route/folder exists but empty or non-functional
  - `NOT IMPLEMENTED` — no code, no stub, no route exists
  - `PLANNED` — decided, not yet started
  - `DEFERRED` — explicitly pushed to post-MVP or later
  - `NEEDS VERIFICATION` — claim exists but not confirmed against code

---

## 1. Executive Snapshot

| Field | Value |
|-------|-------|
| **Phase** | MVP QA (Phase A: Mar 9–13, 2026) |
| **MVP timeline** | Mar 9 – Apr 8, 2026 (5 phases: QA → Harden → Infra → Beta → Launch) |
| **Target users** | Farsi-speaking forex/gold traders (Iran-first), competing in clans |
| **Stack** | Next.js 16.1, React 19, Prisma 7, PostgreSQL 16, Socket.io 4.8, Redis 7, TypeScript strict |
| **Dev server** | 31.97.211.86 (clantrader.com), root user |
| **Prod/Stage** | Germany VPS — TBD, staging port 3001, prod port 3000 |
| **Board status** | Approximate PM-board snapshot (2026-03-10): ~88 DONE, ~61 TODO, ~11 BACKLOG |

### What Is Built (verified in code, running on dev)

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
- Activity Digest v2 (trading cockpit: floating P/L, R, risk-to-SL, actions needed, attention queue — feature-flagged behind `digest_v2`)
- Channel posts (backend API — no UI yet)
- Onboarding (minimal modal)

### What Is Blocking Launch

See Section 6.

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
- **Switch flow**: single `$transaction` in all cases
  - Public target: leave + join atomically (user never clanless)
  - Private target: leave + create pending join request (user is **clanless** until approved)
- Leader with members: must transfer leadership before leaving/switching
- Solo leader switching: current clan auto-dissolved (hard delete), then join or pending request

### Chat
**Status: LIVE**
- Socket.io 4.8 with real-time messaging
- Topics per clan (default topic auto-created)
- Features: send/receive/edit/delete, pinning, emoji reactions, presence tracking, image upload (JPEG/PNG/WebP, 5MB limit, 4 images max per message)
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
- Heartbeat: every 30s with full open-trade snapshot + floatingProfit, tradeAllowed
- Login sends extended data: accountName, currency, leverage, stopoutLevel, stopoutMode, isDemo
- Trade events: immediate on open/close/modify (MT5 via OnTradeTransaction, MT4 via OnTick detection)
- Pending actions: 5-min expiry, piggybacked on heartbeat response
- Bearer token auth (64-char hex API key per account)
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
- 4 categories: rank (trade count ladder), performance (metrics-based), trophy (season leaderboard placement), other
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
**Status: LIVE** (last verified: 2026-03-10 — `ecosystem.config.cjs` inspected)
- PM2 with `ecosystem.config.cjs`
- Single fork instance, 1GB memory limit, auto-restart (10 max, 5s delay)
- Logs: `/root/projects/clantrader/logs/pm2-{error,out}.log`

### Deployment
**Status: PARTIAL** (last verified: 2026-03-10 — scripts inspected, paths outdated)
- Scripts exist: `deploy-pack.sh`, `deploy-staging.sh`, `deploy-unpack.sh`, `promote-to-prod.sh`
- **Known issue**: deploy scripts reference `/home/ubuntu/` paths (old Iran VPS). Must be updated for Germany VPS before staging/prod deployment.
- Dev deployment: manual build + PM2 restart on 31.97.211.86

### Error Tracking
**Status: LIVE** (last verified: 2026-03-10 — `@sentry/nextjs` in `package.json`, configs inspected)
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
**Status: NOT IMPLEMENTED**
- No dedicated `/api/health` route
- Deploy scripts do inline HTTP checks (curl to port, check 200/302)

### Backups
**Status: PARTIAL** (last verified: 2026-03-10 — no backup scripts in repo)
- `promote-to-prod.sh` creates file-level backup before deployment
- No automated database backup scripts
- `pg-backup.log` exists (suggests manual/external backup runs)

### Monitoring
**Status: PARTIAL** (last verified: 2026-03-10 — Sentry + PM2 confirmed, no APM)
- Sentry for errors + Telegram notifications
- PM2 auto-restart + memory limits
- No Prometheus, DataDog, or APM
- No dedicated health endpoint

### Redis
**Status: LIVE**
- ioredis client, lazy connect, single database (default DB 0)
- Usage: rate limits, EA login tokens, price cache (5 layers), live-risk cache, signal dedup locks, heartbeat rate limits, event reminder dedup

### Background Workers
**Status: PARTIAL** (last verified: 2026-03-10 — `server.ts` inspected, cron status unknown)
- In-process intervals in `server.ts`:
  - Trade evaluator: 60s (feature-flagged)
  - Event reminder: 30s
- Cron-intended endpoint: `/api/admin/stale-check` (every 60s) — **must be configured externally** (NEEDS VERIFICATION: check `crontab -l`)
- Manual scripts with cron suggestions: `scripts/daily-digest.ts` (8 AM Iran), `scripts/evening-digest.ts` (10 PM Iran) — **not auto-scheduled in repo** (NEEDS VERIFICATION: check `crontab -l`)

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
- **EA API keys stored plaintext** (64-char hex, direct DB lookup — not hashed)

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
- **Status: LIVE** (optional — not required for MVP launch)
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

## 5. Core Platform Rules

Enforced rules verified from code. For full evidence, see `SITE_RULES_AUDIT_REPORT.md`.

### Auth
- Signup requires name (2-50), username (3-30, lowercase, letter-start), email, password (min 8 chars)
- 42 reserved usernames blocked (admin, support, system, clantrader, etc.)
- Email verification required for email login (auto-verified in dev if no SMTP_HOST)
- Phone OTP: 6-digit, 5-min TTL, max 5 failed attempts, Iranian mobile format (`09xxxxxxxxx`)
- Roles: SPECTATOR (default) → TRADER (on EA login) → ADMIN (manual only)
- Rate limit: 5 auth requests / 60s per IP

### Clans
- One clan per user (DB enforced)
- Member limits: FREE tier = 3, PRO tier = 6
- Public clans: direct join. Private clans: join request → LEADER/CO_LEADER approval
- Clan switch: atomic transaction (leave + join). Private target = leave + pending request (user clanless until approved)
- Leader with members: must transfer leadership before leaving/switching
- Solo leader leaving: clan auto-dissolved (hard delete, all data cascaded)
- Only LEADER can delete clan, change roles, or transfer leadership
- LEADER/CO_LEADER can: edit settings, manage topics, approve requests, remove members (CO_LEADER cannot remove CO_LEADER)

### Chat & DMs
- Messages: 2000 char max, rate limit 5 msg / 10s per user, max 4 images per message
- Only clan members can post in clan chat
- Message edit: author only, no time limit. Deletion: author or LEADER/CO_LEADER (hard delete)
- Pinning: LEADER/CO_LEADER only, max 10 per topic
- Reactions: 6 fixed emojis only
- Topics: max 20 per clan, LEADER/CO_LEADER create, default "General" cannot be archived/renamed
- DMs: any user → any user (no clan/mutual requirement). No blocking or muting exists.
- No content filtering, moderation, or reporting system exists.

### Trade Cards & Statements
- SIGNAL cards: LEADER/CO_LEADER only (enforced in socket handler)
- ANALYSIS cards: any clan member
- Cards can be edited after trade closes (frozen snapshots protect statement integrity)
- Statement eligibility: 7 integrity conditions (deny-by-default)
- Statements are per-user-per-clan (not global). Each clan sees only its own trades.
- MT statement auto-generation: requires min 5 closed trades
- Journal: separate tabs for official (verified signal) and analysis trades

### EA Bridge
- Heartbeat: full snapshot every 30s, rate limited to 1/10s per account, includes floatingProfit + tradeAllowed
- Login: sends extended account data (accountName, currency, leverage, stopoutLevel, stopoutMode, isDemo)
- Close detection: DB open trades missing from heartbeat = closed
- Close price: same-source fallback only (never cross-broker)
- Signal qualification: 20s window, frozen risk snapshot
- Pending orders: NOT tracked (filtered out in EA)
- No reconnect handshake — implicit via heartbeat comparison
- No gap audit logging
- API keys: 64-char hex, stored plaintext for fast DB lookup
- All new fields backward-compatible (optional — older EAs still work)

### Leaderboard & Badges
- 6 lenses: composite (weighted), profit, low_risk, consistency, risk_adjusted, activity
- Composite weights: profit 0.3, consistency 0.25, risk_adjusted 0.2, low_risk 0.15, activity 0.1
- Min 10 trades for ranking (admin-configurable)
- Leaderboard is per-season (not per-clan)
- Badges: 4 categories (RANK, PERFORMANCE, TROPHY, OTHER), revocable, publicly visible
- Entry/SL edits invalidate badge eligibility (SET_BE/MOVE_SL do not)

### Admin
- All admin routes: `role === "ADMIN"` required
- Impersonation: creates JWT for target user. **No audit log recorded.**
- Feature flags: CRUD, cached, invalidated on change
- Audit log: tracks action, entity, actor, level, category
- Badge admin changes tracked separately

### Activity Digest
**Status: LIVE** (feature-flagged: `digest_v2` for cockpit layer)
- v1 (default): Per-member aggregates (signals, analysis, TP/SL/BE/open counts, win rate, total/avg R, trade list)
- v2 (behind `digest_v2` flag): Trading cockpit — primary metrics up front, health model as expandable detail
  - **Cockpit-first approach**: Primary view answers "what's floating, what's at risk, what needs action"
  - Per-trade: floating P/L, floating R, `riskToSLR` (R position if current SL hits), actions needed
  - Per-member aggregates: floating P/L, floating R, total risk-to-SL, action count
  - Realized section: closed P/L, closed R (unchanged from v1)
  - Attention queue: groups tracking-lost trades by member, max 5 items, max 2 per member, priority-ordered (CRITICAL > WARNING > INFO)
  - Health model (secondary): 6 dimensions demoted to expandable detail row, no longer the primary UX
  - **Deferred**: Daily Snapshot Layer for day-over-day comparison (no snapshot infrastructure exists, BACKLOG)
- API: `GET /api/clans/[clanId]/digest?period=today|week|month&tz=N&v=2`
- Redis cached: 90s TTL per clan/period/timezone
- UI: DigestSheetV2 in chat toolbar (replaces DigestSheet, backward-compatible with v1 responses)
- 139 unit tests for health computation functions

### Notifications
- Calendar event reminders: socket-based (1-hour + 1-minute before)
- Project digests: Telegram delivery, manual/cron scripts
- No in-app notification system. No push notifications. No email notifications (beyond auth).

### Monetization
- `isPro` flag exists but no active way to set it (no payment flow)
- PaywallRule model exists but rules are NOT enforced in any route
- SubscriptionPlan admin CRUD exists, no checkout flow
- Referral event tracking active (signup conversions)

### Security
- Passwords: bcrypt 10 rounds, min 8 chars
- File uploads: JPEG/PNG/WebP, 5MB max, resized to 256x256 WebP
- CORS: scoped to app URL
- No HTML sanitization (relies on React JSX escaping)
- No content moderation or input filtering beyond length limits

### Critical Verified Rules

Most decision-sensitive rules in one place. All verified in code (2026-03-10).

1. **One clan per user** — DB unique index + service check (CLAN-01)
2. **Private clan switch: user becomes clanless** — leave + pending request, NOT "stay in current clan" (CLAN-11)
3. **Leader with members cannot leave/switch** — must transfer leadership first (CLAN-12)
4. **SIGNAL cards: LEADER/CO_LEADER only** — enforced in socket handler, NOT in service layer (TRADE-01)
5. **Pending orders not tracked** — EA filters them out, only market orders synced (EA-14)
6. **20-second signal qualification window** — missed = analysis-origin forever (TRADE-08)
7. **7-condition integrity contract** — all must pass, deny-by-default (TRADE-07)
8. **Leaderboard is per-season, not per-clan** — cross-clan competition (LDR-05)
9. **PaywallRule model exists but is NOT enforced** — admin can create rules that have zero runtime effect (MON-02)
10. **Admin impersonation has NO audit trail** — creates JWT, no logging (ADM-04)
11. **No moderation exists** — no blocking, muting, reporting, or content filtering (ADM-07)
12. **API keys stored plaintext** — 64-char hex, direct DB lookup, not hashed (EA-09)

---

## 6. Launch Blockers (last verified: 2026-03-10)

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
5. **No user moderation tools** — no blocking, muting, reporting, or content filtering exists
6. **Admin impersonation audit logging** — impersonation creates JWT but does not log to audit trail

### Deferred by Decision
1. AI features — post-MVP
2. Payment processing (ZarinPal) — post-MVP
3. Channel post UI — post-MVP
4. Broker history import — not planned
5. Manual statement upload — not planned
6. CI/CD pipeline — post-MVP (manual deploy acceptable for beta)
7. Multi-step onboarding — post-MVP
8. Pending order tracking — not planned for MVP
9. In-app notifications / push notifications — not implemented
10. Email notifications (beyond auth) — not implemented

---

## 7. Known Contradictions Resolved

| Old Statement | New Truth | Reason |
|---------------|-----------|--------|
| CLAUDE.md: error tracking is "GlitchTip" | Error tracking is **Sentry** (`@sentry/nextjs`) + Telegram notifications | Code inspection: `sentry.server.config.ts`, `sentry.client.config.ts`, `@sentry/nextjs` in package.json. No GlitchTip dependency exists. |
| PRODUCTION-PLAN.md: ops are "NOT STARTED" | PM2, Sentry, deploy scripts, and rate limiting **all exist** | `ecosystem.config.cjs`, `src/lib/rate-limit.ts`, `sentry.*.config.ts` all present and functional. Doc was written 2026-02-21 before these were implemented. |
| PM-ROADMAP.md: Phone OTP is MVP blocker | Phone OTP is **implemented but optional** — not a launch blocker | Routes exist (`send-otp`, `verify-otp`, `phone-signup`), Kavenegar SDK integrated. Falls back to console.log without API key. Users can sign up via email/password. |
| PLATFORM_REPORT.md: "leave before join" clan model | Clan switch is a **single `$transaction`**. Public target: leave + join atomically. Private target: leave + pending request (user clanless until approved). | `clan.service.ts` `switchClan()` lines 391-474. Both paths wrapped in `$transaction`. |
| Deploy scripts reference Iran VPS paths | Dev is on Iranian VPS, but **prod/staging will be Germany VPS** | Decision made post-Feb 2026. Deploy scripts need path updates before Germany deployment. |
| CLAUDE.md: `clan-digest.service.ts` listed as service file | Digest runs from **manual scripts** (`scripts/daily-digest.ts`, `scripts/evening-digest.ts`), not an auto-running service | Scripts exist with suggested cron schedules but are not auto-scheduled. |
| price-system-report.md: single Redis key per symbol | Price pool now uses **5-layer source-aware Redis cache** | `price-pool.service.ts` implements trade, account, group, display, and active-groups layers with source-group isolation. |
| PRODUCTION-PLAN.md: single VPS, no staging | **Staging planned on Germany VPS** port 3001, prod port 3000 | MVP.md (Mar 8) reflects current plan. PRODUCTION-PLAN.md (Feb 21) is outdated. |
| No mention of clan member limits in docs | FREE tier = **3 members**, PRO tier = **6 members** | `clan-constants.ts` lines 1-4, enforced in `clan.service.ts` addMember() |
| SOT implied moderation features exist | **No moderation exists**: no blocking, muting, reporting, or content filtering | Full codebase search for block/mute/report/moderate returned no user-facing implementations |
| Admin impersonation assumed to be audited | **Impersonation does NOT log to audit trail** | `impersonate/route.ts` has no audit call |
| PaywallRule assumed to gate features | **PaywallRule model exists but is NOT enforced** in any route or middleware | Rules can be created in admin but have zero runtime effect |

---

## 8. Document Registry

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
| `SITE_RULES_AUDIT_REPORT.md` | **ACTIVE** | Detailed code-verified rules audit | High | Evidence source for Core Platform Rules section |
| `docs/archive/*` | **ARCHIVED** | 12 archived docs with deprecation banners | None | Historical reference only |

---

## 9. Maintenance Policy

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
- Feature completed or deferred
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

## 10. Open Verification Queue

Items not fully provable from code inspection alone (as of 2026-03-10):

1. **Is the stale-check cron configured on dev server?** — Check `crontab -l` on 31.97.211.86
2. **Are daily/evening digest scripts auto-scheduled?** — No crontab entry in repo
3. **Is auto-post feature flag enabled for any clan?** — Feature-flag dependent
4. **Is there a REST API path for trade card creation (bypassing socket role check)?** — Socket enforces SIGNAL role check, service does not
5. **Is admin impersonation ever audited anywhere outside the route itself?** — No audit call found
6. **Are PaywallRule checks enforced anywhere at runtime?** — Model exists, no enforcement found
7. **What happens to TraderStatement records when user leaves a clan?** — ClanMember cascade doesn't affect TraderStatement
8. **Is the statement route publicly accessible without auth?** — Needs route-level verification

---

## 11. Change Log

Newest first. Append-only.

| Date | Change | Reason | Affected Files |
|------|--------|--------|----------------|
| 2026-03-11 | Founder workflow system | Added 4 workflow skills (my-rules, task-start, task-update, weekly-pm), FOUNDER_LOOP.md, DECISION_LOG.md, docs/tasks/ and docs/testing/ directories. Internal tooling — no product/scope/rule change. | .claude/FOUNDER_LOOP.md, .claude/skills/*, docs/DECISION_LOG.md, docs/tasks/, docs/testing/ |
| 2026-03-11 | Activity Digest v2 cockpit refactor | Refactored v2 from health-taxonomy to trading cockpit. Primary metrics now: floating P/L, floating R, risk-to-SL, actions needed, realized P/L/R. Health model demoted to expandable detail. Attention queue groups tracking-lost by member. Per-trade `riskToSLR`. Per-member cockpit aggregates. Daily Snapshot Layer deferred (BACKLOG). Verified in code. | src/lib/digest-v2-schema.ts, src/services/digest-v2.service.ts, src/components/chat/DigestSheetV2.tsx, src/locales/en.json, src/locales/fa.json |
| 2026-03-10 | Activity Digest v2.1 — Open Trade Health Layer | New health-first analysis for open trades in clan digest. 6 health dimensions, attention queue, live health summary. Feature-flagged behind `digest_v2`. 139 unit tests. Backward-compatible with v1. Verified in code. | src/lib/open-trade-health.ts, src/lib/digest-constants.ts, src/lib/digest-v2-schema.ts, src/services/digest-v2.service.ts, src/components/chat/DigestSheetV2.tsx, src/app/api/clans/[clanId]/digest/route.ts, src/locales/en.json, src/locales/fa.json |
| 2026-03-10 | EA extended account data fields | EA login now sends accountName, currency, leverage, stopoutLevel, stopoutMode, isDemo. Heartbeat now sends floatingProfit, tradeAllowed. 5 new nullable columns + 1 boolean on MtAccount. Backward-compatible. Verified in code. | ea/MQL4/*.mq4, ea/MQL5/*.mq5, prisma/schema.prisma, src/services/ea.service.ts, src/lib/validators.ts |
| 2026-03-10 | Final precision pass | Clarified LIVE status (dev, not production), renamed "Shipped" → "Built", tightened target-user wording, added plaintext API key to Security section, replaced "shipped" with "completed" in triggers. No structural changes. | SOURCE_OF_TRUTH.md |
| 2026-03-10 | Consistency hardening pass | Fixed: private clan switch contradiction (clanless, not stay-in-current), chat image limit (4 not 10), standardized status vocabulary (added NOT IMPLEMENTED, removed BASIC/MISSING/IMPLEMENTED), labeled board counts as approximate, added last-verified dates to ops items, added Critical Verified Rules section, tightened clan switch contradiction resolution. Verified in code. | SOURCE_OF_TRUTH.md |
| 2026-03-10 | Added Core Platform Rules, Open Verification Queue, and SITE_RULES_AUDIT_REPORT.md | Deep code audit of 13 rule domains found 15 rules missing from SOT, 4 new contradictions, 8 open verification items | SOURCE_OF_TRUTH.md, SITE_RULES_AUDIT_REPORT.md |
| 2026-03-10 | Added `/project-update` skill for doc maintenance | Durable mechanism to keep SOURCE_OF_TRUTH.md current after every material task | .claude/skills/project-update/SKILL.md, CLAUDE.md |
| 2026-03-10 | Created SOURCE_OF_TRUTH.md | Reconcile all docs into single authority after audit found 8+ contradictions across CLAUDE.md, PRODUCTION-PLAN.md, PM-ROADMAP.md, PLATFORM_REPORT.md, and MVP.md | SOURCE_OF_TRUTH.md, CLAUDE.md, all docs/ files |
| 2026-03-10 | Corrected error tracking: GlitchTip → Sentry | Code inspection found @sentry/nextjs, no GlitchTip dependency | CLAUDE.md, SOURCE_OF_TRUTH.md |
| 2026-03-10 | Marked PRODUCTION-PLAN.md as HISTORICAL | Most claims outdated (ops infra partially exists now) | docs/PRODUCTION-PLAN.md |
| 2026-03-10 | Marked price system docs as HISTORICAL | 5-layer source-aware price pool is implemented, superseding both original report and review response | docs/price-system-report.md, docs/price-system-review-response.md |
| 2026-03-10 | Added doc status banners to all major docs | Establish clear authority hierarchy | All docs/ files |
