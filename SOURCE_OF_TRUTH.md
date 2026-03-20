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
| **Phase** | MVP Hardening (Phase B complete Mar 20; Phase C: Infra Mar 21–25) |
| **MVP timeline** | Mar 9 – Apr 8, 2026 (5 phases: QA → Harden → Infra → Beta → Launch) |
| **Target users** | Farsi-speaking forex/gold traders (diaspora-first launch, Iran-optimized product) |
| **Product identity** | Trust-first trader tool platform evolving toward Trading Command Center and Vibe Trading |
| **Stack** | Next.js 16.1, React 19, Prisma 7, PostgreSQL 16, Socket.io 4.8, Redis 7, TypeScript strict |
| **Dev server** | 31.97.211.86 (clantrader.com), root user |
| **Prod/Stage** | Germany VPS — TBD, staging port 3001, prod port 3000 |
| **Board status** | PM-board snapshot (2026-03-20): 94 DONE, 76 TODO, 15 BACKLOG, 2 IN_PROGRESS, 3 TESTING |

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
- Admin panel (16 pages: dashboard, feature-flags, paywall, plans, impersonate, badges, badges/recompute, referrals, statements, testing, kanban, audit-logs, alpha-issues, demo-data, clans, ranking, digests, dev-login)
- i18n (English + Persian, 1200+ keys, RTL support)
- Mobile responsive (Tailwind breakpoints + logical CSS)
- Rate limiting (6 tiers, Redis-backed)
- Error tracking (Sentry + Telegram notifications)
- PM2 process management
- Deploy scripts (pack, staging, promote-to-prod)
- Price pool (5-layer Redis cache, source-aware, verification-grade)
- Activity Digest v2 (3-zone trading intelligence: hero P/L, smart actions, price ladder with asset tabs + SHORT support + risk insight, equity curve with cash-flow-adjusted normalization + interactive hover/touch, 14 pure-function engines, deposit/withdrawal detection)
- Channel posts (full lifecycle: create, view, feed, reactions, view count)
- Notification system (in-app bell, persisted history, preferences, dedupe/cooldown, real-time delivery)
- Price alerts (ABOVE/BELOW, candle-style evaluation using M1 high/low, source-group aware, audio alerts)
- Server-side M1 candles (Redis, auto-expiring, built from EA heartbeat prices)
- EA broker symbol list (sent on login, stored in Redis, merged with traded symbols for autocomplete)
- Health endpoint (`/api/health` — DB/Redis/Socket.io checks, public + admin views)
- Service worker (network-first for JS/CSS chunks, cache-first for static assets, offline fallback)
- Onboarding (minimal modal)
- AI data capture foundation: DigestOutput (persisted digest v2 outputs with CLAN/TRADER scope), TraderStatementSnapshot (append-only statement history with ranking data), LiveRiskSnapshot (heartbeat-driven 5-min portfolio risk snapshots)
- IP-gated dev login (admin-managed whitelist replaces env var gate)
- Digest cockpit scenario ladder (interactive drag/click price exploration, pain levels, suggested SL)
- Locale flash prevention (blocking script + synchronous Zustand init)

### What Is Blocking Launch

See Section 6.

### What Is Intentionally Deferred

- Broker history import
- Manual statement file upload
- AI features (folder exists, empty)
- Payment processing / ZarinPal (DB models exist, no processor)
- Channel post notifications for followed clans
- Multi-step onboarding flow
- Prometheus / APM monitoring
- CI/CD pipeline
- Database backup automation
- Notification channels beyond in-app (Telegram, email, SMS)
- Advanced price alert conditions (RSI, MA cross, recurring alerts)

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

### Dev Login
**Status: LIVE** (added 2026-03-20)
- IP-gated dev login: admin manages whitelist of allowed IPs via `/admin/dev-login`
- `DevLoginIp` model: IP + optional label, unique constraint
- Login page checks `/api/auth/dev-login-check` on mount to show/hide dev login button
- Replaces `NEXT_PUBLIC_DEV_LOGIN` env var approach with DB-managed IP whitelist

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
- Message types: TEXT, TRADE_CARD, SYSTEM_SUMMARY, TRADE_ACTION (images are TEXT messages with `imageUrls` field)

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
- EquitySnapshot recording: balance + equity every 5 min per account (Redis-throttled), annotated with external flow data. Each snapshot tagged with `snapshotSource` (EA/FALLBACK), `estimateQuality` (REAL/FALLBACK_FRESH/FALLBACK_STALE/NO_PRICE), and `chartEligible` flag.
- **Deposit/withdrawal detection**: On each heartbeat, `externalFlow = balanceDelta - closedTradesPnL`. If exceeds dynamic threshold → `BalanceEvent` recorded with full audit metadata. Balance update in `processHeartbeat()` runs AFTER trade close detection to preserve previous balance for comparison.
- **Cash-flow-neutral performance**: NAV-based drawdown tracking (`navValue`, `peakNav`, `maxNavDrawdownPct` on MtAccount) immune to deposits/withdrawals. Equity chart uses adjusted series (raw - cumulative external flows) for trading-only visualization.
- **Heartbeat fallback** (LIVE): When EA stops, background estimation uses cross-user price pool to continue computing equity/PnL. Freshness-gated: only prices within 90s create chart-eligible snapshots, update MtAccount.equity, or broadcast socket PnL. Stale/no-price estimates are silently skipped to prevent fake flat lines on equity charts. Equity chart queries filter `chartEligible: true` and use anchor baseline (pre-period snapshot) for normalization. Time gaps >10min produce visual breaks in chart segments.
- **Cross-user price pool for fallback**: EAs with no open trades send `marketPrices` for symbols other users need. Server sends `watchSymbols` in heartbeat response. Ensures fresh prices even when the only connected EAs have zero open trades.

