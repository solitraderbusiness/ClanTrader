> **Status:** ACTIVE
> **Last reviewed:** 2026-03-10
> **Authority:** SOURCE_OF_TRUTH.md
> **Notes:** Launch scope and timeline reference. Closest to current reality among planning docs. For product truth, defer to SOURCE_OF_TRUTH.md.

# ClanTrader MVP Roadmap

> Last updated: March 8, 2026

ClanTrader is a competitive social trading platform where traders form clans, share signals, track trades via MetaTrader EA integration, and compete on leaderboards. This document is the **single source of truth** for the launch schedule and syncs directly with the Admin Project Board.

---

## MVP Vision

The MVP delivers a fully functional trading community platform with:

- **Authentication**: Email/password signup, login, email verification, password reset
- **Clans**: Create/join/discover clans, invite codes, join requests, settings management
- **Real-time Chat**: Socket.io-powered clan chat with topics, reactions, pinning, typing indicators, presence
- **Trade Cards**: Signal and analysis trade cards with entry/SL/TP, direction, R:R tracking
- **EA Integration**: MetaTrader 4/5 Expert Advisor for two-way trade sync and live R:R updates
- **Trade Integrity**: Deny-by-default integrity system preventing statement manipulation
- **Statements**: Upload HTML statements, auto-recalculate metrics, admin review/approval
- **Leaderboard**: Multi-lens rankings (Total R, Win Rate, Avg Trades/Week, etc.)
- **Profiles**: User profiles with trading style, preferred pairs, session preference, badges
- **i18n**: Full English + Persian (Farsi) support with RTL layout
- **PWA**: Installable progressive web app with offline support

---

## Board Summary

| Column | Count | Description |
|--------|-------|-------------|
| DONE | 88 | Completed features and tasks |
| BUGS_FIXED | 10 | Resolved bugs with root cause documentation |
| TESTING | 1 | Awaiting user verification |
| TODO | 61 | MVP pipeline (36 parent + 25 QA sub-tasks) |
| BACKLOG | 11 | Deferred, not launch-blocking |
| IDEAS | 60 | Post-MVP features and concepts |

### Board Fields

Each task uses these fields for scheduling:

- **phase**: `A-QA`, `B-HARDEN`, `C-INFRA`, `D-BETA`, `E-LAUNCH`, or `DEFERRED`
- **workstream**: `PRODUCT_CORE`, `TRUST_INTEGRITY`, `PLATFORM_OPS`, `MONETIZATION_GROWTH`, `MARKET_INTELLIGENCE`
- **milestone**: `MVP_BETA`, `ALPHA_TEST`, `PUBLIC_LAUNCH`, `POST_LAUNCH`
- **epicKey/epicTitle**: Groups QA sub-tasks under parent QA days (e.g., `qa-clans`)
- **isLaunchBlocker**: True for tasks on the critical path
- **acceptanceCriteria**: What "done" looks like for each task
- **position**: Sort order within a day (trust first, auth second, core third, infra after)

---

## MVP Timeline (March 9 - April 8)

### Stage A: QA & Validation (March 9-13) — phase `A-QA`

**Mar 9 (Mon) — Trust & Integrity**
- Manual E2E integrity test `CRITICAL` `LAUNCH_BLOCKER`
  - AC: Normal open/close, SL/TP detection, manual close, duplicate event handling, delayed sync recovery, leaderboard/profile consistency, integrity evaluator accuracy. Markets must be open.

**Mar 10 (Tue) — Authentication** `[epic: qa-auth]`
- QA: Auth flows (signup, login, verify, reset) `CRITICAL` `LAUNCH_BLOCKER`
  - AC: Signup (valid/duplicate/weak), login (correct/wrong/unverified), email verification (click/expired/resend), password reset (request/click/expired). Desktop + mobile, EN + FA. Rate limiting triggers.
- Sub-tasks: Prepare QA test accounts

**Mar 11 (Wed) — Clans & Chat** `[epic: qa-clans]`
- QA: Clans + chat + topics `CRITICAL` `LAUNCH_BLOCKER`
  - AC: Create/discover/join clan, invite codes, join requests, leave/switch, chat send/receive, reactions, pin/unpin, typing/presence, topics CRUD, chat pagination. Desktop + mobile, EN + FA.
- Sub-tasks: Clan profile, Clan settings, Create/join, Real-time chat, Topics & invites, Channel posts, Chat history, Reactions/pinning/presence

