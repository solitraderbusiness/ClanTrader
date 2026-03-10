> **ARCHIVED** — Full project audit report (P1–P8). Point-in-time snapshot.
> See [docs/MVP.md](../MVP.md) for current status and launch scope.
> Last Verified: 2026-03-10 | Status: Archived

---

# ClanTrader — Project Report for PM

> **Generated**: 2026-03-04
>
> This document lists every feature/task in the ClanTrader project, grouped by phase.
> Each entry includes its current status, what it does, and what action is needed to complete it.

---

## Executive Summary

| | Count | % |
|---|---|---|
| **Total tasks** | 205 | 100% |
| Done | 57 | 28% |
| In Testing | 8 | 4% |
| In Progress | 2 | 1% |
| To Do | 52 | 25% |
| Backlog | 86 | 42% |
| **Open Launch Blockers** | **16** | |

### Remaining Effort Estimate

Based on 58 tasks that have hour estimates (excludes completed tasks):

| Scenario | Hours |
|---|---|
| Best case | 61h |
| Likely | 89h |
| Worst case | 127h |

*Note: 90 remaining tasks do not yet have estimates.*

---

## Phase Overview

| Phase | Name | Total | Done | Remaining | Progress |
|---|---|---|---|---|---|
| P1 | Authentication & Identity | 12 | 9 | 3 | ████████░░ 75% |
| P2 | Trader Statements | 8 | 8 | 0 | ██████████ 100% |
| P3 | Clans & Real-Time Chat | 11 | 11 | 0 | ██████████ 100% |
| P4 | Leaderboards & Seasons | 7 | 6 | 1 | █████████░ 86% |
| P5 | Integrity & Content | 14 | 13 | 1 | █████████░ 93% |
| P6 | AI Features | 7 | 0 | 7 | ░░░░░░░░░░ 0% |
| P7 | Monetization & Payments | 7 | 0 | 7 | ░░░░░░░░░░ 0% |
| P8 | QA, Ops & Launch | 80 | 10 | 70 | █░░░░░░░░░ 13% |
| P9 | Stabilization & Alpha | 20 | 0 | 20 | ░░░░░░░░░░ 0% |
| P10 | Market Data Pipeline | 7 | 0 | 7 | ░░░░░░░░░░ 0% |
| P11 | News Aggregation | 10 | 0 | 10 | ░░░░░░░░░░ 0% |
| P12 | AI Copilot & Briefings | 5 | 0 | 5 | ░░░░░░░░░░ 0% |
| P13 | Vibe Trading | 6 | 0 | 6 | ░░░░░░░░░░ 0% |
| P14 | Paper Portfolio | 3 | 0 | 3 | ░░░░░░░░░░ 0% |
| P15 | Coaching & Alerts | 4 | 0 | 4 | ░░░░░░░░░░ 0% |
| P16 | Execution Bridge | 4 | 0 | 4 | ░░░░░░░░░░ 0% |

---

## Launch Blockers (Must Complete Before Go-Live)

These 16 tasks are flagged as **launch blockers** — the platform cannot go live until they are resolved.

| # | Phase | Status | Priority | Task | Action Needed |
|---|---|---|---|---|---|
| 1 | P1 | IN TESTING | CRITICAL | **Phone OTP signup/login (Kavenegar)** | Code complete. Needs manual QA verification before marking done. |
| 2 | P1 | IN TESTING | CRITICAL | **Email verification flow** | Code complete. Needs manual QA verification before marking done. |
| 3 | P8 | BACKLOG | CRITICAL | **Error monitoring (GlitchTip/Sentry)** | Self-hosted Sentry alternative. No international API dependency. Not yet implemented. |
| 4 | P8 | BACKLOG | CRITICAL | **Automated database backups** | No automated pg_dump script or cron job. Only manual snapshots during deployment. |
| 5 | P8 | BACKLOG | CRITICAL | **Health check API endpoint** | No /api/health endpoint exists. Deployment scripts use homepage HTTP check only. |
| 6 | P8 | BACKLOG | CRITICAL | **Security audit (OWASP top 10)** | No formal security audit conducted. Input validation via Zod exists. Auth checks on admin routes exist. |
| 7 | P8 | IN PROGRESS | HIGH | **Mobile responsive polish** | Currently being worked on. Finish implementation and move to testing. |
| 8 | P9 | BACKLOG | CRITICAL | **Automated PostgreSQL backups** | pg_dump cron job with 7-day retention + test restore drill. |
| 9 | P9 | BACKLOG | CRITICAL | **Self-hosted error tracking (GlitchTip)** | Deploy GlitchTip on dev/prod for production error capture, alerting, and dashboard. No external SaaS dependency. |
| 10 | P9 | BACKLOG | CRITICAL | **Rate limiting on all public routes** | Rate limiting on login, signup, reset, and all public API routes. Extends existing OTP + chat rate limits. |
| 11 | P9 | BACKLOG | CRITICAL | **Iran VPS setup** | Iran VPS setup: PostgreSQL, Redis, Node.js, nginx, SSL certificate. Production-ready server configuration. |
| 12 | P9 | BACKLOG | CRITICAL | **Kavenegar OTP on Iran prod** | Kavenegar OTP configured and tested on Iran staging + production servers. |
| 13 | P9 | BACKLOG | CRITICAL | **SMTP for production email** | SMTP configured for production email verification and password reset flows. |
| 14 | P9 | BACKLOG | CRITICAL | **Deploy pipeline to Iran end-to-end** | Run deploy pipeline to Iran (staging then prod) end-to-end and verify all services work. |
| 15 | P9 | BACKLOG | CRITICAL | **Mobile audit** | Mobile audit: fix horizontal scroll, touch targets, keyboard overlap across all critical flows. |
| 16 | P10 | BACKLOG | CRITICAL | **OpenRouter client wrapper** | OpenRouter client wrapper with retries, rate limits, prompt versioning, and LLMRunRecord table for cost/latency tracking. |

---

## Detailed Feature List by Phase

---

### P1 — Authentication & Identity

**Progress**: 9/12 tasks done (75%)

#### 1. Phone OTP signup/login (Kavenegar) (`auth.phone-otp`)

- **Status**: IN TESTING `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PRODUCT_CORE*
- **What it is**: Phone-first auth via SMS OTP using Kavenegar API. Console fallback in dev. 3 OTP/10min rate limit. Redis-backed OTP storage with 5-min expiry.
- **To complete**: Code complete. Needs manual QA verification before marking done.

#### 2. Email verification flow (`auth.email-verification`)

- **Status**: IN TESTING `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PRODUCT_CORE*
- **What it is**: Nodemailer sends verification email with 24h token. Needs SMTP credentials for production.
- **To complete**: Code complete. Needs manual QA verification before marking done.

#### 3. Password reset flow (`auth.password-reset`)

- **Status**: IN TESTING
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Forgot password generates 1h expiring token. Reset endpoint validates and updates password. Requires SMTP.
- **To complete**: Code complete. Needs manual QA verification before marking done.

#### 4. Username system + availability check (`auth.username`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Real-time debounced (500ms) availability check. Unique constraint at DB. Reserved username list.

#### 5. EA/MetaTrader auth (register + login) (`auth.ea-mt`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Username+password auth for MetaTrader EA. API key generation. One-time use login tokens via Redis.

#### 6. Phone OTP authentication

- **Status**: DONE
- **Priority**: HIGH

#### 7. Email + password auth (`auth.email-password`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*

#### 8. JWT sessions (Auth.js v5) (`auth.jwt-sessions`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*

#### 9. Referral tracking on signup (`auth.referral-tracking`)

- **Status**: DONE
- **Priority**: NORMAL — *MONETIZATION_GROWTH*
- **What it is**: Fire-and-forget event tracking: LINK_COPIED, LINK_SHARED, SIGNUP, SUBSCRIPTION. Admin analytics dashboard.

#### 10. User profiles & avatars (`auth.profiles`)

- **Status**: DONE
- **Priority**: NORMAL — *PRODUCT_CORE*

#### 11. Username system

- **Status**: DONE
- **Priority**: NORMAL

