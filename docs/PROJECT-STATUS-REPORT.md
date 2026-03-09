# ClanTrader — Project Status Report

**Date:** March 2, 2026
**Prepared for:** Project Manager Review
**Source:** Full codebase audit + documentation cross-reference

---

## 1. What Are We Building?

ClanTrader is a **competitive social trading platform** for the Iranian market where:

- Traders form **clans** (teams of 3–6) and compete in monthly **seasons**
- Every trader's performance is **verified** via MetaTrader EA bridge (no fake screenshots)
- Real-time **clan chat** with trade signal cards, reactions, DMs
- **Leaderboards** with 6 ranking lenses (profit, consistency, risk-adjusted, etc.)
- **Badges & reputation** system tied to verified performance
- **Channel feeds** (Telegram-style broadcasts) with paywall support
- **Iranian-first architecture**: works entirely within Iran's National Information Network during internet blackouts

**Tech Stack:** Next.js 16.1, React 19, TypeScript (strict), Prisma 7, PostgreSQL 16, Redis 7, Socket.io 4.8, Tailwind CSS 4

**Target market:** 500K+ active retail traders in Iran

---

## 2. Phase Overview

The project is organized into **8 development phases**:

| Phase | Name | Scope | Status |
|-------|------|-------|--------|
| P1 | Auth & Profiles | Login, signup, user management | **DONE** |
| P2 | Statements & Verification | Trade statement upload, parsing, admin review | **DONE** |
| P3 | Clans & Chat | Clan system, real-time chat, DMs, trade cards | **DONE** |
| P4 | Leaderboards & Badges | Seasons, rankings, badge system | **95% DONE** |
| P5 | Content & Integrity | Channel feed, discovery, trade integrity engine | **90% DONE** |
| P6 | AI Features | LLM integration, chat summaries, trade analysis | **NOT STARTED** |
| P7 | Payments | ZarinPal, subscriptions, paywall enforcement | **NOT STARTED** |
| P8 | Polish & Launch | PWA, mobile, testing, deployment, monitoring | **60% DONE** |

---

## 3. Detailed Phase Breakdown

### Phase 1 — Auth & Profiles (DONE)

All code is written, tested, and deployed.

| Feature | Status | Notes |
|---------|--------|-------|
| Phone OTP auth (Kavenegar SMS) | **DONE** | Kavenegar SDK integrated. Console fallback in dev mode. |
| Email + password auth | **DONE** | bcrypt hashing, Auth.js v5 Credentials provider |
| Email verification flow | **DONE** | Nodemailer + 24h token. **Needs SMTP config for production.** |
| Password reset flow | **DONE** | 1h expiring token. **Needs SMTP config for production.** |
| User profiles & avatars | **DONE** | Sharp image processing, bio, trading style, preferred pairs |
| Username system | **DONE** | Real-time availability check, reserved username list |
| JWT sessions (Auth.js v5) | **DONE** | Extended with role, isPro, phone, onboardingComplete |
| i18n + RTL (English/Persian) | **DONE** | 31 translation sections, logical CSS properties only |
| EA/MetaTrader auth | **DONE** | Username+password with API key generation |
| Phone add/change flow | **DONE** | Multi-mode OTP: login, add-phone, signup |
| Referral tracking | **DONE** | Event tracking for link clicks, signups. Admin analytics. |

**Blockers for production:**
- Need `KAVENEGAR_API_KEY` environment variable for live SMS
- Need `SMTP_HOST/PORT/USER/PASS` for email verification & password reset

---

### Phase 2 — Statements & Verification (DONE)

| Feature | Status | Notes |
|---------|--------|-------|
| Statement upload flow | **DONE** | Drag-and-drop file upload |
| HTML statement parsing | **DONE** | Cheerio extracts MT4/MT5 metrics |
| Admin statement review | **DONE** | Approve/reject with notes, view original HTML |
| MT account linking | **DONE** | Multiple accounts per user, API key per account |
| Auto-recalculate on trade close | **DONE** | Monthly, seasonal, all-time aggregation |
| TraderStatement aggregation | **DONE** | Computed metrics per user/clan/period |
| Myfxbook API integration | **NOT STARTED** | Optional enhancement — broker-verified vs self-reported |

---

### Phase 3 — Clans & Chat (DONE)

