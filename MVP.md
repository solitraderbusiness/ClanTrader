# ClanTrader MVP Roadmap

> Last updated: March 8, 2026

ClanTrader is a competitive social trading platform where traders form clans, share signals, track trades via MetaTrader EA integration, and compete on leaderboards. This document tracks every task on the project board and defines the path to MVP launch.

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
| TODO | 36 | MVP pipeline — scheduled daily |
| BACKLOG | 36 | Deprioritized — not blocking MVP |
| IDEAS | 60 | Post-MVP features and concepts |

---

## MVP Timeline (March 9 - April 8)

### Phase 1: QA & Validation (March 9-13)

| Date | Task | Priority |
|------|------|----------|
| Mar 9 (Mon) | Manual E2E integrity test | CRITICAL |
| Mar 10 (Tue) | QA: Auth flows (signup, login, verify, reset) | CRITICAL |
| Mar 11 (Wed) | QA: Clans + chat + topics | CRITICAL |
| Mar 12 (Thu) | QA: Trade cards + signals + DMs | CRITICAL |
| Mar 13 (Fri) | QA: Admin panel + leaderboards | HIGH |

### Phase 2: Bug Fixes & Hardening (March 14-16)

| Date | Task | Priority |
|------|------|----------|
| Mar 14 (Sat) | QA fix round 1 | CRITICAL |
| Mar 15 (Sun) | QA fix round 2 + Statement accuracy check + Statement performance test | HIGH |
| Mar 16 (Mon) | Performance audit + CI/CD pipeline + Deployment docs | HIGH |

### Phase 3: Infrastructure & Deployment (March 17-21)

| Date | Task | Priority |
|------|------|----------|
| Mar 17 (Tue) | Prod/Stage server setup (Germany VPS) | CRITICAL |
| Mar 18 (Wed) | Deploy pipeline to prod/stage + SMTP for production email | CRITICAL |
| Mar 19 (Thu) | Deploy to staging + verify landing page + verify onboarding | HIGH |
| Mar 20 (Fri) | Final regression + promote staging to production | CRITICAL |
| Mar 21 (Sat) | Uptime monitoring + Telegram alerts + Blackout resilience test | HIGH |

### Phase 4: Beta Testing (March 22-30)

| Date | Task | Priority |
|------|------|----------|
| Mar 22 (Sun) | Prepare beta materials + Send invites to 10 beta traders | HIGH |
| Mar 23 (Mon) | Beta day 1-2: Onboarding monitoring | HIGH |
| Mar 24 (Tue) | Beta day 3-4: Chat & trade flow check | HIGH |
| Mar 25 (Wed) | Beta mid-point: Fix critical feedback | HIGH |
| Mar 26 (Thu) | Beta day 5-6: Collect first feedback round | NORMAL |
| Mar 27 (Fri) | Beta day 7-8: Statements & leaderboard check | NORMAL |
| Mar 28 (Sat) | Beta day 9-10: Final feedback collection | NORMAL |
| Mar 29 (Sun) | Fix all beta feedback issues | HIGH |
| Mar 30 (Mon) | Final regression test | HIGH |

### Phase 5: Alpha & Launch (March 31 - April 8)

| Date | Task | Priority |
|------|------|----------|
| Mar 31 (Tue) | Alpha invite batch | CRITICAL |
| Apr 1-7 | Alpha bug-fix buffer | CRITICAL |
| **Apr 8 (Tue)** | **Soft launch -- open to public** | **CRITICAL** |

---

## Currently in Testing

| Task | Status |
|------|--------|
| QA: EA/MetaTrader auth | Awaiting user verification (download EA, register, login, trade sync) |

---

## Backlog (Not Blocking MVP)

These tasks are deprioritized. They may be pulled in if time permits or after launch.

### Detailed QA Checklists (covered by grouped QA tasks above)
- QA: Desktop & mobile navigation
- QA: Top bar & RTL/LTR
- QA: Clan profile page (all tabs)
- QA: Clan settings & management
- QA: Create clan + discover/join
- QA: Real-time clan chat
- QA: Signal & analysis trade cards
- QA: Trade actions & status lifecycle
- QA: Direct messages
- QA: Admin panel (full)
- QA: PWA, invite, cross-cutting
- QA: Channel posts & reactions
- QA: Chat history & pagination
- QA: Reactions, pinning, typing, presence
- QA: Topics & invites + edge cases
- QA: User profiles (own + others)
- QA: Edit profile settings
- QA: Appearance & security settings
- QA: MT accounts settings
- QA: Home feed & missions
- QA: Leaderboard & badges
- QA: Journal filters
- QA: Trade journal dashboard & analytics
- QA: Watchlist & statements
- Prepare QA test accounts

### Bug Fix Buffers
- Fix critical bugs from QA (day 1)
- Fix critical bugs from QA (day 2)
- Fix remaining QA bugs + regression test

### Phone OTP (Deferred)
- Phone OTP signup/login (Kavenegar)
- Kavenegar OTP on production
- Get Kavenegar API key for production
- QA: Phone OTP signup & login
- QA: Phone & email verification

### Other
- RTL visual regression tests
- SEO (OG tags, sitemap, canonical)
- Rate-limit clan join requests per user

---

## Ideas (Post-MVP)

Features and concepts for future development, organized by domain.

### AI & Intelligence
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

### Market Data Pipeline
- MT quote storage
- OHLC candle aggregation
- Price freshness rules
- Symbol normalization resolver
- Market data health dashboard

### News System
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

### Paper Trading / Vibe Trading
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

### Monetization
- ZarinPal payment gateway
- Subscription checkout flow
- Subscription management
- Paywall enforcement
- Channel subscription marketplace
- Request Analysis marketplace
- Invoice generation
- Referral reward system

### Social
- Stories system
- Season results page

### Infrastructure
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
- Security audit (OWASP Top 10) -- 8 HIGH-severity fixes
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