#### 12. i18n + RTL support (en/fa) (`auth.i18n-rtl`)

- **Status**: DONE
- **Priority**: NORMAL — *PRODUCT_CORE*

---

### P2 — Trader Statements

**Progress**: 8/8 tasks done (100%)

#### 1. Statement upload + HTML parsing (`statements.upload`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Upload MT4/MT5 HTML statement files. Cheerio parser extracts: totalNetProfit, grossProfit/Loss, profitFactor, winRate, maxDrawdown. Stored as JSONB.

#### 2. Admin statement review/approval (`statements.admin-review`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Admin dashboard to review uploaded statements: view original HTML, approve/reject with notes. Status: PENDING/VERIFIED/REJECTED/EXPIRED.

#### 3. Auto-recalculate trader statements (`statements.auto-recalc`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: statement-calc.service.ts recalculates TraderStatements on trade close. Monthly, seasonal, all-time aggregation. Admin can force recalculation.

#### 4. Statement upload flow

- **Status**: DONE
- **Priority**: HIGH

#### 5. HTML statement parsing

- **Status**: DONE
- **Priority**: HIGH

#### 6. Admin statement review

- **Status**: DONE
- **Priority**: NORMAL

#### 7. MT account linking (`statements.mt-linking`)

- **Status**: DONE
- **Priority**: NORMAL — *PRODUCT_CORE*

#### 8. Auto-recalculate on close

- **Status**: DONE
- **Priority**: NORMAL

---

### P3 — Clans & Real-Time Chat

**Progress**: 11/11 tasks done (100%)

#### 1. Trade tracking & lifecycle (`clans.trade-lifecycle`)

- **Status**: DONE
- **Priority**: CRITICAL — *PRODUCT_CORE*
- **What it is**: Trade lifecycle: PENDING → OPEN → TP_HIT/SL_HIT/BE/CLOSED. Full status history with TradeEvent audit. Actions: SET_BE, MOVE_SL, CHANGE_TP, CLOSE.

#### 2. Join requests + invite codes (`clans.join-invites`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Join requests (PENDING/APPROVED/REJECTED) for private clans. Invite codes with expiry, maxUses, uses tracking.

#### 3. Reactions, pinning, images, typing, presence (`clans.reactions-pins`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Emoji reactions on messages. Pin/unpin messages. Image uploads (up to 4, Sharp → WebP). Typing indicators via Socket.io. Redis presence (5min TTL).

#### 4. Clan CRUD + settings (`clans.crud`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*

#### 5. Real-time chat (Socket.io) (`clans.chat`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*

#### 6. Signal & analysis trade cards (`clans.trade-cards`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*

#### 7. Trade tracking & status

- **Status**: DONE
- **Priority**: HIGH

#### 8. Chat topics & threading (`clans.topics`)

- **Status**: DONE
- **Priority**: NORMAL — *PRODUCT_CORE*

#### 9. Trade actions (SL/TP/BE/close)

- **Status**: DONE
- **Priority**: NORMAL

#### 10. Direct messages (`clans.dms`)

- **Status**: DONE
- **Priority**: NORMAL — *PRODUCT_CORE*

#### 11. Join requests + invites

- **Status**: DONE
- **Priority**: NORMAL

---

### P4 — Leaderboards & Seasons

**Progress**: 6/7 tasks done (86%)

#### 1. Multi-lens rankings (6 lenses) (`leaderboard.rankings`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Composite, profitFactor, winRate, consistency, riskAdjusted, lowRisk. Configurable weights. Min trade threshold.

#### 2. Season management (`leaderboard.seasons`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*

#### 3. Multi-lens rankings

- **Status**: DONE
- **Priority**: HIGH

#### 4. Season results page (`leaderboard.season-results`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *PRODUCT_CORE*
- **What it is**: Final standings, awards, highlights after season ends. Not yet implemented.
- **To complete**: Final standings, awards, highlights after season ends. Not yet implemented.

#### 5. Ranking config panel

- **Status**: DONE
- **Priority**: NORMAL

#### 6. Badge system (rank/perf/trophy) (`leaderboard.badges`)

- **Status**: DONE
- **Priority**: NORMAL — *PRODUCT_CORE*

#### 7. Auto badge evaluation

- **Status**: DONE
- **Priority**: NORMAL

---

### P5 — Integrity & Content

**Progress**: 13/14 tasks done (93%)

#### 1. Integrity contract (deny-by-default) (`integrity.contract`)