### Signal Qualification
**Status: LIVE**
- 20-second window from MT open time
- Origin types: `AT_OPEN` (SL+TP at open) or `WITHIN_WINDOW` (added within 20s)
- Missed window → permanent analysis-origin (never statements/leaderboard)
- Frozen official risk snapshot: entry always immutable; SL, TP, riskAbs, riskMoney mutable within 20s window via `reQualifyTrade()`, immutable after deadline
- R:R priority chain: `officialSnapshot > initialFields > tradeCard` — centralized in `risk-utils.ts` (`getFrozenEntry`, `getFrozenRiskAbs`, `getFrozenTP`), used by close service, `trade-r.ts`, live broadcast, channel service, and all UI components
- **Four R:R display types** (all use frozen snapshot denominator):
  - **Planned/original setup R:R** (`1:2.5`): frozen TP, frozen entry, frozen risk — never changes after 20s window. Centralized via `formatPlannedRR()` / `getPlannedRRRatio()` in `risk-utils.ts`
  - **Live R:R** (`+1.50R`): current price over frozen entry/risk — socket broadcast. Computed whenever frozen risk exists (`riskDistance > 0`), regardless of UNPROTECTED status. Live R = "current normalized P/L in units of original accepted risk." Falls to `$ P&L` display only when no frozen risk exists.
  - **Target R:R** (`Target: 2.5R`): current TP over frozen entry/risk — may change if TP moves (separate concept from planned). Null when TP removed; never suppressed by UNPROTECTED status alone.
  - **Final R:R** (`+2.00R`): close price over frozen entry/risk — set at trade close
- **SL deletion display**: When current SL = 0 but official frozen SL exists, UI shows "— (was X.XX)" instead of "Not set" — preserves audit trail of what the original risk was
- Official frozen fields (including `officialInitialStopLoss`) plumbed to UI via `messageInclude`, `serializeMessageForSocket`, `channel.service.ts` select, and `TradeCardData` type
- Close price correction (double-close from EA): updates trade DB + original chat message text + broadcasts socket events so card and message converge
- Risk money backfill: computed from floating P&L when price moves enough

### Integrity Contract
**Status: LIVE**
- **In plain English**: The integrity contract is the set of rules that decide whether ClanTrader is ALLOWED to present a trade or performance result as trustworthy. If data is stale, incomplete, manipulated, or unverifiable, the platform must not pretend it knows more than it does. A trade that fails any condition is excluded from public statements and rankings — it still exists in the journal, but it cannot affect the trader's public credibility.
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
- **In plain English**: Live risk = what is happening RIGHT NOW with a trader's open positions. It answers: "How much money is at risk? How are open trades performing? Is the data fresh or stale?" Live risk is NOT the digest — it is the real-time open-trade exposure layer that the digest, statement page, and rankings all consume.
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
- 16 page routes: dashboard, feature-flags, paywall, plans, impersonate, badges (+ recompute), referrals, statements, testing, kanban, audit-logs, alpha-issues, demo-data, clans, ranking, digests, dev-login
- 40+ API routes under `/api/admin/` (including badge dry-run, ranking config, stale-check, daily/evening digest triggers)
- Session-based auth, admin role required
- Kanban board at `/admin/kanban` with smart rebalancer

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

### Notifications & Price Alerts
**Status: LIVE**
- DB models: `Notification`, `NotificationPreference`, `PriceAlert`
- Enums: `NotificationSeverity` (CRITICAL/IMPORTANT/UPDATE), `NotificationFamily` (ACCOUNT/MARKET/CLAN/SYSTEM), `PriceAlertCondition` (ABOVE/BELOW), `PriceAlertStatus` (ACTIVE/TRIGGERED/CANCELLED)
- Services: `notification.service.ts`, `price-alert.service.ts`, `notification-triggers.ts`
- Type registry: `notification-types.ts` (all types, severity/family maps, cooldown windows)
- API routes: `/api/notifications`, `/api/notifications/unread-count`, `/api/notifications/[id]`, `/api/price-alerts`, `/api/price-alerts/[id]`, `/api/users/me/notification-preferences`, `/api/users/me/traded-symbols`, `/api/ea/broker-symbols`
- UI: `NotificationBell.tsx` (navbar with polling fallback + audio alerts), `PriceAlertModal.tsx` (symbol autocomplete from broker list), `PriceAlertList.tsx`, `/notifications` page, `/settings/notifications` page
- Socket events: `notification_new`, `notification_count_update`
- Price alert evaluation: 15-second server-side interval using candle-style M1 high/low (not just current price)
- Notification delivery: Socket.io real-time + 30-second polling fallback for reliability
- Audio alerts: Web Audio API double-beep for CRITICAL/sound-worthy notifications (price alerts, risk warnings)
- i18n: `notifications` + `priceAlerts` namespaces in en.json / fa.json

### Channel Posts
**Status: LIVE**
- DB model: ChannelPost with TradeCard embed
- API routes: `/api/me/channels`, `/api/me/feed`, post detail page (`/clans/[clanId]/posts/[postId]`)
- UI: ChannelPostCard (signal + text layouts), ChannelStream, ChannelFeed, ChannelInput, CreatePostForm, post detail page, HomeFeed cards, SignalPostCard, TradeCardChannelPost
- Features: create posts (LEADER/CO_LEADER), reactions, trade card signal display, premium gating, live R:R for open trades, image grid, auto-post badge
- View count: Telegram-style unique views (Redis SADD dedup — 1 view per user per post)
- RTL: `dir="auto"` on all user-generated text for mixed-direction content

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
**Status: LIVE** (verified in code: 2026-03-16)
- `GET /api/health` — checks DB (Prisma $queryRaw), Redis (ping), Socket.io (getIO)
- Public: returns `{ status: "ok" | "degraded" }` with 200 or 503
- Admin: returns full diagnostics (serverTime, uptime, database, redis, socketio status)
- Deploy scripts also do inline HTTP checks (curl to port)