| Feature | Status | Notes |
|---------|--------|-------|
| Clan CRUD + settings | **DONE** | Name, avatar, privacy, trading focus, tier |
| Real-time chat (Socket.io) | **DONE** | Messages, replies, edits, deletes, rate limiting |
| Chat topics & threading | **DONE** | Default topics, create/archive, sort order |
| Signal & analysis trade cards | **DONE** | SIGNAL + ANALYSIS types with full trade data |
| Trade lifecycle tracking | **DONE** | PENDING → OPEN → TP_HIT/SL_HIT/BE/CLOSED |
| Trade actions (SL/TP/BE/close) | **DONE** | Full event log with actor tracking |
| Direct messages | **DONE** | 1:1 DMs, typing indicators, read receipts, images |
| Join requests + invites | **DONE** | Invite codes with expiry/usage limits, approve/deny |
| Reactions & pinning | **DONE** | Emoji reactions on messages + pin/unpin |
| Typing indicators & presence | **DONE** | Redis-backed presence, 5-min TTL |
| Image uploads in chat | **DONE** | Up to 4 images/message, Sharp → WebP + thumbnails |
| Watchlist per clan | **DONE** | Tracked instruments |
| Slash commands | **DONE** | /trades, /events, etc. |
| Subscriber-only chat | **NOT STARTED** | Pro-only live chat for followers (requires payments) |

---

### Phase 4 — Leaderboards & Badges (95% DONE)

| Feature | Status | Notes |
|---------|--------|-------|
| Season management | **DONE** | UPCOMING/ACTIVE/COMPLETED/ARCHIVED lifecycle |
| Multi-lens rankings (6 lenses) | **DONE** | Composite, profit, win rate, consistency, risk-adj, low-risk |
| Ranking config panel | **DONE** | Admin can configure weights + min trade thresholds |
| Badge system (rank/perf/trophy) | **DONE** | 3 categories, auto-evaluation, admin CRUD + reorder |
| Badge auto-evaluation | **DONE** | Triggered on milestones, rolling windows, season completion |
| Badge admin (dry-run, recompute) | **DONE** | Test before applying, bulk recompute |
| Season results page | **NOT STARTED** | Final standings, awards, highlights |
| Live ranking movement indicators | **NOT STARTED** | Position change arrows |
| Ranking change notifications | **NOT STARTED** | Push/in-app notifications |

**Note:** The PROJECT_PLAN.md marks badges as not started (outdated). They are fully implemented — 3 badge categories with auto-evaluation, admin dry-run, and recompute. The plan document needs updating.

---

### Phase 5 — Content & Integrity (90% DONE)

| Feature | Status | Notes |
|---------|--------|-------|
| Channel feed & posts | **DONE** | Telegram-style broadcast, reactions, view counts |
| Auto-post from trade cards | **DONE** | High-signal trades auto-posted to channel |
| Discover page + filters | **DONE** | Clans + Free Agents tabs with search/filter |
| Clan activity digest | **DONE** | Per-member trade breakdowns by period |
| Integrity contract (12 loopholes) | **DONE** | Deny-by-default, all 12 critical loopholes fixed |
| EA/MetaTrader bridge (two-way) | **DONE** | Heartbeat, trade-event, calendar, pending actions |
| Feature flags system | **DONE** | Admin toggle for platform features |
| Paywall rules infrastructure | **DONE** | Rules defined, but **NOT enforced** without payments |
| Referral analytics admin | **DONE** | Top referrers, daily stats, event tracking |
| Economic calendar sync | **DONE** | EA sends events, upsert + rate limiting, Socket.io reminders |
| Stories system | **NOT STARTED** | DB model exists (`Story`). No API or UI. |
| Content library (tutorials) | **NOT STARTED** | — |
| Daily peek system (3 free peeks) | **NOT STARTED** | Requires paywall enforcement |

---

### Phase 6 — AI Features (NOT STARTED — 0%)

| Feature | Status | Notes |
|---------|--------|-------|
| AIRouter service (failover chain) | **NOT STARTED** | OpenRouter → Ollama → Cache |
| Local Ollama setup | **NOT STARTED** | Mistral 7B, Llama 3 8B on Iranian AI server |
| Spectator AI chatbot | **NOT STARTED** | 3 free questions/day |
| Clan AI assistant (@ai mention) | **NOT STARTED** | Pro-only in clan chat |
| AI-powered trade analysis | **NOT STARTED** | — |
| Weekly auto-summary generation | **NOT STARTED** | Schedule-based, cheapest model |
| Response caching (Redis) | **NOT STARTED** | 1h TTL cache for AI responses |