**Mar 12 (Thu) — Trading & DMs** `[epic: qa-trades]`
- QA: Trade cards + signals + DMs `CRITICAL` `LAUNCH_BLOCKER`
  - AC: Signal card creation (all fields validate), analysis card (Live P&L), auto-post, track/untrack, trade actions (TP/SL/BE/close), MT-linked guard, edit/cancel, DM text/image/share. Mobile readability, real-time R:R.
- Sub-tasks: Signal & analysis cards, Trade actions & lifecycle, Direct messages

**Mar 13 (Fri) — Admin & Everything Else** `[epic: qa-admin]`
- QA: Admin panel + leaderboards `HIGH` `LAUNCH_BLOCKER`
  - AC: Statement review, badge management, ranking config, impersonation, audit log, leaderboard accuracy, profile badges, explore rankings, admin-only 403.
- Sub-tasks: Admin panel (full), Leaderboard & badges, Journal, Watchlist & statements, Navigation, Top bar & RTL, PWA/invite, Profiles, Settings, MT accounts, Home feed

### Stage B: Bug Fixes & Hardening (March 14-16) — phase `B-HARDEN`

**Mar 14 (Sat) — Critical Bug Fixes**
- QA fix round 1 `CRITICAL` `LAUNCH_BLOCKER`
  - AC: All CRITICAL and HIGH bugs from Stage A fixed. Each fix: regression test + BUGS_FIXED log + build passes + verified live.

**Mar 15 (Sun) — Remaining Fixes + Statement Validation**
- QA fix round 2 `HIGH` `LAUNCH_BLOCKER`
  - AC: All MEDIUM/LOW bugs from Stage A. Zero CRITICAL bugs remaining.
- Statement recalculation accuracy check `HIGH` `LAUNCH_BLOCKER`
  - AC: 5+ sample statements compared: Total R, win rate, max drawdown, avg trades/week accuracy.
- Statement performance test `HIGH`
  - AC: Recalculation completes for 100+ trade users. Leaderboard query < 2s.

**Mar 16 (Mon) — Performance & CI/CD**
- Performance audit & optimization `NORMAL`
  - AC: Home < 3s, chat < 2s, socket < 1s, no memory leaks, no queries > 500ms.
- CI/CD pipeline (GitHub Actions) `HIGH` `LAUNCH_BLOCKER`
  - AC: Lint + type-check + tests on PR. Build check. Branch protection on main.
- Deployment checklist & docs `NORMAL`
  - AC: Server requirements, env vars, deploy steps, rollback, monitoring, backup/restore documented.

### Stage C: Infrastructure & Deployment (March 17-21) — phase `C-INFRA`

**Mar 17 (Tue) — Server Setup**
- Prod/Stage server setup (Germany VPS) `CRITICAL` `LAUNCH_BLOCKER`
  - AC: Ubuntu + Node 20 + PM2 + Nginx + PostgreSQL 16 + Redis. SSH access. Staging :3001 (Redis DB 1), prod :3000 (Redis DB 0). Firewall (80/443/22). SSL. DNS.

**Mar 18 (Wed) — Deploy Pipeline & Email**
- Deploy pipeline to prod/stage end-to-end `CRITICAL` `LAUNCH_BLOCKER`
  - AC: deploy-pack.sh, scp, deploy-staging.sh, promote-to-prod.sh, zero-downtime restart, rollback script.
- SMTP for production email `CRITICAL` `LAUNCH_BLOCKER`
  - AC: Resend SMTP on Germany VPS. Verification + reset emails deliver. noreply@clantrader.com. Not spam.

**Mar 19 (Thu) — Staging Deployment**
- Deploy latest build to staging `HIGH` `LAUNCH_BLOCKER`
- Final fixes + deploy to staging `HIGH`
- Verify landing page on staging/prod `NORMAL`
  - AC: Hero renders, CTAs work, responsive, EN/FA, no console errors.
- Verify onboarding flow on staging `NORMAL`
  - AC: Signup, email verification, intent, missions, dismiss persists.

**Mar 20 (Fri) — Production Go-Live**
- Final regression + staging deploy `CRITICAL` `LAUNCH_BLOCKER`
  - AC: All tests pass, build succeeds, smoke test on staging, zero CRITICAL bugs, GlitchTip active.
- Promote staging to production `CRITICAL` `LAUNCH_BLOCKER`
  - AC: Production responds, SSL works, login works, chat connects, GlitchTip receives, backups running.