### Backups
**Status: PARTIAL** (last verified: 2026-03-10 — no backup scripts in repo)
- `promote-to-prod.sh` creates file-level backup before deployment
- No automated database backup scripts
- `pg-backup.log` exists (suggests manual/external backup runs)

### Monitoring
**Status: PARTIAL** (last verified: 2026-03-16 — Sentry + PM2 + health endpoint confirmed, no APM)
- Sentry for errors + Telegram notifications
- PM2 auto-restart + memory limits
- `/api/health` endpoint (DB, Redis, Socket.io checks)
- No Prometheus, DataDog, or APM

### Redis
**Status: LIVE**
- ioredis client, lazy connect, single database (default DB 0)
- Usage: rate limits, EA login tokens, price cache (5 layers), M1 candles (per-symbol per-minute OHLC, 1h TTL), broker symbol lists (per-broker, 30d TTL), live-risk cache, signal dedup locks, heartbeat rate limits, event reminder dedup, notification cooldowns, channel post view dedup, price alert evaluation

### Background Workers
**Status: LIVE** (last verified: 2026-03-16 — `server.ts` inspected)
- In-process intervals in `server.ts` (all feature-flag gated):
  - Trade evaluator: 60s (flag: `trade_integrity_evaluator`)
  - Event reminder: 30s
  - Heartbeat fallback + stale check: 30s (flag: `heartbeat_fallback`)
  - Price alert evaluation: 15s
  - Notification service IO binding on startup
- Legacy endpoint: `/api/admin/stale-check` — **redundant when `heartbeat_fallback` flag is enabled** (in-process 30s interval handles stale detection). Retained as manual fallback if flag is disabled.
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
1. No automated database backups
2. No CI/CD pipeline
3. Deploy scripts need path updates for Germany VPS
4. Stale-check cron must be configured externally (or moved to in-process interval)
5. Digest scripts not auto-scheduled
6. No APM/metrics collection
7. ~~`/api/health` endpoint not implemented~~ — **RESOLVED** (2026-03-16): full health endpoint with DB/Redis/Socket.io checks, public + admin views.
8. ~~Heartbeat fallback not implemented~~ — **RESOLVED** (2026-03-15): freshness-gated fallback with cross-user price pool, equity chart hardening, gap detection.

---

## 4. Active Business / Scope Decisions

### Launch Market
- **Primary audience**: Iranian / Farsi-speaking forex/gold traders
- **Initial launch cohort**: Farsi-speaking traders OUTSIDE Iran (diaspora, Dubai, Turkey, etc.) via invite waves through Instagram close friends / trusted audience
  - Wave 1: ~10 users (inner circle)
  - Wave 2: ~50 users (expanded trusted audience)
  - Wave 3: ~150 users (broader early adopters)
  - Then broader rollout if stable
- **Iran-first** means: language/product fit (Farsi, RTL, no external CDN dependencies, self-hosted fonts) and technical constraints (sanctions-resilient architecture). It does NOT mean dependency on immediate in-Iran rollout or in-Iran hosting.
- **Iran-first does NOT mean**: hosted in Iran. Dev server is in Iran, but prod/staging will be Germany VPS.
- Kavenegar (SMS) and ZarinPal (payments) are API-based services that work from any server

### Phone OTP / Kavenegar
- **Status: LIVE** (optional — not required for MVP launch)
- Routes exist: `send-otp`, `verify-otp`, `phone-signup`
- Kavenegar SDK integrated with fallback to console.log when API key missing
- This is an optional auth path, not a blocker
- Can be enabled by setting `KAVENEGAR_API_KEY` env var

### MVP Boundary
**In MVP**: Auth, clans, chat, DMs, trade cards, EA bridge, integrity, statements, leaderboards, badges, admin panel, i18n, responsive design, error tracking, PM2

**NOT in MVP**: AI features, payment processing, broker history import, manual statement upload, CI/CD, APM monitoring, multi-step onboarding

### Priority Lens
The product prioritizes:
1. **Trust**: Deny-by-default eligibility, frozen snapshots, source-aware pricing — the foundation everything else builds on
2. **Risk reduction**: Integrity contract prevents fake/manipulated trading records
3. **Time saving**: Auto-generated statements, auto-created signals from EA, real-time data
4. **Credibility & discovery**: Rankings and badges serve as trust/discovery tools — they help users find credible traders and prove track records. Rankings are NOT the core emotional identity of the product; they support the trust layer.

### Product Identity
ClanTrader is a **trust-first trader tool platform** evolving toward a **Trading Command Center** and ultimately **Vibe Trading**.

It is NOT primarily:
- a signal-copy app (signals exist but serve trust verification, not distribution)
- a rankings-first competition app (rankings exist but serve discovery/credibility)
- a social feed app (chat/posts exist but serve structured context, not engagement farming)

Core product direction: **verified trader activity + useful trader tools + structured market context → later AI-powered decision support**.

### Product Philosophy
- **Deny-by-default**: Trades must earn eligibility through 7 verified conditions
- **No trust without verification**: EA bridge provides real-time verification, not self-reported stats
- **Conservative ranking**: Open losses penalize rank, open profits do not help — rankings support trust/discovery, not competition as the primary emotion
- **Transparency**: Stale data is flagged, not hidden. Tracking status is public.
- **One statement per trader per clan**: All MT accounts feed one public record
- **If the platform doesn't know, it must not pretend it knows**: Stale, incomplete, or unverifiable data is surfaced honestly, never hidden behind a clean facade

### Product Direction — Layer Roadmap
**Status: PLANNED (strategic direction, not implementation claim)**

ClanTrader evolves through layers. Each layer builds on the previous. Only Layer 1 is in active development.