- **Status**: DONE `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *TRUST_INTEGRITY*
- **What it is**: 6-condition eligibility check: MT-linked, integrityStatus, resolutionSource, card-before-trade timing, initial SL snapshot, no duplicate MT ticket. 12+ loopholes identified and fixed.

#### 2. EA/MetaTrader bridge (two-way) (`integrity.ea-bridge`)

- **Status**: DONE
- **Priority**: CRITICAL — *TRUST_INTEGRITY*
- **What it is**: EA→Server: heartbeat, trade-event, calendar. Server→EA: pending actions queue. Rate limiting on calendar sync. Action results tracking.

#### 3. Follow system (`content.follow`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Follow model: followerId, followingType (USER/CLAN), followingId. Follow/unfollow with counts.

#### 4. Economic calendar sync + event reminders (`content.calendar`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: MT5 EA sends calendar events. Upsert with externalId+source uniqueness. Rate limiting (5-min window). Socket.io event reminders at 1h and 1min before.

#### 5. Admin override governance (`integrity.admin-override`)

- **Status**: DONE
- **Priority**: HIGH — *TRUST_INTEGRITY*
- **What it is**: Admin can manually override trade eligibility. All overrides logged in TradeEvent with MANUAL_OVERRIDE reason. API returns 422 for ineligible trades.

#### 6. Trade integrity evaluator (background) (`integrity.evaluator`)

- **Status**: DONE
- **Priority**: HIGH — *TRUST_INTEGRITY*
- **What it is**: Background job every 60s evaluating all pending trades. Feature-flag gated (trade_integrity_evaluator). Returns evaluated count, status changes, errors.

#### 7. Feature flags system (`integrity.feature-flags`)

- **Status**: DONE
- **Priority**: HIGH — *TRUST_INTEGRITY*
- **What it is**: FeatureFlag model with Redis caching (60s TTL). Admin CRUD. 2 runtime-gated features: auto_post, trade_integrity_evaluator.

#### 8. Channel feed & posts (`content.channel-feed`)

- **Status**: DONE
- **Priority**: HIGH — *PRODUCT_CORE*

#### 9. Integrity contract system

- **Status**: DONE
- **Priority**: HIGH

#### 10. EA/MetaTrader bridge

- **Status**: DONE
- **Priority**: HIGH

#### 11. Stories system (`content.stories`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *PRODUCT_CORE*
- **What it is**: DB model exists (Story: userId, imageUrl, expiresAt). No API routes or UI built. Ephemeral 24h content.
- **To complete**: DB model exists (Story: userId, imageUrl, expiresAt). No API routes or UI built. Ephemeral 24h content.

#### 12. Auto-post from trade cards (`content.auto-post`)

- **Status**: DONE
- **Priority**: NORMAL — *PRODUCT_CORE*

#### 13. Discover page + filters (`content.discover`)

- **Status**: DONE
- **Priority**: NORMAL — *PRODUCT_CORE*

#### 14. Clan activity digest

- **Status**: DONE
- **Priority**: NORMAL

---

### P6 — AI Features

**Progress**: 0/7 tasks done (0%)

#### 1. AI router service

- **Status**: BACKLOG
- **Priority**: HIGH
- **What it is**: AI-powered routing service that analyzes clan chat messages and routes them to relevant channels/topics. Uses Claude API to categorize and summarize trading discussions.
- **To complete**: AI-powered routing service that analyzes clan chat messages and routes them to relevant channels/topics. Uses Claude API to categorize and summarize trading discussions.

#### 2. AIRouter service (failover chain) (`ai.router`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *PRODUCT_CORE*
- **What it is**: OpenRouter → Ollama → Cache. 3s timeout, health checks, admin force-local toggle. Not implemented.
- **To complete**: OpenRouter → Ollama → Cache. 3s timeout, health checks, admin force-local toggle. Not implemented.

#### 3. Spectator AI chatbot (`ai.chatbot`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *PRODUCT_CORE*
- **What it is**: 3 free questions/day for non-pro users. System prompt with DB query access. Not implemented.
- **To complete**: 3 free questions/day for non-pro users. System prompt with DB query access. Not implemented.

#### 4. Clan AI assistant (@ai mention) (`ai.clan-assistant`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *PRODUCT_CORE*
- **What it is**: Pro-only AI assistant in clan chat. @ai trigger. Clan context injected. Not implemented.
- **To complete**: Pro-only AI assistant in clan chat. @ai trigger. Clan context injected. Not implemented.

#### 5. Chat summary generation

- **Status**: BACKLOG
- **Priority**: NORMAL
- **What it is**: Auto-generate daily/weekly summaries of clan chat activity using AI. Show key trading discussions, popular signals, and notable results.
- **To complete**: Auto-generate daily/weekly summaries of clan chat activity using AI. Show key trading discussions, popular signals, and notable results.

#### 6. Trade analysis cards (AI)

- **Status**: BACKLOG
- **Priority**: NORMAL
- **What it is**: AI-generated analysis cards for trade signals — entry reasoning, risk assessment, market context. Displayed alongside manual trade cards in the clan feed.
- **To complete**: AI-generated analysis cards for trade signals — entry reasoning, risk assessment, market context. Displayed alongside manual trade cards in the clan feed.

#### 7. Trader insight reports

- **Status**: BACKLOG
- **Priority**: LOW
- **What it is**: AI-generated weekly/monthly performance reports for each trader. Win/loss analysis, pattern recognition, improvement suggestions. Viewable on profile.
- **To complete**: AI-generated weekly/monthly performance reports for each trader. Win/loss analysis, pattern recognition, improvement suggestions. Viewable on profile.

---

### P7 — Monetization & Payments

**Progress**: 0/7 tasks done (0%)

#### 1. Subscription checkout flow (`monetization.subscriptions`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MONETIZATION_GROWTH*
- **What it is**: SubscriptionPlan model + admin CRUD exists. No checkout flow, no payment verification, no subscription enforcement.
- **To complete**: SubscriptionPlan model + admin CRUD exists. No checkout flow, no payment verification, no subscription enforcement.

#### 2. ZarinPal payment gateway (`monetization.zarinpal`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MONETIZATION_GROWTH*
- **What it is**: Integrate ZarinPal Iranian payment gateway for subscription purchases. Handle payment flow: create payment → redirect to ZarinPal → verify callback → activate subscription.
- **To complete**: Integrate ZarinPal Iranian payment gateway for subscription purchases. Handle payment flow: create payment → redirect to ZarinPal → verify callback → activate subscription.

#### 3. Subscription management

- **Status**: BACKLOG
- **Priority**: HIGH
- **What it is**: Manage user subscription tiers (Free, Pro, Premium). Track subscription status, renewal dates, feature access levels. Admin panel for plan management.
- **To complete**: Manage user subscription tiers (Free, Pro, Premium). Track subscription status, renewal dates, feature access levels. Admin panel for plan management.

#### 4. Channel subscription marketplace (`monetization.channel-marketplace`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MONETIZATION_GROWTH*
- **What it is**: Clans set price, 70-80% split. Browse, preview, subscribe. Not implemented.
- **To complete**: Clans set price, 70-80% split. Browse, preview, subscribe. Not implemented.

#### 5. Paywall enforcement (`monetization.paywall`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MONETIZATION_GROWTH*
- **What it is**: Enforce feature restrictions based on subscription tier. Gate premium features (advanced analytics, AI insights, multiple clans) behind paywall. Show upgrade prompts.
- **To complete**: Enforce feature restrictions based on subscription tier. Gate premium features (advanced analytics, AI insights, multiple clans) behind paywall. Show upgrade prompts.

#### 6. Referral reward system

- **Status**: BACKLOG
- **Priority**: NORMAL
- **What it is**: Track referral codes and reward users who invite new traders. Count signups per referral, award badges/credits. Admin dashboard for referral analytics.
- **To complete**: Track referral codes and reward users who invite new traders. Count signups per referral, award badges/credits. Admin dashboard for referral analytics.

#### 7. Invoice generation

- **Status**: BACKLOG
- **Priority**: LOW
- **What it is**: Generate PDF invoices for subscription payments. Include plan details, payment date, amount, tax info. Downloadable from user settings.
- **To complete**: Generate PDF invoices for subscription payments. Include plan details, payment date, amount, tax info. Downloadable from user settings.

---

### P8 — QA, Ops & Launch

**Progress**: 10/80 tasks done (13%)

#### 1. Deploy pipeline (US build → Iran deploy) (`ops.deploy-scripts`)

- **Status**: DONE
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **What it is**: 3 bash scripts: deploy-pack.sh (tarball on US), deploy-staging.sh (to staging), promote-to-prod.sh (with backup + auto-rollback + health check).

#### 2. PM2 process management (`ops.pm2`)

- **Status**: DONE
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **What it is**: ecosystem.config.cjs with auto-restart, 1GB memory limit, log rotation. Custom HTTP server wraps Next.js + Socket.io.

#### 3. Error monitoring (GlitchTip/Sentry) (`ops.monitoring`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **What it is**: Self-hosted Sentry alternative. No international API dependency. Not yet implemented.
- **To complete**: Self-hosted Sentry alternative. No international API dependency. Not yet implemented.

#### 4. Automated database backups (`ops.backups`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **What it is**: No automated pg_dump script or cron job. Only manual snapshots during deployment.
- **To complete**: No automated pg_dump script or cron job. Only manual snapshots during deployment.

#### 5. Health check API endpoint (`ops.health-endpoint`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **What it is**: No /api/health endpoint exists. Deployment scripts use homepage HTTP check only.
- **To complete**: No /api/health endpoint exists. Deployment scripts use homepage HTTP check only.

#### 6. Security audit (OWASP top 10) (`ops.security-audit`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **What it is**: No formal security audit conducted. Input validation via Zod exists. Auth checks on admin routes exist.
- **To complete**: No formal security audit conducted. Input validation via Zod exists. Auth checks on admin routes exist.

#### 7. Fix critical bugs from QA (day 1)

- **Status**: TO DO
- **Priority**: CRITICAL
- **What it is**: Triage QA results. Fix all CRITICAL and HIGH bugs found during the 6-day QA sprint. Focus on auth and data integrity first.
- **To complete**: Triage QA results. Fix all CRITICAL and HIGH bugs found during the 6-day QA sprint. Focus on auth and data integrity first.

#### 8. Fix critical bugs from QA (day 2)

- **Status**: TO DO
- **Priority**: CRITICAL
- **What it is**: Continue fixing HIGH priority bugs. Focus on chat, trade cards, and real-time features.
- **To complete**: Continue fixing HIGH priority bugs. Focus on chat, trade cards, and real-time features.

#### 9. Promote staging to production

- **Status**: TO DO
- **Priority**: CRITICAL
- **What it is**: Run promote-to-prod.sh. Verify prod is fully functional. Check SMTP, Kavenegar, Socket.io, Redis, PM2 all healthy.
- **To complete**: Run promote-to-prod.sh. Verify prod is fully functional. Check SMTP, Kavenegar, Socket.io, Redis, PM2 all healthy.

#### 10. Soft launch — open to public

- **Status**: TO DO
- **Priority**: CRITICAL
- **What it is**: Remove invite-only restriction. Share on social media / trading communities. Monitor closely for first 24h.
- **To complete**: Remove invite-only restriction. Share on social media / trading communities. Monitor closely for first 24h.

#### 11. Staging environment (`ops.staging`)

- **Status**: DONE
- **Priority**: HIGH — *PLATFORM_OPS*
- **What it is**: Staging on port 3001, Redis DB 1. Separate .env. Health checks before promotion.

#### 12. CI/CD pipeline (GitHub Actions) (`ops.cicd`)

- **Status**: BACKLOG
- **Priority**: HIGH — *PLATFORM_OPS*
- **What it is**: Lint + type-check + build on push. No GitHub Actions workflows exist.
- **To complete**: Lint + type-check + build on push. No GitHub Actions workflows exist.

#### 13. Uptime monitoring + Telegram alerts (`ops.uptime`)

- **Status**: BACKLOG
- **Priority**: HIGH — *PLATFORM_OPS*
- **What it is**: Cron health check script with Telegram bot notifications. Not implemented.
- **To complete**: Cron health check script with Telegram bot notifications. Not implemented.

#### 14. Rate limiting coverage (`ops.rate-limiting`)

- **Status**: IN TESTING
- **Priority**: HIGH — *PLATFORM_OPS*
- **What it is**: Currently: OTP (3/10min), chat (5/60s), EA heartbeat. Missing: API routes, auth endpoints, image uploads, admin actions.
- **To complete**: Code complete. Needs manual QA verification before marking done.

#### 15. PWA + service worker + offline (`ops.pwa`)

- **Status**: DONE
- **Priority**: HIGH — *PLATFORM_OPS*
- **What it is**: Full service worker with cache strategies. Offline page. LRU eviction. Install prompts.

#### 16. Onboarding flow (intent + missions) (`ops.onboarding`)

- **Status**: IN TESTING
- **Priority**: HIGH — *PRODUCT_CORE*
- **What it is**: Intent modal (4 options: LEARN/COMPETE/SHARE/RECRUIT) done. Missions dashboard exists. No guided tour.
- **To complete**: Code complete. Needs manual QA verification before marking done.

#### 17. Landing page + marketing (`monetization.landing`)

- **Status**: DONE
- **Priority**: HIGH — *MONETIZATION_GROWTH*
- **What it is**: Landing page with hero, features, stats, CTA sections. Self-hosted.

#### 18. Blackout resilience test (`ops.blackout-test`)

- **Status**: BACKLOG
- **Priority**: HIGH — *PLATFORM_OPS*
- **What it is**: Block international traffic on production. Verify all features work on NIN-only. Not tested.
- **To complete**: Block international traffic on production. Verify all features work on NIN-only. Not tested.

#### 19. PWA manifest + service worker

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Make the app installable as a PWA. Configure manifest.webmanifest, add service worker for offline support, cache critical assets. Show install prompt on mobile.
- **To complete**: Make the app installable as a PWA. Configure manifest.webmanifest, add service worker for offline support, cache critical assets. Show install prompt on mobile.

#### 20. Mobile responsive polish (`ops.mobile-responsive`)

- **Status**: IN PROGRESS `LAUNCH BLOCKER`
- **Priority**: HIGH — *PLATFORM_OPS*
- **What it is**: Polish all pages for mobile viewports (< 768px). Fix layout issues, touch targets, overflow, bottom nav spacing. Test on iPhone SE, iPhone 14, and Android sizes.
- **To complete**: Currently being worked on. Finish implementation and move to testing.

#### 21. Security audit (OWASP)

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Full OWASP Top 10 security review. Check: XSS, CSRF, SQL injection, auth bypass, IDOR, rate limiting, input validation, file upload safety across all API routes.
- **To complete**: Full OWASP Top 10 security review. Check: XSS, CSRF, SQL injection, auth bypass, IDOR, rate limiting, input validation, file upload safety across all API routes.

#### 22. Set up SMTP for production email

- **Status**: DONE
- **Priority**: HIGH
- **What it is**: Configure SMTP_HOST/PORT/USER/PASS env vars on dev server. Test email verification + password reset flows.

#### 23. Get Kavenegar API key for production

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Register Kavenegar account, get API key, set KAVENEGAR_API_KEY on prod. Test live SMS OTP.
- **To complete**: Register Kavenegar account, get API key, set KAVENEGAR_API_KEY on prod. Test live SMS OTP.

#### 24. Deploy latest build to staging

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Run deploy-pack.sh, scp to prod server, run deploy-staging.sh. Verify staging is fully functional.
- **To complete**: Run deploy-pack.sh, scp to prod server, run deploy-staging.sh. Verify staging is fully functional.

#### 25. QA: Phone OTP signup & login

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §1.1 — Send OTP, rate limiting, correct/wrong OTP, expiry, login with existing phone, session persistence, sign out.
- **To complete**: Test §1.1 — Send OTP, rate limiting, correct/wrong OTP, expiry, login with existing phone, session persistence, sign out.

#### 26. QA: Email + password auth

- **Status**: IN TESTING
- **Priority**: HIGH
- **What it is**: Test §1.2 — Add email+password from settings, login, forgot password, reset with valid/expired link.
- **To complete**: Code complete. Needs manual QA verification before marking done.

#### 27. QA: Desktop & mobile navigation

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §2.1 + §2.2 — Sidebar items, admin link, hamburger menu, mobile nav bar, no horizontal scroll.
- **To complete**: Test §2.1 + §2.2 — Sidebar items, admin link, hamburger menu, mobile nav bar, no horizontal scroll.

#### 28. QA: Top bar & RTL/LTR

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §2.3 + §2.4 — MT status, language switch, theme toggle, invite button, RTL flip in FA/AR.
- **To complete**: Test §2.3 + §2.4 — MT status, language switch, theme toggle, invite button, RTL flip in FA/AR.

#### 29. QA: Create clan + discover/join

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §5.1 + §5.2 — Create with name/desc/focus, toggle public/private, avatar. Explore page search/filter, join/follow, request to join private.
- **To complete**: Test §5.1 + §5.2 — Create with name/desc/focus, toggle public/private, avatar. Explore page search/filter, join/follow, request to join private.

#### 30. QA: Clan profile page (all tabs)

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §5.3 — Header info, follow/join/leave buttons, Channel tab posts, Chat tab, Members tab, Performance tab, Statements tab.
- **To complete**: Test §5.3 — Header info, follow/join/leave buttons, Channel tab posts, Chat tab, Members tab, Performance tab, Statements tab.

#### 31. QA: Clan settings & management

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §5.4 — Edit name/desc/avatar/focus, toggle access, invite links, approve/reject requests, promote/demote/remove/ban, delete clan.
- **To complete**: Test §5.4 — Edit name/desc/avatar/focus, toggle access, invite links, approve/reject requests, promote/demote/remove/ban, delete clan.

#### 32. QA: Real-time clan chat

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §6.1 + §6.2 — Send/receive messages real-time, edit/delete, reply, 2000 char limit, rate limiting, image attachments (1-4).
- **To complete**: Test §6.1 + §6.2 — Send/receive messages real-time, edit/delete, reply, 2000 char limit, rate limiting, image attachments (1-4).

#### 33. QA: Signal & analysis trade cards

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §7.1 + §7.2 — Open composer, fill fields, submit signal card, live R:R, risk badge. Analysis cards excluded from statements.
- **To complete**: Test §7.1 + §7.2 — Open composer, fill fields, submit signal card, live R:R, risk badge. Analysis cards excluded from statements.

#### 34. QA: Trade actions & status lifecycle

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §7.3 + §7.4 + §7.5 — Track/edit/delete trade, set BE, move SL, change TP, close trade, system messages, MT-linked actions, pending expiry, status flow.
- **To complete**: Test §7.3 + §7.4 + §7.5 — Track/edit/delete trade, set BE, move SL, change TP, close trade, system messages, MT-linked actions, pending expiry, status flow.

#### 35. QA: Direct messages

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §8.1 + §8.2 + §8.3 — DM list, last message preview, unread badge, send/receive real-time, edit/delete/reply, read receipts, typing.
- **To complete**: Test §8.1 + §8.2 + §8.3 — DM list, last message preview, unread badge, send/receive real-time, edit/delete/reply, read receipts, typing.

#### 36. QA: Admin panel (full)

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §16 — Dashboard stats, audit logs with filters/search/pagination/live mode, impersonation, feature flags, paywall rules, plans, badges admin, referrals, statements review.
- **To complete**: Test §16 — Dashboard stats, audit logs with filters/search/pagination/live mode, impersonation, feature flags, paywall rules, plans, badges admin, referrals, statements review.

#### 37. QA: PWA, invite, cross-cutting

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Test §17 + §18 + §19 — PWA install, offline page, reconnection. Invite link sharing. Light/dark theme, FA/EN labels, 150% display size, responsive breakpoints, error/loading states, image uploads.
- **To complete**: Test §17 + §18 + §19 — PWA install, offline page, reconnection. Invite link sharing. Light/dark theme, FA/EN labels, 150% display size, responsive breakpoints, error/loading states, image uploads.

#### 38. Fix remaining QA bugs + regression test

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Fix NORMAL priority bugs. Re-test all previously failed items. Ensure no regressions from fixes.
- **To complete**: Fix NORMAL priority bugs. Re-test all previously failed items. Ensure no regressions from fixes.

#### 39. Security audit (OWASP Top 10)

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Check XSS, CSRF, SQL injection, auth bypass, IDOR, rate limiting, input validation across all API routes. Use security-reviewer agent.
- **To complete**: Check XSS, CSRF, SQL injection, auth bypass, IDOR, rate limiting, input validation across all API routes. Use security-reviewer agent.

#### 40. Final fixes + deploy to staging

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Apply last fixes, run full test suite, deploy to staging. Smoke test all critical paths on staging environment.
- **To complete**: Apply last fixes, run full test suite, deploy to staging. Smoke test all critical paths on staging environment.

#### 41. Send invites to 10 beta traders

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Contact 10 selected traders. Share invite links + onboarding instructions. Ensure each can sign up, join a clan, and connect MT account.
- **To complete**: Contact 10 selected traders. Share invite links + onboarding instructions. Ensure each can sign up, join a clan, and connect MT account.

#### 42. Beta day 1-2: Onboarding monitoring

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Monitor new signups, MT connections, first trade cards. Check audit logs for errors. Be available for quick fixes.
- **To complete**: Monitor new signups, MT connections, first trade cards. Check audit logs for errors. Be available for quick fixes.

#### 43. Beta day 3-4: Chat & trade flow check

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Verify real-time chat works with multiple concurrent users. Check trade card creation/tracking with real MT data. Monitor Socket.io stability.
- **To complete**: Verify real-time chat works with multiple concurrent users. Check trade card creation/tracking with real MT data. Monitor Socket.io stability.

#### 44. Beta mid-point: Fix critical feedback

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Deploy fixes for any critical issues found during first 5 days. Hot-fix deploy to prod if needed.
- **To complete**: Deploy fixes for any critical issues found during first 5 days. Hot-fix deploy to prod if needed.

#### 45. Fix all beta feedback issues

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Address all bugs and UX issues from beta testers. Prioritize: data integrity > functionality > polish.
- **To complete**: Address all bugs and UX issues from beta testers. Prioritize: data integrity > functionality > polish.

#### 46. Final regression test

- **Status**: TO DO
- **Priority**: HIGH
- **What it is**: Run full QA checklist one more time. Run E2E smoke tests. Verify all critical flows on prod.
- **To complete**: Run full QA checklist one more time. Run E2E smoke tests. Verify all critical flows on prod.

#### 47. Switch SMTP from Brevo to Resend + fix clantrader.ir references

- **Status**: DONE
- **Priority**: NORMAL
- **What it is**: Brevo required phone verification which is impossible from Iran during blackouts. Switched to Resend.com (no phone needed). Also fixed all clantrader.ir references to clantrader.com since dev is the current focus.

#### 48. Add Geo Live News page with Liveuamap widget

- **Status**: IN TESTING
- **Priority**: NORMAL
- **What it is**: New page at /geo-news embedding liveuamap.com/frame iframe. Add to sidebar navigation as "Geo Live News". i18n keys for en+fa.
- **To complete**: Code complete. Needs manual QA verification before marking done.

#### 49. Show Live P&L for trades without SL (analysis cards)

- **Status**: DONE
- **Priority**: NORMAL
- **What it is**: Analysis cards without a Stop Loss were skipped in PnL broadcasts. Add pricePnl field so no-SL trades show a Live P&L column instead of Live R:R.

#### 50. Structured logging (Pino) (`ops.logging`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *PLATFORM_OPS*
- **What it is**: Replace 150+ console.log calls with JSON structured logging via Pino. Not implemented.
- **To complete**: Replace 150+ console.log calls with JSON structured logging via Pino. Not implemented.

#### 51. SEO (OG tags, sitemap, canonical) (`ops.seo`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *PLATFORM_OPS*
- **What it is**: Basic metadata exists. Missing: OG images, sitemap.ts, robots.ts, structured data.
- **To complete**: Basic metadata exists. Missing: OG images, sitemap.ts, robots.ts, structured data.

#### 52. E2E test suite (Playwright) (`ops.e2e-tests`)

- **Status**: DONE
- **Priority**: NORMAL — *PLATFORM_OPS*

#### 53. Landing page

- **Status**: DONE
- **Priority**: NORMAL

#### 54. Performance audit & optimization

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Run Lighthouse audit, identify bottlenecks. Optimize: lazy loading for heavy components, image compression, N+1 query fixes, bundle splitting. Target >80 Lighthouse score.
- **To complete**: Run Lighthouse audit, identify bottlenecks. Optimize: lazy loading for heavy components, image compression, N+1 query fixes, bundle splitting. Target >80 Lighthouse score.

#### 55. Error monitoring (Sentry)

- **Status**: BACKLOG
- **Priority**: NORMAL
- **What it is**: Integrate Sentry for real-time error tracking and performance monitoring. Capture unhandled exceptions, API errors, and slow queries in production.
- **To complete**: Integrate Sentry for real-time error tracking and performance monitoring. Capture unhandled exceptions, API errors, and slow queries in production.

#### 56. Onboarding flow

- **Status**: IN PROGRESS
- **Priority**: NORMAL
- **What it is**: First-time user experience: welcome screen after signup, guided tour of key features (profile setup, join a clan, connect MT account), progress checklist on home page.
- **To complete**: Currently being worked on. Finish implementation and move to testing.

#### 57. Deployment checklist & docs

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Write deployment runbook: server setup steps, env var checklist, database migration procedure, rollback plan, monitoring setup, SSL cert renewal. For when we set up clantrader.ir.
- **To complete**: Write deployment runbook: server setup steps, env var checklist, database migration procedure, rollback plan, monitoring setup, SSL cert renewal. For when we set up clantrader.ir.

#### 58. Prepare QA test accounts

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Create 2 admin accounts + 5 test user accounts on staging. Set up 2 test clans with sample data.
- **To complete**: Create 2 admin accounts + 5 test user accounts on staging. Set up 2 test clans with sample data.

#### 59. QA: EA/MetaTrader auth

- **Status**: IN TESTING
- **Priority**: NORMAL
- **What it is**: Test §1.3 — Signup via EA token, login via EA token, MT4/MT5 EA downloads work.
- **To complete**: Code complete. Needs manual QA verification before marking done.

#### 60. QA: Signup validation & referrals

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §1.4 — Username min 3 chars, availability check, password min 8, email format, referral code tracking.
- **To complete**: Test §1.4 — Username min 3 chars, availability check, password min 8, email format, referral code tracking.

#### 61. QA: Phone & email verification

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §1.5 + §1.6 — Add phone redirect, add/change phone, send verification email, click link, banners.
- **To complete**: Test §1.5 + §1.6 — Add phone redirect, add/change phone, send verification email, click link, banners.

#### 62. QA: User profiles (own + others)

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §3.1 + §3.2 — Own profile fields, trading stats, badges, other user profile, message button, private info hidden.
- **To complete**: Test §3.1 + §3.2 — Own profile fields, trading stats, badges, other user profile, message button, private info hidden.

#### 63. QA: Edit profile settings

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §3.3 — Edit name/username/bio, upload avatar, trading style, preferred session/pairs, username taken error.
- **To complete**: Test §3.3 — Edit name/username/bio, upload avatar, trading style, preferred session/pairs, username taken error.

#### 64. QA: Appearance & security settings

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §4.1 + §4.2 — Display size levels, font selection (EN+FA), persist after reload, phone/email/password in security.
- **To complete**: Test §4.1 + §4.2 — Display size levels, font selection (EN+FA), persist after reload, phone/email/password in security.

#### 65. QA: MT accounts settings

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §4.3 — Account list, balance/equity, heartbeat, connection status, positions, trades, disconnect, regenerate key.
- **To complete**: Test §4.3 — Account list, balance/equity, heartbeat, connection status, positions, trades, disconnect, regenerate key.

#### 66. QA: Topics & invites + edge cases

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §5.5 + §5.6 + §5.7 — Create/edit/archive topics, max 20, invite link join, expired link, one-clan limit, full clan, leader leave.
- **To complete**: Test §5.5 + §5.6 + §5.7 — Create/edit/archive topics, max 20, invite link join, expired link, one-clan limit, full clan, leader leave.

#### 67. QA: Reactions, pinning, typing, presence

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §6.3 + §6.4 + §6.5 + §6.6 — React/unreact, pin/unpin (leader), max 10 pins, typing indicator, online status list.
- **To complete**: Test §6.3 + §6.4 + §6.5 + §6.6 — React/unreact, pin/unpin (leader), max 10 pins, typing indicator, online status list.

#### 68. QA: Chat history & pagination

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §6.7 — Load older messages on scroll, 50 per page, auto-scroll to newest, search messages.
- **To complete**: Test §6.7 — Load older messages on scroll, 50 per page, auto-scroll to newest, search messages.

#### 69. QA: Channel posts & reactions

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §9.1 + §9.2 + §9.3 — View posts, filter, create post with title/content/images, edit/delete, react/unreact, auto-post from trade cards.
- **To complete**: Test §9.1 + §9.2 + §9.3 — View posts, filter, create post with title/content/images, edit/delete, react/unreact, auto-post from trade cards.

#### 70. QA: Trade journal dashboard & analytics

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §10.1 + §10.2 — Summary cards, equity curve, cumulative R, calendar heatmap, instrument breakdown, streaks, time analysis.
- **To complete**: Test §10.1 + §10.2 — Summary cards, equity curve, cumulative R, calendar heatmap, instrument breakdown, streaks, time analysis.

#### 71. QA: Journal filters

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §10.3 — Filter tracked signals vs all, clan filter, time period, verify all charts update.
- **To complete**: Test §10.3 — Filter tracked signals vs all, clan filter, time period, verify all charts update.

#### 72. QA: Leaderboard & badges

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §11 + §12 — Rankings by win rate/PF/R, filters, season display, badge display on profile, categories, rank ladder.
- **To complete**: Test §11 + §12 — Rankings by win rate/PF/R, filters, season display, badge display on profile, categories, rank ladder.

#### 73. QA: Home feed & missions

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §13 — Greeting, season widget, quick stats, feed from clans, empty state, add email/MT banners, missions progress.
- **To complete**: Test §13 — Greeting, season widget, quick stats, feed from clans, empty state, add email/MT banners, missions progress.

#### 74. QA: Watchlist & statements

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Test §14 + §15 — Add/remove instruments, data updates. View statements, verification status, auto-generated from MT.
- **To complete**: Test §14 + §15 — Add/remove instruments, data updates. View statements, verification status, auto-generated from MT.

#### 75. Performance optimization pass

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Lazy loading, image optimization, N+1 query check, bundle size analysis, Lighthouse audit. Target >80 performance score.
- **To complete**: Lazy loading, image optimization, N+1 query check, bundle size analysis, Lighthouse audit. Target >80 performance score.

#### 76. Prepare beta invite materials

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Write welcome message for beta testers. Create 2 demo clans with sample trades. Prepare feedback form/channel. Generate 10 invite links.
- **To complete**: Write welcome message for beta testers. Create 2 demo clans with sample trades. Prepare feedback form/channel. Generate 10 invite links.

#### 77. Beta day 5-6: Collect first feedback round

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Reach out to all 10 testers for feedback. Document issues, feature requests, UX pain points. Prioritize fixes.
- **To complete**: Reach out to all 10 testers for feedback. Document issues, feature requests, UX pain points. Prioritize fixes.

#### 78. Beta day 7-8: Statements & leaderboard check

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Verify trading statements are being generated. Check leaderboard rankings with real data. Verify badge awards.
- **To complete**: Verify trading statements are being generated. Check leaderboard rankings with real data. Verify badge awards.

#### 79. Beta day 9-10: Final feedback collection

- **Status**: TO DO
- **Priority**: NORMAL
- **What it is**: Collect final feedback from all testers. Document remaining issues. Rate overall readiness for public launch.
- **To complete**: Collect final feedback from all testers. Document remaining issues. Rate overall readiness for public launch.

#### 80. SEO meta tags & OG images

- **Status**: BACKLOG
- **Priority**: LOW
- **What it is**: Add meta title, description, and Open Graph images for all public pages (home, login, signup, clan profile, user profile, discover). Helps with link previews when sharing on Telegram/social media.
- **To complete**: Add meta title, description, and Open Graph images for all public pages (home, login, signup, clan profile, user profile, discover). Helps with link previews when sharing on Telegram/social media.

---

### P9 — Stabilization & Alpha

**Progress**: 0/20 tasks done (0%)

#### 1. Automated PostgreSQL backups (`stabilize.db-backups`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **Estimate**: 1/1/2h (best/likely/worst)
- **What it is**: pg_dump cron job with 7-day retention + test restore drill.
- **To complete**: pg_dump cron job with 7-day retention + test restore drill.

#### 2. Self-hosted error tracking (GlitchTip) (`stabilize.error-tracking`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Deploy GlitchTip on dev/prod for production error capture, alerting, and dashboard. No external SaaS dependency.
- **To complete**: Deploy GlitchTip on dev/prod for production error capture, alerting, and dashboard. No external SaaS dependency.

#### 3. Rate limiting on all public routes (`stabilize.rate-limits`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **Estimate**: 1/1/2h (best/likely/worst)
- **What it is**: Rate limiting on login, signup, reset, and all public API routes. Extends existing OTP + chat rate limits.
- **To complete**: Rate limiting on login, signup, reset, and all public API routes. Extends existing OTP + chat rate limits.

#### 4. Iran VPS setup (`stabilize.iran-vps`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **Estimate**: 1/2/4h (best/likely/worst)
- **What it is**: Iran VPS setup: PostgreSQL, Redis, Node.js, nginx, SSL certificate. Production-ready server configuration.
- **To complete**: Iran VPS setup: PostgreSQL, Redis, Node.js, nginx, SSL certificate. Production-ready server configuration.

#### 5. Kavenegar OTP on Iran prod (`stabilize.kavenegar-prod`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Kavenegar OTP configured and tested on Iran staging + production servers.
- **To complete**: Kavenegar OTP configured and tested on Iran staging + production servers.

#### 6. SMTP for production email (`stabilize.smtp-prod`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: SMTP configured for production email verification and password reset flows.
- **To complete**: SMTP configured for production email verification and password reset flows.

#### 7. Deploy pipeline to Iran end-to-end (`stabilize.deploy-iran`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PLATFORM_OPS*
- **Estimate**: 1/1/2h (best/likely/worst)
- **What it is**: Run deploy pipeline to Iran (staging then prod) end-to-end and verify all services work.
- **To complete**: Run deploy pipeline to Iran (staging then prod) end-to-end and verify all services work.

#### 8. Mobile audit (`stabilize.mobile-audit`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *PRODUCT_CORE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Mobile audit: fix horizontal scroll, touch targets, keyboard overlap across all critical flows.
- **To complete**: Mobile audit: fix horizontal scroll, touch targets, keyboard overlap across all critical flows.

#### 9. Signal cards readable on mobile (`stabilize.signal-cards-mobile`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *PRODUCT_CORE*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Signal cards (R:R, instruments, actions) readable and usable on mobile viewports.
- **To complete**: Signal cards (R:R, instruments, actions) readable and usable on mobile viewports.

#### 10. Manual E2E integrity test (`stabilize.integrity-e2e`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *TRUST_INTEGRITY*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Manual E2E test verifying all 6 integrity conditions are enforced end-to-end.
- **To complete**: Manual E2E test verifying all 6 integrity conditions are enforced end-to-end.

#### 11. Exploit regression tests (`stabilize.exploit-regression`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *TRUST_INTEGRITY*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Regression tests for known exploits: analysis upgrade loophole, retroactive match exploit, and other documented integrity bypasses.
- **To complete**: Regression tests for known exploits: analysis upgrade loophole, retroactive match exploit, and other documented integrity bypasses.

#### 12. Alpha invite batch (`stabilize.alpha-invite`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *PRODUCT_CORE*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Invite 10-20 traders, create 2-3 curated clans for alpha testing.
- **To complete**: Invite 10-20 traders, create 2-3 curated clans for alpha testing.

#### 13. Alpha bug-fix buffer (`stabilize.alpha-bugfix`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *PRODUCT_CORE*
- **Estimate**: 3/5/7h (best/likely/worst)
- **What it is**: Bug-fix buffer for issues discovered during alpha feedback period (3-5 days).
- **To complete**: Bug-fix buffer for issues discovered during alpha feedback period (3-5 days).

#### 14. Zod env validation at startup (`stabilize.env-validation`)

- **Status**: BACKLOG
- **Priority**: HIGH — *PLATFORM_OPS*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Fail-fast on missing or invalid environment variables using Zod schema validation at server startup.
- **To complete**: Fail-fast on missing or invalid environment variables using Zod schema validation at server startup.

#### 15. /api/health endpoint (`stabilize.health-endpoint`)

- **Status**: BACKLOG
- **Priority**: HIGH — *PLATFORM_OPS*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: /api/health returning DB + Redis + Socket.io connectivity status as JSON.
- **To complete**: /api/health returning DB + Redis + Socket.io connectivity status as JSON.

#### 16. Modals and sheets on mobile (`stabilize.modals-mobile`)

- **Status**: BACKLOG
- **Priority**: HIGH — *PRODUCT_CORE*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Modals/bottom sheets closable on mobile + empty states guide the user to the next step.
- **To complete**: Modals/bottom sheets closable on mobile + empty states guide the user to the next step.

#### 17. Statement recalculation accuracy check (`stabilize.statement-accuracy`)

- **Status**: BACKLOG
- **Priority**: HIGH — *TRUST_INTEGRITY*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Statement recalculation accuracy check versus manual calculation for sample traders.
- **To complete**: Statement recalculation accuracy check versus manual calculation for sample traders.

#### 18. Statement performance test (`stabilize.statement-perf`)

- **Status**: BACKLOG
- **Priority**: HIGH — *TRUST_INTEGRITY*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Performance test: statement calculation with 500+ trades to ensure it completes in acceptable time.
- **To complete**: Performance test: statement calculation with 500+ trades to ensure it completes in acceptable time.

#### 19. Live News Feed — financial & geopolitical aggregation

- **Status**: BACKLOG
- **Priority**: NORMAL
- **What it is**: ## Live News Feed  Replace /geo-news (Liveuamap links) with an in-house live news aggregation system — real-time scrollable feed of financial & geopolitical news affecting traders' markets (forex, gold, oil, crypto, geopolitical events).  ## Architecture  Cron worker (every 2 min) → fetch RSS + A...
- **To complete**: ## Live News Feed  Replace /geo-news (Liveuamap links) with an in-house live news aggregation system — real-time scrollable feed of financial & geopolitical news affecting traders' markets (forex, ...

#### 20. RTL visual regression tests (`stabilize.rtl-tests`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *TRUST_INTEGRITY*
- **Estimate**: ?/1/2h (best/likely/worst)
- **What it is**: RTL visual regression tests using Playwright on mobile and desktop viewports.
- **To complete**: RTL visual regression tests using Playwright on mobile and desktop viewports.

---

### P10 — Market Data Pipeline

**Progress**: 0/7 tasks done (0%)

#### 1. MT quote storage (`market-data.mt-quote-storage`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/1/2h (best/likely/worst)
- **What it is**: MarketPricePoint model + store prices from EA heartbeat into database for historical reference.
- **To complete**: MarketPricePoint model + store prices from EA heartbeat into database for historical reference.

#### 2. OHLC candle aggregation (`market-data.ohlc-aggregation`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: OHLC candle aggregation from MT ticks at multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d).
- **To complete**: OHLC candle aggregation from MT ticks at multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d).

#### 3. Price freshness rules (`market-data.freshness-rules`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Price freshness: mark symbol as stale if no update received in X seconds. Show warning in UI.
- **To complete**: Price freshness: mark symbol as stale if no update received in X seconds. Show warning in UI.

#### 4. OpenRouter client wrapper (`market-data.openrouter-wrapper`)

- **Status**: BACKLOG `LAUNCH BLOCKER`
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: OpenRouter client wrapper with retries, rate limits, prompt versioning, and LLMRunRecord table for cost/latency tracking.
- **To complete**: OpenRouter client wrapper with retries, rate limits, prompt versioning, and LLMRunRecord table for cost/latency tracking.

#### 5. Typed contracts (Zod schemas) (`market-data.typed-contracts`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/2h (best/likely/worst)
- **What it is**: Typed contracts: MarketSnapshot, EventCard, BriefingRecord Zod schemas for consistent data shapes across the pipeline.
- **To complete**: Typed contracts: MarketSnapshot, EventCard, BriefingRecord Zod schemas for consistent data shapes across the pipeline.

#### 6. Symbol normalization resolver (`market-data.symbol-normalization`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/2h (best/likely/worst)
- **What it is**: Symbol normalization resolver: map broker-specific names (XAUUSD vs GOLD, suffixes like .m, .a) to canonical symbols.
- **To complete**: Symbol normalization resolver: map broker-specific names (XAUUSD vs GOLD, suffixes like .m, .a) to canonical symbols.

#### 7. Market data health dashboard (`market-data.health-dashboard`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: 1/1/2h (best/likely/worst)
- **What it is**: Admin dashboard showing live/stale symbols, last update times, and data pipeline health.
- **To complete**: Admin dashboard showing live/stale symbols, last update times, and data pipeline health.

---

### P11 — News Aggregation

**Progress**: 0/10 tasks done (0%)

#### 1. NewsItem model (`news.item-model`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: NewsItem model + enums added to Prisma schema for news data storage.
- **To complete**: NewsItem model + enums added to Prisma schema for news data storage.

#### 2. RSS fetcher service (`news.rss-fetcher`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: RSS fetcher service pulling from Investing.com, ForexLive, Al Jazeera, Reuters feeds.
- **To complete**: RSS fetcher service pulling from Investing.com, ForexLive, Al Jazeera, Reuters feeds.

#### 3. Finnhub + NewsData.io API fetcher (`news.api-fetcher`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/1/2h (best/likely/worst)
- **What it is**: Finnhub + NewsData.io API fetcher with rate limiting and fallback between providers.
- **To complete**: Finnhub + NewsData.io API fetcher with rate limiting and fallback between providers.

#### 4. News dedup engine (`news.dedup-engine`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Dedup engine using externalId hash vs DB to prevent duplicate news items from multiple sources.
- **To complete**: Dedup engine using externalId hash vs DB to prevent duplicate news items from multiple sources.

#### 5. AI news classifier (`news.ai-classifier`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/2h (best/likely/worst)
- **What it is**: OpenRouter AI classifier assigning category, instruments, impact level, sentiment, and summary to each news item.
- **To complete**: OpenRouter AI classifier assigning category, instruments, impact level, sentiment, and summary to each news item.

#### 6. News cron worker (`news.cron-worker`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/1/2h (best/likely/worst)
- **What it is**: Cron worker running every 2 minutes: fetch → dedup → classify → store → Socket.io push to connected clients.
- **To complete**: Cron worker running every 2 minutes: fetch → dedup → classify → store → Socket.io push to connected clients.

#### 7. News API endpoint (`news.api-endpoint`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: GET /api/news with pagination and filters by category, impact, instrument, and region.
- **To complete**: GET /api/news with pagination and filters by category, impact, instrument, and region.

#### 8. News image proxy (`news.image-proxy`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Image proxy /api/news/image/[id] to serve news images without external CDN dependency at runtime.
- **To complete**: Image proxy /api/news/image/[id] to serve news images without external CDN dependency at runtime.

#### 9. News page UI (`news.page-ui`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: /news page with news feed, filters, live indicator, and news cards.
- **To complete**: /news page with news feed, filters, live indicator, and news cards.

#### 10. Admin manual EventCard posting (`news.admin-posting`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/1h (best/likely/worst)
- **What it is**: Manual admin tool for posting EventCards (breaking news, market alerts) directly.
- **To complete**: Manual admin tool for posting EventCards (breaking news, market alerts) directly.

---

### P12 — AI Copilot & Briefings

**Progress**: 0/5 tasks done (0%)

#### 1. ContextBuilder service (`copilot.context-builder`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: ContextBuilder service that builds MarketSnapshot from MT data + news for AI consumption.
- **To complete**: ContextBuilder service that builds MarketSnapshot from MT data + news for AI consumption.

#### 2. Daily briefing generator (`copilot.daily-briefing`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Daily briefing generator: per-asset + overall market summary via OpenRouter.
- **To complete**: Daily briefing generator: per-asset + overall market summary via OpenRouter.

#### 3. Briefing UI (`copilot.briefing-ui`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/2h (best/likely/worst)
- **What it is**: Briefing UI: show daily briefing in app, share to clan, 'why this matters' explainer.
- **To complete**: Briefing UI: show daily briefing in app, share to clan, 'why this matters' explainer.

#### 4. Per-asset mini-briefing (`copilot.asset-briefing`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/2h (best/likely/worst)
- **What it is**: Per-asset mini-briefing: click instrument to see AI summary of recent price action and news.
- **To complete**: Per-asset mini-briefing: click instrument to see AI summary of recent price action and news.

#### 5. Prompt versioning + A/B testing (`copilot.prompt-versioning`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/2h (best/likely/worst)
- **What it is**: Prompt versioning and A/B testing infrastructure for all AI-generated content.
- **To complete**: Prompt versioning and A/B testing infrastructure for all AI-generated content.

---

### P13 — Vibe Trading

**Progress**: 0/6 tasks done (0%)

#### 1. TradePlanCandidate builder (`vibe.trade-plan`)

- **Status**: BACKLOG
- **Priority**: CRITICAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: TradePlanCandidate builder using deterministic math. LLM NEVER does position sizing or R:R calculations.
- **To complete**: TradePlanCandidate builder using deterministic math. LLM NEVER does position sizing or R:R calculations.

#### 2. Vibe input UI (`vibe.input-ui`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/2h (best/likely/worst)
- **What it is**: Vibe input UI: text field where user types their market thesis (e.g., 'I think gold will go up because...').
- **To complete**: Vibe input UI: text field where user types their market thesis (e.g., 'I think gold will go up because...').

#### 3. ParsedVibe extraction (`vibe.parsed-vibe`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: ParsedVibe extraction via OpenRouter: direction, instrument, conviction level, and reasoning from free-text input.
- **To complete**: ParsedVibe extraction via OpenRouter: direction, instrument, conviction level, and reasoning from free-text input.

#### 4. Paper position creation (`vibe.paper-position`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/2h (best/likely/worst)
- **What it is**: Confirm flow creates PaperPositionRecord (paper trading). Market snapshot locked at creation time.
- **To complete**: Confirm flow creates PaperPositionRecord (paper trading). Market snapshot locked at creation time.

#### 5. Paper position lifecycle (`vibe.paper-lifecycle`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Paper position lifecycle: open → tracking → closed, using MT-derived prices for P&L calculation.
- **To complete**: Paper position lifecycle: open → tracking → closed, using MT-derived prices for P&L calculation.

#### 6. Outcome scoring (`vibe.outcome-scoring`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/2h (best/likely/worst)
- **What it is**: OutcomeRecord scoring: realized R, timing accuracy, direction correctness for each closed paper position.
- **To complete**: OutcomeRecord scoring: realized R, timing accuracy, direction correctness for each closed paper position.

---

### P14 — Paper Portfolio

**Progress**: 0/3 tasks done (0%)

#### 1. Paper portfolio dashboard (`paper.portfolio-dashboard`)

- **Status**: BACKLOG
- **Priority**: HIGH — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Paper portfolio dashboard: open positions, P&L, and trade history.
- **To complete**: Paper portfolio dashboard: open positions, P&L, and trade history.

#### 2. Replay UI (`paper.replay-ui`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Replay UI: show vibe → snapshot → plan → outcome side-by-side for learning review.
- **To complete**: Replay UI: show vibe → snapshot → plan → outcome side-by-side for learning review.

#### 3. VibeScoreProfile (`paper.vibe-score`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: VibeScoreProfile: rolling accuracy tracking and pattern detection across user's vibe history.
- **To complete**: VibeScoreProfile: rolling accuracy tracking and pattern detection across user's vibe history.

---

### P15 — Coaching & Alerts

**Progress**: 0/4 tasks done (0%)

#### 1. Behavioral insights (`coach.behavioral-insights`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: 2/3/5h (best/likely/worst)
- **What it is**: Behavioral insights from trade history: overtrading detection, revenge trading patterns, time-of-day analysis.
- **To complete**: Behavioral insights from trade history: overtrading detection, revenge trading patterns, time-of-day analysis.

#### 2. Weekly coaching digest (`coach.weekly-digest`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Automated weekly coaching digest: personalized trading review with AI-generated insights.
- **To complete**: Automated weekly coaching digest: personalized trading review with AI-generated insights.

#### 3. Watch tasks (`coach.watch-tasks`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Watch tasks: user sets conditions like 'alert me when XAUUSD > 2400' and receives notifications.
- **To complete**: Watch tasks: user sets conditions like 'alert me when XAUUSD > 2400' and receives notifications.

#### 4. Alert pipeline (`coach.alert-pipeline`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/2h (best/likely/worst)
- **What it is**: Alert pipeline: Socket.io push + optional email/in-app notification for triggered alerts.
- **To complete**: Alert pipeline: Socket.io push + optional email/in-app notification for triggered alerts.

---

### P16 — Execution Bridge

**Progress**: 0/4 tasks done (0%)

#### 1. Send plan to MT (`execution.send-to-mt`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Send trade plan to MetaTrader as pending action. Requires explicit user confirmation before execution.
- **To complete**: Send trade plan to MetaTrader as pending action. Requires explicit user confirmation before execution.

#### 2. Money management presets (`execution.money-management`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: 1/2/3h (best/likely/worst)
- **What it is**: Money management presets: fixed lot, percentage risk, max daily loss. Applied to trade plans before execution.
- **To complete**: Money management presets: fixed lot, percentage risk, max daily loss. Applied to trade plans before execution.

#### 3. Emergency close all positions (`execution.kill-switch`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/2h (best/likely/worst)
- **What it is**: Emergency button to close all open positions across all linked MT accounts immediately.
- **To complete**: Emergency button to close all open positions across all linked MT accounts immediately.

#### 4. Execution journal (`execution.journal`)

- **Status**: BACKLOG
- **Priority**: NORMAL — *MARKET_INTELLIGENCE*
- **Estimate**: ?/1/2h (best/likely/worst)
- **What it is**: Auto-log all executed trades with full context: plan, snapshot, vibe, entry, exit, result.
- **To complete**: Auto-log all executed trades with full context: plan, snapshot, vibe, entry, exit, result.

---

## Workstream Summary

| Workstream | Total | Done | Remaining |
|---|---|---|---|
| MARKET_INTELLIGENCE | 39 | 0 | 39 |
| MONETIZATION_GROWTH | 6 | 2 | 4 |
| PLATFORM_OPS | 25 | 5 | 20 |
| PRODUCT_CORE | 40 | 26 | 14 |
| TRUST_INTEGRITY | 10 | 5 | 5 |
| Unassigned | 85 | 19 | 66 |