**Mar 21 (Sat) — Monitoring**
- Uptime monitoring + Telegram alerts `HIGH`
  - AC: /api/health pinged every 5 min, Telegram alert within 2 min of downtime, resolves on recovery.
- Blackout resilience test `HIGH`
  - AC: PM2 auto-restart, server reboot recovery, Redis/DB reconnect, no silent data loss, socket auto-reconnect.

### Stage D: Beta Testing (March 22-30) — phase `D-BETA`

**Mar 22 (Sun) — Beta Launch**
- Prepare beta invite materials `NORMAL`
  - AC: Welcome message, feedback channel, known limitations doc, test scenarios list.
- Send invites to 10 beta traders `HIGH` `LAUNCH_BLOCKER`
  - AC: 10 codes generated, messages sent, 5+ confirmed.

**Mar 23 (Mon)** — Beta day 1-2: Onboarding monitoring `HIGH`
**Mar 24 (Tue)** — Beta day 3-4: Chat & trade flow check `HIGH`
**Mar 25 (Wed)** — Beta mid-point: Fix critical feedback `HIGH` `LAUNCH_BLOCKER`
  - AC: No data loss, no auth bugs, no trade tracking bugs. Core flows work for all testers.

**Mar 26 (Thu)** — Beta day 5-6: Collect first feedback round `NORMAL`
**Mar 27 (Fri)** — Beta day 7-8: Statements & leaderboard check `NORMAL`
**Mar 28 (Sat)** — Beta day 9-10: Final feedback collection `NORMAL`

**Mar 29 (Sun)** — Fix all beta feedback issues `HIGH` `LAUNCH_BLOCKER`
  - AC: Every CRITICAL fixed with regression test. HIGH fixed or documented. Testers confirm.

**Mar 30 (Mon)** — Final regression test `HIGH` `LAUNCH_BLOCKER`
  - AC: All tests pass, build succeeds, full smoke on production, zero CRITICAL/HIGH, backups verified, monitoring active.

### Stage E: Alpha & Launch (March 31 - April 8) — phase `E-LAUNCH`

**Mar 31 (Tue)** — Alpha invite batch `CRITICAL` `LAUNCH_BLOCKER`
  - AC: 50+ codes distributed, monitoring active for traffic spike, support channel ready.

**Apr 1-7** — Alpha bug-fix buffer `CRITICAL` `LAUNCH_BLOCKER`
  - AC: Fix alpha bugs, performance holds, no integrity issues, zero CRITICAL for 48h+.

**Apr 8 (Tue)** — **Soft launch -- open to public** `CRITICAL` `LAUNCH_BLOCKER`
  - AC: Signup open, landing live, all core features working, monitoring active, backups running, support ready.

---

## Currently in Testing

| Task | Status |
|------|--------|
| QA: EA/MetaTrader auth | Awaiting user verification (download EA, register, login, trade sync) |

---

## Backlog — Deferred (11 tasks)

Not launch-blocking. May be pulled in after MVP or if capacity allows.

### Phone OTP (no current plan for phone verification)
- Phone OTP signup/login (Kavenegar)
- Kavenegar OTP on production
- Get Kavenegar API key for production
- QA: Phone OTP signup & login
- QA: Phone & email verification

### Bug Fix Buffers (standby)
- Fix critical bugs from QA (day 1)
- Fix critical bugs from QA (day 2)
- Fix remaining QA bugs + regression test

### Other
- RTL visual regression tests
- SEO (OG tags, sitemap, canonical)
- Rate-limit clan join requests per user

---

## Ideas — Post-MVP (60 tasks)

Not scheduled. Will not enter the launch calendar.

### AI & Intelligence (15)
- OpenRouter client wrapper (retries, rate limits, prompt versioning, cost tracking)
- AI news classifier (category, instruments, impact, sentiment)
- Daily briefing generator (per-asset + overall market summary)
- Briefing UI (show in app, share to clan)
- Per-asset mini-briefing (AI summary of recent price action)
- ContextBuilder service
- AI router service
- AIRouter service (failover chain)
- Prompt versioning + A/B testing
- Trade analysis cards (AI)
- Chat summary generation
- Clan AI assistant (@ai mention)
- Spectator AI chatbot
- Behavioral insights
- Weekly coaching digest
- Trader insight reports