| Layer | Name | Description | Status |
|-------|------|-------------|--------|
| 1 | **Trust Foundation** | Verified statements, integrity contract, rankings/badges, digest, journal, live risk visibility, useful free trader features, bug reporting/trust hardening, AI/SLM data preparation | IN PROGRESS |
| 2 | **News & Events** | Economic calendar, geopolitical context, market-moving event feeds | PLANNED |
| 3 | **Fundamentals** | Structured fundamental data layers relevant to forex/gold | PLANNED |
| 4 | **Command Center** | Unified trading dashboard — positions, risk, context, alerts in one view | PLANNED |
| 5 | **Trader Sentiment + AI Grounding** | Aggregated trader behavior patterns, narrow-task SLM systems grounded in platform data | PLANNED |
| 6 | **Vibe Trading Alpha** | AI-assisted trade context, scenario analysis, decision support (early/experimental) | PLANNED |
| 7 | **Full Vibe Trading** | AI-native trading experience inside ClanTrader | PLANNED |

See `docs/STRATEGIC_ROADMAP.md` for the expanded 7-phase plan.

#### Layer 1 — Trust Foundation (Current Focus)

Layer 1 is the MVP and near-term roadmap. It includes:
- **Verified statements**: Auto-generated from MT data with integrity contract enforcement
- **Integrity contract**: The rules that decide whether ClanTrader can present a trade/performance result as trustworthy (see Section 2)
- **Rankings & badges**: Support trust and discovery — help users find credible traders and prove track records
- **Activity digest**: Trading intelligence dashboard with risk insight, price ladder, equity curve
- **Trader journal**: Personal trade log with official and analysis tabs
- **Live risk visibility**: Current open-trade exposure (floating PnL, floating R, drawdown, stale warnings)
- **Useful free trader features**: Price alerts, notifications, trade cards, chat
- **Bug reporting / trust hardening**: User-facing problem reporting to surface data issues early (NOT YET IMPLEMENTED — see Known Gaps)
- **AI/SLM data preparation**: Structured data capture from Layer 1 onward that can later support narrow-task AI systems (see below)

#### Future AI / SLM Data Preparation
**Status: PLANNED (strategy, not implementation)**

From Layer 1 onward, the platform should gather structured data that can later support narrow-task SLM/AI systems. This is a data hygiene practice, not an AI feature claim.

Examples of data being captured or planned for capture:
- Labeled trade scenarios (entry quality, outcome, context)
- Clean structured inputs/outputs (digest outputs, statement snapshots, live risk snapshots)
- Bug reports and user corrections (when bug reporting is built)
- Asset-level behavior patterns (price ladder scenarios, concentration patterns)
- Signal outcomes (planned R:R vs actual, win/loss distribution)
- Trader behavior data (hold times, SL management patterns, scaling behavior)

The existing `DigestOutput`, `TraderStatementSnapshot`, and `LiveRiskSnapshot` models are early examples of this data capture strategy.

#### Future Chart / Canonical Market Data
**Status: PLANNED (strategic direction)**

Later layers (Command Center onward) will likely require a site-native chart and canonical market-data layer for:
- AI interaction and visual explanation
- Independent price verification
- Cross-broker symbol normalization

This should NOT be tied solely to broker candles from the EA. Future charting should rely on a canonical instrument/history layer with symbol normalization that can serve as a platform-wide price truth independent of any single broker's feed.

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
- Heartbeat: full snapshot every 30s, rate limited to 1/10s per account, includes floatingProfit + tradeAllowed + M1 candle high/low per watched symbol. Records `EquitySnapshot` (balance + equity) every 5 min per account (Redis-throttled). EA snapshots tagged `snapshotSource: EA`, `estimateQuality: REAL`, `chartEligible: true`. MarketPrices now include `high`/`low` from `iHigh()`/`iLow()` on PERIOD_M1 — fed into server-side M1 candle system.
- Login: sends extended account data (accountName, currency, leverage, stopoutLevel, stopoutMode, isDemo). Also sends full broker symbol list (`SendBrokerSymbols()` → `/api/ea/broker-symbols`).
- Close detection: DB open trades missing from heartbeat = closed
- Close price: same-source fallback only (never cross-broker)
- Signal qualification: 20s window, frozen risk snapshot (mutable within window via `reQualifyTrade`, immutable after deadline)
- R calculation: canonical priority chain `officialSnapshot > initialFields > tradeCard` centralized in `risk-utils.ts` (`getFrozenEntry`/`getFrozenRiskAbs`/`getFrozenTP`), used in close service, `trade-r.ts`, live broadcast, channel service, all UI components, and digest
- Close price correction: EA may send two close events; second updates trade, chat message, and broadcasts socket events
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
**Status: LIVE** (v2 default, v1 fallback with `v=1`)
- v2 (default): Scope-aware trading intelligence dashboard with 14+ pure-function engines
  - **Scope switcher**: Trader (default) / Clan modes — switches entire digest meaning
  - **Trader mode**: Personal risk/performance/actions from own positions only
  - **Clan mode**: Clan-wide monitoring with member breakdown and attribution
  - **14 engines** (pure functions in `digest-engines.ts`): state assessment, delta, alerts, actions, impact, concentration, risk budget, member trend, predictive hints, entry quality, scaling pattern, concentration summary, smart actions, price ladder + equity normalization
  - **3-zone layout**: Cockpit (above fold: hero P/L, smart actions) → Analysis (scrollable cards: price ladder, position profile) → Details (positions, system health collapsed)
  - **Equity & Balance Curve**: SVG chart with normalized Y-axis ($ change from period start, not absolute). Interactive hover (desktop crosshair + tooltip) and touch scrub (mobile fixed info bar). Data from `EquitySnapshot` model recorded by EA heartbeat (5-min Redis throttle). **Cash-flow adjusted**: deposits/withdrawals subtracted so they don't appear as spikes/cliffs. **Hardened against stale data**: only `chartEligible` snapshots queried; anchor baseline from pre-period snapshot for normalization; time gaps >10min produce visual breaks (no fake flat lines from stale fallback prices). Raw values preserved in tooltip.
  - **Price Ladder** (v2.4): SVG thermometer with asset tabs (single ladder + horizontal tab pills instead of stacked), SHORT-aware gradient (inverted colors for short positions), 7 level types (current, half profit, breakeven, worst entry, SL, TP, account loss), collision resolver (3% threshold priority-based merging), unrealistic level filter (hides levels beyond 0.2x–2x current price), position context line (direction · trades · lots · P/L). Point value derived from real trade data.
  - **Risk Insight** (v2.5): Auto-generated plain-language risk context below each price ladder. 4 tiers (Low/Moderate/Significant/High) based on account impact per 1% price move and distance to -10% loss level. Flags gap risk when no stop loss. Notes hidden loss levels count.
  - **Scenario Ladder** (v2.6): Interactive drag/click price exploration. 7 pure-function scenario engines: scenario P/L calculation, pain levels (-1%/-2%/-5% from current, -10%/-20%/-50% from entry), suggested SL levels for unprotected trades, snap points. Cockpit-style member rows (P/L + R + SL risk). Today strip + attention queue with severity sort. 111 unit tests.
  - Per-trade: floating P/L, floating R, `riskToSLR`, health dimensions, actions needed
  - Per-member aggregates: floating P/L, floating R, total risk-to-SL, action count, impact score
  - Scope-aware deltas: separate Redis snapshots for trader vs clan (`:trader` suffix key)
  - Smart actions: 6 priority levels (no SL on profit, size anomaly, concentration, wide spread, extended hold)
  - Attention queue: severity-ordered, grouped tracking-lost by member