**Note:** Chat summaries exist but are **statistics-only** (top instruments, directions, counts) — no LLM-powered content. The `AnalysisCardComposerDialog` exists for **manual** analysis card creation, not AI-generated.

---

### Phase 7 — Payments (NOT STARTED — 0%)

| Feature | Status | Notes |
|---------|--------|-------|
| ZarinPal payment gateway | **NOT STARTED** | No SDK in dependencies, no integration code |
| Subscription checkout flow | **NOT STARTED** | Plans CRUD exists in admin, but no checkout |
| Paywall enforcement (with payment) | **PARTIAL** | Rules infrastructure built, but not enforced at API boundaries |
| Channel subscription marketplace | **NOT STARTED** | Clans set price, 70–80% split |
| Revenue dashboard for clans | **NOT STARTED** | — |
| Billing management page | **NOT STARTED** | — |

**What exists:** `SubscriptionPlan` model and admin CRUD. `PaywallRule` model and admin CRUD. But there is **zero actual payment processing** — no checkout flow, no payment verification, no subscription enforcement.

---

### Phase 8 — Polish & Launch (60% DONE)

| Feature | Status | Notes |
|---------|--------|-------|
| PWA + service worker | **DONE** | Full cache strategies, offline page, LRU eviction |
| E2E test suite (Playwright) | **DONE** | 29 test specs covering all major features |
| Dark mode + theme toggle | **DONE** | next-themes |
| Self-hosted fonts + switching | **DONE** | 3 EN + 5 FA fonts, woff2, persisted preference |
| Display zoom (5 levels) | **DONE** | Zustand persisted |
| Landing page | **DONE** | Hero, features, CTA, stats |
| Gzip compression | **DONE** | Middleware in custom server |
| Admin panel (15 sections) | **DONE** | Dashboard, audit, flags, badges, clans, plans, etc. |
| PM2 process management | **DONE** | Auto-restart, memory limits, log rotation |
| Staging + deploy scripts | **DONE** | Staging port 3001, Redis DB 1, pack→scp→promote |
| Mobile responsive polish | **IN PROGRESS** | Telegram-like layout, bottom nav, overflow fixes |
| Onboarding flow | **IN PROGRESS** | Intent modal done, missions checklist partial, no guided tour |
| SMTP config for production | **TODO** | Code ready, need credentials |
| Kavenegar API key for prod | **TODO** | Code ready, need API key |
| Performance optimization | **TODO** | Lazy loading, image compression, query optimization |
| Security audit (OWASP) | **TODO** | Input sanitization, rate limiting review |
| Deployment checklist & docs | **TODO** | — |
| SEO (OG tags, sitemap) | **NOT STARTED** | Basic metadata only |
| Error monitoring (GlitchTip) | **NOT STARTED** | Self-hosted Sentry alternative |
| CI/CD (GitHub Actions) | **NOT STARTED** | lint + type-check + build on push |
| Structured logging (Pino) | **NOT STARTED** | Currently 150+ console.log calls |
| Uptime monitoring | **NOT STARTED** | Cron health check + Telegram alerts |
| Arabic language support | **NOT STARTED** | RTL infrastructure ready, need ar.json |
| Blackout resilience test | **NOT STARTED** | Block international traffic, verify all features |

---

## 4. Technical Inventory (What Exists)

| Metric | Count |
|--------|-------|
| Database models (Prisma) | **30+** |
| API routes | **110+** |
| React components | **100+** |
| Pages (routes) | **48** |
| Service modules | **36** |
| Zustand stores | **9** |
| E2E test specs | **29** |
| i18n translation sections | **31** |
| Socket.io events (client + server) | **33** |
| Background intervals | **2** (trade evaluator 60s, event reminders 30s) |
| Dependencies | **59** |

---

## 5. What's Required for MVP Launch

### Minimum Viable Product (Phases 1–5 + P8 essentials)

The core product loop is: **Sign up → Join/create clan → Chat → Share verified trades → Compete on leaderboard → Earn badges**

This loop is **fully functional** today. What's needed for a real launch:

#### Must-Have (Launch Blockers)
1. **Kavenegar API key** — Without this, no one can sign up via phone (the primary auth method for Iranian users)
2. **SMTP credentials** — Email verification and password reset don't work in production without this
3. **Security audit** — OWASP top-10 review before real users touch it
4. **Mobile responsive polish** — Currently in progress, critical for Iranian market (mostly mobile users)
5. **Performance optimization** — Lazy loading, query optimization for scale

#### Should-Have (Week 1–2 post-launch)
6. **Onboarding flow** — New users need guidance; intent modal exists but missions/tour missing
7. **SEO** — OG images, sitemap, robots.txt for organic growth
8. **Error monitoring** — GlitchTip (self-hosted Sentry) to catch production issues
9. **CI/CD pipeline** — Automated lint + build checks to prevent broken deploys

#### Nice-to-Have (Can wait)
10. **Structured logging** — Replace console.log with Pino for debugging
11. **Uptime monitoring** — Automated health checks
12. **Arabic language** — Infrastructure ready, just needs translation file
13. **Blackout resilience test** — Important for marketing, can do after initial launch

### NOT required for MVP
- **Phase 6 (AI)** — Pure enhancement, platform works fine without it
- **Phase 7 (Payments)** — Can launch as free platform, add monetization later
- **Stories system** — Nice-to-have content feature
- **Myfxbook integration** — Optional verification enhancement
- **Season results page** — Can display manually or add later

---

## 6. Known Gaps Between Documentation and Reality

The `PROJECT_PLAN.md` has some outdated information:

| Claim in Plan | Reality |
|---------------|---------|
| "26 database models" | Actually **30+** models |
| "67 API routes" | Actually **110+** routes |
| "95 React components" | Actually **100+** components |
| "20 service modules" | Actually **36** services |
| "5 Zustand stores" | Actually **9** stores |
| P4 badges marked ⬜ | **Fully implemented** with auto-eval, dry-run, recompute |
| P5 marked ✅ COMPLETE | Missing: stories, content library, daily peeks |
| P8 mobile marked ✅ | Actually **IN PROGRESS** |

---

## 7. Risk Assessment

### High Risk
- **No payment infrastructure** — Cannot monetize. Phase 7 entirely unbuilt.
- **No production SMS/Email** — Users literally cannot sign up without Kavenegar + SMTP configured.
- **No error monitoring** — Production bugs will go undetected.
- **No CI/CD** — Manual deploys increase risk of broken production.

### Medium Risk
- **Console logging everywhere** — 150+ console.log calls make debugging difficult at scale.
- **No security audit** — Could have vulnerabilities (though integrity contract addresses trade fraud).
- **Single developer** — Bus factor of 1.

### Low Risk
- **No AI features** — Product works without them. Pure enhancement.
- **No stories** — Social feature, not core loop.
- **No Arabic** — Persian + English covers primary market.

---

## 8. Recommended Priority Order

If starting fresh with a PM, here's the suggested order:

1. **Get Kavenegar API key + SMTP credentials** (unblocks real user signups)
2. **Finish mobile responsive polish** (Iranian users are mobile-first)
3. **Security audit** (before any real users)
4. **Onboarding flow** (reduce new user drop-off)
5. **CI/CD pipeline** (prevent broken deploys)
6. **Error monitoring** (catch issues before users report them)
7. **Phase 7: Payments** (monetization — start with ZarinPal + basic checkout)
8. **Performance optimization** (as user count grows)
9. **Phase 6: AI** (enhancement layer, not critical)
10. **Stories, content library, season results** (engagement features)

---

## 9. Architecture Highlights

- **Iranian-first**: All core features run on Iranian servers within NIN. No international API dependencies at runtime.
- **Dual-server**: US dev server (always online) + Iranian production (blackout-resilient).
- **Real-time**: Socket.io handles chat, trade updates, presence, typing indicators, event reminders.
- **Trade integrity**: Deny-by-default system with 12 identified loopholes all fixed.
- **EA bridge**: Two-way MetaTrader integration (heartbeat, trade events, calendar, pending actions).
- **Deployment**: SSH/rsync push-only. Iranian server never pulls from GitHub.

---

*Report generated from full codebase audit of 30+ Prisma models, 110+ API routes, 100+ components, 36 services, 29 E2E test specs, and cross-referenced with PROJECT_PLAN.md, PRODUCTION-PLAN.md, PITCH.md, TESTING-CHECKLIST.md, and INTEGRITY-CONTRACT-CHECKLIST.md.*