### Market Data Pipeline (5)
- MT quote storage
- OHLC candle aggregation
- Price freshness rules
- Symbol normalization resolver
- Market data health dashboard

### News System (11)
- RSS fetcher service
- NewsItem model
- Finnhub + NewsData.io API fetcher
- News dedup engine
- News cron worker
- News API endpoint
- News image proxy
- News page UI
- Admin manual EventCard posting
- Live News Feed (financial & geopolitical aggregation)
- Add Geo Live News page with Liveuamap widget

### Paper Trading / Vibe Trading (16)
- TradePlanCandidate builder (deterministic math)
- Typed contracts (Zod schemas for MarketSnapshot, EventCard, BriefingRecord)
- Vibe input UI
- ParsedVibe extraction
- Paper position creation
- Paper position lifecycle
- Paper portfolio dashboard
- Outcome scoring
- VibeScoreProfile
- Replay UI
- Send plan to MT
- Emergency close all positions
- Execution journal
- Money management presets
- Watch tasks
- Alert pipeline

### Monetization (8)
- ZarinPal payment gateway
- Subscription checkout flow
- Subscription management
- Paywall enforcement
- Channel subscription marketplace
- Request Analysis marketplace
- Invoice generation
- Referral reward system

### Social (2)
- Stories system
- Season results page

### Infrastructure (2)
- Structured logging (Pino)
- Telegram error alerts: production-only mode

---

## Completed Work (88 features + 10 bug fixes)

### Core Platform
- Email + password auth
- JWT sessions (Auth.js v5)
- Username system + availability check
- Email verification flow
- Password reset flow
- Phone OTP authentication
- Referral tracking on signup
- Onboarding flow (intent + missions)
- User profiles & avatars
- Follow system
- i18n + RTL support (en/fa)
- Landing page + marketing
- PWA manifest + service worker
- Feature flags system

### Clans & Social
- Clan CRUD + settings
- Join requests + invite codes
- Real-time chat (Socket.io)
- Chat topics & threading
- Channel feed & posts
- Reactions, pinning, images, typing, presence
- Direct messages
- Discover page + filters
- Clan activity digest
- Fix clan membership UX (switch flow, solo leader leave, delete clan)

### Trading
- Signal & analysis trade cards
- Trade tracking & lifecycle
- Trade actions (SL/TP/BE/close)
- Auto-post from trade cards
- EA/MetaTrader bridge (two-way)
- EA/MetaTrader auth (register + login)
- EA auth UX improvements (password mask, email login, signup redirect)
- MT account linking
- Show Live P&L for trades without SL (analysis cards)

### Integrity & Statements
- Integrity contract (deny-by-default)
- Trade integrity evaluator (background)
- Admin override governance
- Statement upload + HTML parsing
- Auto-recalculate trader statements
- Admin statement review/approval

### Leaderboard & Rankings
- Multi-lens rankings (6 lenses)
- Badge system (rank/perf/trophy)
- Auto badge evaluation
- Ranking config panel
- Redesign Explore page (unified clan leaderboard)

### Infrastructure & Security
- Security audit (OWASP Top 10) — 8 HIGH-severity fixes
- Exploit regression tests (30 tests covering 9 attack vectors)
- Rate limiting on all public routes (Redis-based, 5 tiers)
- Zod env validation at startup
- Self-hosted error tracking (GlitchTip + Telegram alerts)
- Automated PostgreSQL backups (6h cycle, 7-day retention)
- /api/health endpoint (DB + Redis + Socket.io checks)
- PM2 process management
- Deploy pipeline
- Economic calendar sync + event reminders
- Daily PM digest via Telegram bot

### UX Polish
- Mobile responsive polish (12 files)
- Mobile audit (chat layout, spacing, touch targets, trade events)
- Signal cards readable on mobile
- Modals and sheets on mobile (sidebar overlap, language/theme toggles, empty states)

### Bug Fixes (10)
- Fix: ChatPanel height pushed input behind MobileNav
- Fix: Tab bar overlapping ChatHeader
- Fix: Auto-hide bottom nav too aggressive
- Fix: Massive empty gaps between chat messages
- Fix: Stray bracket and cluttered trade action messages
- Fix: Hamburger menu close button overlaps invite icon
- Fix: Language/theme toggles missing on mobile
- Fix: Switch clan bypasses join request requirement
- Fix: Mission dashboard dismiss reappears on refresh
- Fix: Username login bypassed email verification