- v1 (legacy): Per-member aggregates — accessible with `v=1` query param
- API: `GET /api/clans/[clanId]/digest?period=today|week|month&tz=N&v=2`
- Redis cached: 90s TTL per clan/period/timezone; 24h TTL per-user delta snapshots
- UI: DigestSheetV2 in chat toolbar (backward-compatible with v1 responses)
- 43 unit tests for engine functions, 1100 total tests passing

### Notifications
**Status: LIVE**
- In-app notification system with bell icon, unread badge, dropdown, and full `/notifications` page
- Persisted to DB (`Notification` model) with severity (CRITICAL/IMPORTANT/UPDATE), family (ACCOUNT/MARKET/CLAN/SYSTEM)
- Real-time delivery via Socket.io `user:${userId}` rooms
- User preferences: in-app on/off, delivery mode (all / critical_only) at `/settings/notifications`
- Redis-based dedupe/cooldown for noisy events (tracking flapping, rank changes, risk warnings)
- Notification types wired from real events:
  - Tracking lost/restored (heartbeat status changes)
  - Trade close (EA-verified close with outcome + R)
  - Trade action success/failure (SET_BE, MOVE_SL, CHANGE_TP, CLOSE)
  - Risk warnings: SL removal (UNPROTECTED), drawdown threshold crossing (5%/10%/15%/20%)
  - Integrity: eligibility lost, qualification missed (analysis-origin)
  - Rank changes (composite lens, ±3 positions or top-3 entry/exit)
  - Clan: join request, approval, rejection, member joined
- Price alerts: ABOVE/BELOW conditions, server-side evaluation every 15s using candle-style M1 high/low
  - **Candle-style evaluation**: ABOVE alerts check M1 candle HIGH, BELOW alerts check M1 candle LOW — catches price spikes that reverse between evaluation cycles
  - **Server-side M1 candles**: Redis-stored OHLC per symbol per minute, atomic Lua updates, 1-hour TTL auto-expiry. Built from EA heartbeat prices (both bid and M1 high/low from EA). Lookback: current + last 2 minutes for evaluation.
  - Source-group aware (uses same `getDisplayPrice()` as charts)
  - Weekend stale-price guard (skips non-crypto during market close)
  - One-time trigger, max 50 active per user
  - Management UI: create modal with symbol autocomplete (broker symbols + traded symbols), live price display + distance-to-target, direction validation (ABOVE > current, BELOW < current), active/history tabs (triggered/cancelled/expired), cancel active / soft-hide history, distinct crosshair icon in navbar
  - **Broker symbol list**: EA sends all broker symbols on login (`/api/ea/broker-symbols`), stored in Redis with 30-day TTL per broker. Merged with DB-traded symbols for autocomplete. MQL5 sends ALL broker symbols; MQL4 sends Market Watch only.
- Toast behavior: CRITICAL → error toast 8s, IMPORTANT → info toast 6s (with body text), UPDATE → no toast
- **Notification reliability**: Socket.io real-time delivery + 30-second polling fallback (checks unread count, fetches latest if increased). Dedup via `seenIds` ref prevents duplicate toasts.
- **Audio alerts**: Web Audio API synthesized double-beep (880Hz + 1100Hz) for sound-worthy types: price_alert_triggered, risk_no_sl, risk_drawdown, trade_action_failed. User-controllable via `soundEnabled` preference. No external audio files.
- **Severity mapping**: CRITICAL (red) for risk_no_sl, risk_drawdown, trade_action_failed. IMPORTANT (amber) for tracking_lost, price_alert_triggered, rank_change, integrity. UPDATE (muted) for trade_closed, trade_action_success, clan_member_joined.
- **Price alert soft-delete**: History items (triggered/cancelled/expired) use `hiddenFromUser` flag for soft-hide, preserving DB rows for future heatmap analytics.
- **Price alert validation**: ABOVE target must be > current price, BELOW must be < current price. Distance display shows absolute + percentage.
- Calendar event reminders: socket-based (1-hour + 1-minute before)
- **Web push**: Full VAPID implementation with per-category push preferences. Service worker subscription, automatic cleanup of expired subscriptions. Only shown in settings when VAPID keys are configured.
- NOT built: Telegram delivery, email notifications, SMS, webhooks, advanced automation

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
4. ~~QA pass on EA auth flow~~ — **RESOLVED** (2026-03-20): MT5 EA auth fully verified (register, login, token, heartbeat). MT4 deferred (code near-identical).

### Important But Not Blocking
1. **Automated database backups** — critical for production but can be set up during infra phase (Mar 17-21)
2. **Digest script scheduling** — cron needs to be configured for daily/evening digests
3. **Trade card staleness indicator in chat** — cards don't show stale warning, only statement page does
4. **No user moderation tools** — no blocking, muting, reporting, or content filtering exists
5. **Admin impersonation audit logging** — impersonation creates JWT but does not log to audit trail
6. **User-facing bug/problem reporting** — no way for users to report data issues, incorrect trades, or platform problems. Important for trust hardening: early users finding and reporting issues is a core part of the Layer 1 trust foundation. NOT YET IMPLEMENTED.

### Deferred by Decision
1. AI features — post-MVP
2. Payment processing (ZarinPal) — post-MVP
3. Broker history import — not planned
4. Manual statement upload — not planned
5. CI/CD pipeline — post-MVP (manual deploy acceptable for beta)
6. Multi-step onboarding — post-MVP
7. Pending order tracking — not planned for MVP
8. Notification channels beyond in-app (Telegram, email, SMS) — not implemented (web push IS built)
9. Channel post notifications for followed clans — not implemented

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
| SOT said "NOT built: web push" | Web push **IS built** — full VAPID implementation in `web-push.service.ts` with per-category preferences, subscription management, and automatic expired-subscription cleanup | Code inspection 2026-03-19: `web-push.service.ts`, `PushSubscription` model, settings UI push toggle, `sw.js` service worker all exist. |
| PRODUCTION-PLAN.md: single VPS, no staging | **Staging planned on Germany VPS** port 3001, prod port 3000 | MVP.md (Mar 8) reflects current plan. PRODUCTION-PLAN.md (Feb 21) is outdated. |
| No mention of clan member limits in docs | FREE tier = **3 members**, PRO tier = **6 members** | `clan-constants.ts` lines 1-4, enforced in `clan.service.ts` addMember() |
| SOT implied moderation features exist | **No moderation exists**: no blocking, muting, reporting, or content filtering | Full codebase search for block/mute/report/moderate returned no user-facing implementations |
| Admin impersonation assumed to be audited | **Impersonation does NOT log to audit trail** | `impersonate/route.ts` has no audit call |
| PaywallRule assumed to gate features | **PaywallRule model exists but is NOT enforced** in any route or middleware | Rules can be created in admin but have zero runtime effect |
| SOT: Health endpoint "NOT IMPLEMENTED" | **`/api/health` IS implemented** with DB/Redis/Socket.io checks | `src/app/api/health/route.ts` exists: public ok/degraded + admin full diagnostics. Verified 2026-03-16. |
| SOT: Admin panel "9 routes" | **16 admin pages + 40+ API routes** | Glob found 16 page.tsx under admin/ (latest: dev-login added 2026-03-20). API exploration found 40+ admin route handlers. |
| SOT: Chat message types "TEXT, TRADE_CARD, IMAGE" | **No IMAGE type in MessageType enum** — types are TEXT, TRADE_CARD, SYSTEM_SUMMARY, TRADE_ACTION | `prisma/schema.prisma` enum MessageType. Images are TEXT messages with imageUrls field. |

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
| `docs/STRATEGIC_ROADMAP.md` | **ACTIVE** | 7-phase product strategy roadmap | High | Long-term vision from Phase 0 (MVP) to Phase 7 (Full Vibe Trading) |
| `docs/tasks/*.md` | **ACTIVE** | Per-task briefs | Medium | Activity-digest, deposit-withdrawal-fix, heartbeat-fallback, notification-alarm-mvp, ghost-trade-resolution, digest-cockpit-scenario-ladder, qa-ea-metatrader-auth |
| `docs/testing/*-test-plan.md` | **ACTIVE** | Per-task test plans | Medium | Activity-digest, heartbeat-fallback, deposit-withdrawal-fix, notification-alarm-mvp, digest-cockpit-scenario-ladder |
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
| 2026-03-20 | Project update: IP-gated dev login, mobile UI fixes, locale flash prevention, scenario ladder, QA accounts ready, EA auth QA verified | Phase B completion reconciliation. New features: DevLoginIp model + admin page (16 pages now), locale flash prevention (blocking script + synchronous Zustand init), digest scenario ladder (v2.6 with 7 scenario engines, 111 tests). Board: "Prepare QA test accounts" and "QA: EA/MetaTrader auth" moved to DONE (94 total). EA auth blocker resolved. 1100 unit tests passing. | schema.prisma, login page, admin/dev-login, admin API, LocaleApplier, locale-store, DigestSheetV2, digest-engines, scenario-engines, SOURCE_OF_TRUTH.md |
| 2026-03-19 | Remove UNPROTECTED R:R suppression — enforce two-layer model | Product rule change: UNPROTECTED status no longer suppresses Live R or Target R. Frozen official snapshot denominator remains valid regardless of current SL state. `riskDistance > 0` guard sufficient. All 4 broadcast paths updated. Layer 1 (original plan) immutably drives R normalization; Layer 2 (management behavior) drives protection badges and journal events. | ea.service.ts, heartbeat-fallback.service.ts, socket-handlers/shared.ts, SOURCE_OF_TRUTH.md |
| 2026-03-19 | Notification + Alarm MVP: UX polish pass | Severity fix: PRICE_ALERT_TRIGGERED CRITICAL→IMPORTANT. Soft-delete: `hiddenFromUser` on PriceAlert (preserves rows for heatmap analytics). Audio: `soundEnabled` preference + settings toggle + test buttons. Price alert modal: direction validation (ABOVE>current, BELOW<current) + distance display. Settings restructured: 6 clear sections (history/popups/sound/push/delivery/test). Price alert icon: BellRing→Crosshair. Web push contradiction resolved (IS built). 69 new notification-types tests, 1088 total passing. FEATURES.md §17 added. | schema.prisma, notification-types.ts, price-alert.service.ts, NotificationBell.tsx, PriceAlertModal.tsx, PriceAlertList.tsx, AlertPanel.tsx, TopBar.tsx, settings/notifications/page.tsx, notification-preferences API, en.json, fa.json, FEATURES.md, SOURCE_OF_TRUTH.md |
| 2026-03-18 | Strategy/scope clarification pass: refined launch market (diaspora-first invite waves), sharpened product identity (trust-first trader tool platform → Trading Command Center → Vibe Trading), reframed priority lens (competition → credibility/discovery), added 7-layer product direction roadmap, added plain-English definitions for live risk and integrity contract, added AI/SLM data preparation strategy note, added future chart/canonical market data direction, added bug reporting to known gaps. No implementation-truth changes. | Founder strategy alignment session — clarify what ClanTrader IS (trust-first tools) vs what it is NOT (signal app, rankings app, social feed app) | SOURCE_OF_TRUTH.md |
| 2026-03-17 | UNPROTECTED R:R suppression + frozen SL reference display + frozen hierarchy hardening | When SL is deleted post-qualification, all 4 broadcast paths (`broadcastTradePnl`, `broadcastUnlinkedTradePnl`, `sendInitialPnl`, `broadcastEstimatedPnl`) now emit `currentRR: null` / `targetRR: null` for UNPROTECTED trades — UI falls through to $ P&L display. New "— (was X.XX)" SL reference when current SL = 0 but official snapshot exists. `sendInitialPnl` and `broadcastEstimatedPnl` upgraded from 2-level to 3-level frozen hierarchy. `getPost()` in channel.service.ts missing official fields — fixed. Integrity comment corrected 6→7 conditions. `officialInitialStopLoss` plumbed through serializer/types. 907 tests pass, lint clean, build clean. | ea.service.ts, heartbeat-fallback.service.ts, socket-handlers/shared.ts, channel.service.ts, integrity.service.ts, ea-signal-helpers.ts, chat-store.ts, TradeCardInline.tsx, en.json, fa.json, SOURCE_OF_TRUTH.md |
| 2026-03-17 | Fix static R:R display + centralize frozen snapshot resolution | Static "1:X.X" R:R on trade cards used mutable card SL/TP — inflated when SL moved (e.g., trailing). Root cause: official frozen fields existed in DB but were not selected/serialized to UI. Fix: (1) Added `getFrozenEntry`/`getFrozenRiskAbs`/`getFrozenTP`/`getPlannedRRRatio`/`formatPlannedRR` to `risk-utils.ts` with strict priority chain: officialSnapshot > initialFields > card. (2) Plumbed `officialEntryPrice`/`officialInitialRiskAbs`/`officialInitialTargets` through `messageInclude`, `serializeMessageForSocket`, `TradeCardData`, channel.service.ts select. (3) All 3 UI components (ChannelStream, ChannelPostCard, TradeCardInline) now use centralized helpers. (4) Both `broadcastTradePnl` and `broadcastUnlinkedTradePnl` now prefer official frozen fields. 30 new regression tests. Verified: 896 tests pass, lint clean, build clean. | risk-utils.ts, ea-signal-helpers.ts, chat-store.ts, channel.service.ts, ea.service.ts, ea-signal-close.service.ts, ChannelStream.tsx, ChannelPostCard.tsx, TradeCardInline.tsx, risk-utils.test.ts |
| 2026-03-16 | Candle-style price alert evaluation, notification reliability, EA broker symbols | Three changes: (1) Price alerts now use M1 candle high/low instead of current price — ABOVE checks HIGH, BELOW checks LOW — catches spikes that reverse between 15s evaluation cycles. Server-side M1 candles in Redis (atomic Lua OHLC, 1h TTL, 2-min lookback). EA sends M1 `iHigh()`/`iLow()` in heartbeat marketPrices. (2) Notification reliability: 30s polling fallback + Web Audio API alerts (double-beep for CRITICAL types) + IMPORTANT toast upgraded to 6s with body text. Price alert severity was initially CRITICAL (later changed to IMPORTANT in 2026-03-19 polish pass). (3) EA sends broker symbol list on login (`/api/ea/broker-symbols`, Redis 48h TTL). Symbol autocomplete merges broker + traded symbols. Verified in code — tests pass, build clean. | ea/MQL4/ClanTrader_EA.mq4, ea/MQL5/ClanTrader_EA.mq5, public/ea/*.mq4/*.mq5, price-pool.service.ts (M1 candles), price-alert.service.ts (broker symbols + candle eval), ea.service.ts (candle feed), NotificationBell.tsx (polling + audio), notification-types.ts (severity), validators.ts (schemas), api/ea/broker-symbols/route.ts (NEW) |
| 2026-03-16 | Extensive code audit: health endpoint LIVE, admin panel 15 pages (not 9), chat MessageType corrected (no IMAGE type), background workers now LIVE, service worker network-first for chunks, strategic roadmap added to registry | Code exploration revealed 3 SOT contradictions: (1) /api/health exists with DB/Redis/Socket.io checks, (2) admin has 15 pages + 40+ API routes, (3) MessageType enum has no IMAGE variant. Also: heartbeat fallback + price alert intervals already running in server.ts (background workers upgraded to LIVE). SW chunks switched to network-first to prevent stale cache errors. | SOURCE_OF_TRUTH.md, public/sw.js |
| 2026-03-15 | Equity chart hardening: stop fake flat history from stale fallback prices | Heartbeat fallback created EquitySnapshot rows using hours-old prices, producing fake flat dashed lines. Added `SnapshotSource`/`EstimateQuality` enums + `chartEligible` flag to EquitySnapshot. Freshness-gated: only prices within 90s create snapshots/update equity/broadcast. Stale estimates silently skipped. Chart queries filter `chartEligible: true`, use anchor baseline for normalization, and detect time gaps >10min as visual breaks. EA snapshots explicitly tagged. 823 tests pass, build clean. | schema.prisma (2 enums, 4 fields), heartbeat-fallback.service.ts, ea.service.ts, digest-v2.service.ts, digest-engines.ts, digest-v2-schema.ts, DigestSheetV2.tsx, heartbeat-fallback.service.test.ts (NEW, 28 tests), digest-engines.test.ts (+18 tests) |
| 2026-03-13 | R calculation fix: reQualifyTrade + official snapshot priority chain + close message convergence | SL hit showed -0.72R (card) and -0.58R (message) instead of -1R. Three root causes: (1) snapshot froze at first qualification and never re-froze when SL/TP changed within 20s window, (2) close service used initialFields instead of official snapshot, (3) double-close from EA updated trade but not message text. Added `reQualifyTrade()`, official→initial→card priority chain in all R paths, message update + socket broadcast on correction. 17 new regression tests. Verified in code — all tests pass, build clean. | signal-qualification.service.ts, ea-signal-modify.service.ts, ea-signal-close.service.ts, trade-r.ts, ea-signal.service.test.ts, signal-qualification.service.test.ts |
| 2026-03-13 | Channel post RTL + view count dedup | Persian text in channel posts aligned left instead of right. View count inflated on every page refresh instead of unique views. Added `dir="auto"` to all user-generated text. Replaced unconditional increment with Redis SADD dedup (`recordPostView`). Verified in code — build clean. | channel.service.ts, ChannelPostCard.tsx, ChannelStream.tsx, HomeFeed.tsx, posts/[postId]/page.tsx |
| 2026-03-13 | Channel Posts upgraded to LIVE status in SOT | SOT said "No UI components yet" but 10+ UI components exist (ChannelPostCard, ChannelStream, ChannelFeed, CreatePostForm, post detail page, HomeFeed cards). Removed "Channel post UI" from deferred list. Fixed "in-app notifications not implemented" deferred item (contradicted by LIVE Notifications section). | SOURCE_OF_TRUTH.md |
| 2026-03-13 | Activity Digest v2.4–v2.5: Price Ladder asset tabs, SHORT gradient, TP levels, collision resolver, unrealistic filter, risk insight | Stacked ladders per symbol destroyed compact feel. SHORT positions had inverted semantics but used LONG colors. TP levels missing despite data available. Tiny positions on large accounts showed absurd loss prices. Added auto-generated risk context insight below ladder. Verified in code — build clean, lint clean. | digest-engines.ts (computePriceLadder rewrite, generateLadderInsight), DigestSheetV2.tsx (PriceLadderSection with tabs, PriceLadderCard SHORT gradient), docs/tasks/activity-digest.md, DECISION_LOG.md |
| 2026-03-13 | Deposit/withdrawal detection + cash-flow-neutral performance | External cash flows (deposits/withdrawals) distorted equity charts, hero P/L %, and drawdown. Added BalanceEvent model for auditable detection, restructured heartbeat to detect flows before balance update, NAV-based drawdown tracking, adjusted equity series for charts. Rankings/statements already safe (R-based). 49 unit tests, backfill script. Verified in code — 693 tests pass, build clean. | schema.prisma (BalanceEvent, MtAccount NAV fields, EquitySnapshot annotations), balance-event.service.ts (NEW), ea.service.ts (restructured processHeartbeat), digest-engines.ts, digest-v2-schema.ts, digest-v2.service.ts, DigestSheetV2.tsx, backfill-balance-events.ts (NEW) |
| 2026-03-12 | Documented heartbeat-loss vulnerability + planned fallback | Deep research: 13 systems depend on heartbeat, 6 can use price pool as fallback. Task created, board task added (HIGH/TODO), SOT updated with known vulnerability. Inferred from code analysis. | SOURCE_OF_TRUTH.md, docs/tasks/heartbeat-fallback.md, docs/testing/heartbeat-fallback-test-plan.md, DECISION_LOG.md |
| 2026-03-12 | Activity Digest v2.1–v2.3: Equity curve, price ladder, chart normalization, interactive hover | Major digest enhancements: EquitySnapshot DB model + EA recording (5-min throttle), SVG equity chart with normalized Y-axis ($ change from period start), interactive crosshair tooltip (desktop) + touch scrub (mobile), price ladder with derived point values, 14 engines total. Verified in code — 644 tests pass, build clean. | digest-engines.ts, DigestSheetV2.tsx, schema.prisma (EquitySnapshot), ea.service.ts, digest-v2.service.ts, digest-v2-schema.ts, en.json, fa.json |
| 2026-03-11 | Activity Digest Phase 4: Scope-Aware Trader/Clan split | Digest now has Trader/Clan scope switcher (default: Trader). Trader mode shows personal-only state/deltas/actions/concentration/alerts. Clan mode preserves clan-wide view with member breakdown. Server computes trader-scoped deltas with separate Redis key. Client derives trader view from clan data using pure engine functions (no refetch on scope switch). 9 decision engines, premium dashboard UX. Verified in code — 644 tests pass, build clean. | DigestSheetV2.tsx, route.ts, digest-v2-schema.ts, en.json, fa.json, DECISION_LOG.md, docs/tasks/activity-digest.md |
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
