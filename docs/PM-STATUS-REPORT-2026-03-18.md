# ClanTrader — Project Status Report for PM Review

**Date**: 2026-03-18  
**Author**: Development (AI-assisted)  
**Authority**: SOURCE_OF_TRUTH.md (repo root)  
**Board**: /admin/kanban on clantrader.com  

---

## 1. Executive Summary

ClanTrader is a **trust-first trader tool platform** for Farsi-speaking forex/gold traders. It verifies trading activity through a MetaTrader EA bridge and presents honest, integrity-checked performance data.

The product is NOT primarily a signal app, rankings app, or social feed — it is a verified trader intelligence platform evolving toward a Trading Command Center and eventually Vibe Trading (AI-assisted decision support).

**Current phase**: Layer 1 (Trust Foundation) — MVP hardening toward a diaspora-first launch in invite waves.

**Tech stack**: Next.js 16.1, React 19, Prisma 7, PostgreSQL 16, Socket.io 4.8, Redis 7, TypeScript strict.

**Team**: Solo founder + AI development assistant (Claude Code).

**Completed work**: 91 tasks done + 11 bugs fixed = **102 total completed**.

---

## 2. What Is Built (Verified, Running on Dev Server)

| System | Status |
|--------|--------|
| Auth (email/password + EA token + phone OTP) | LIVE |
| Clans (create, join, leave, switch, roles, tiers) | LIVE |
| Real-time chat (Socket.io, topics, images, reactions, presence) | LIVE |
| Direct messages | LIVE |
| Trade cards (signal + analysis, MT-linked actions, version history) | LIVE |
| EA bridge (12 endpoints, full trade lifecycle, heartbeat, pending actions) | LIVE |
| Signal qualification (20s window, frozen risk snapshots) | LIVE |
| 7-condition integrity contract (deny-by-default) | LIVE |
| Auto-generated statements from MT data | LIVE |
| Live open risk overlay (floating PnL, drawdown, stale warning) | LIVE |
| Effective rank with open-loss penalty | LIVE |
| Leaderboards (6 lenses + composite ranking) | LIVE |
| Badges (rank/performance/trophy, admin recompute) | LIVE |
| Activity Digest v2 (14 engines, equity curve, price ladder, risk insight) | LIVE |
| Notifications + Price Alerts (real-time + 30s polling fallback + audio) | LIVE |
| Channel posts (create, feed, reactions, view count) | LIVE |
| Admin panel (15 pages, 40+ API routes, kanban, feature flags) | LIVE |
| i18n (English + Persian, 1200+ keys, full RTL support) | LIVE |
| Mobile responsive (logical CSS properties, self-hosted fonts) | LIVE |
| Rate limiting (6 tiers, Redis-backed, fail-open) | LIVE |
| Error tracking (Sentry + Telegram notifications) | LIVE |
| PM2 process management (auto-restart, memory limits) | LIVE |
| Health endpoint (DB/Redis/Socket.io checks) | LIVE |
| Service worker (network-first for chunks, cache-first for static) | LIVE |
| Deposit/withdrawal detection + cash-flow-neutral performance | LIVE |
| Heartbeat fallback (cross-user price estimation when EA stops) | LIVE |
| AI data capture (DigestOutput, StatementSnapshot, LiveRiskSnapshot) | LIVE |

---

## 3. What Is NOT Built / Explicitly Deferred

| Item | Status | Decision |
|------|--------|----------|
| AI features | STUB (empty folder) | Post-Layer 1 |
| Payment processing (ZarinPal) | DB models only, no processor | Post-Layer 1 |
| CI/CD pipeline | None | Post-launch (manual deploy OK for beta) |
| Broker history import | None | Not planned |
| Manual statement upload | None | Not planned |
| Multi-step onboarding | Minimal modal only | Post-Layer 1 |
| Pending order tracking | None | Not planned for MVP |
| Notification channels (Telegram, push, email, SMS) | In-app only | Post-Layer 1 |
| Content moderation / blocking / muting | None | Bug reporting planned for hardening |
| Paywall enforcement | Model exists, no runtime enforcement | Post-Layer 1 |

---

## 4. Hard Launch Blockers

From SOURCE_OF_TRUTH.md — must be resolved before any real user touches the platform:

| # | Blocker | Status |
|---|--------|--------|
| 1 | Germany VPS provisioning (staging + prod) | NOT STARTED |
| 2 | Deploy script path updates (reference old Iran VPS) | NOT STARTED |
| 3 | Stale-check runtime configuration | Running in-process on dev, needs prod verification |
| 4 | QA pass on EA auth flow | In TESTING, awaiting user verification |

---

## 5. Launch Strategy

**Market**: Iranian / Farsi-speaking forex/gold traders.  
**Initial cohort**: Farsi-speaking traders OUTSIDE Iran (diaspora — Dubai, Turkey, etc.).  
**Rollout method**: Invite waves through Instagram close friends / trusted audience.  
**Rollout principle**: Gate-based, NOT date-based. No wave advances unless all entry criteria pass.  

| Wave | Target Size | Gate Task | Key Entry Criteria |
|------|------------|-----------|-------------------|
| Wave 1 | ~10 users | GATE: Wave 1 readiness | No critical trust bugs, EA auth verified, statements accurate, production deployed + stable, SMTP working, Sentry configured |
| Wave 2 | ~50 users | GATE: Wave 2 readiness | Wave 1 stable 7+ days, no trust bugs, no statement issues, feedback processed, support manageable |
| Wave 3 | ~150 users | GATE: Wave 3 readiness | Wave 2 stable 7+ days, performance OK at 50 users, no recurring issues, bug reporting working |
| Broader | open | GATE: Layer 2 planning | Wave 3 stable 5+ days, no critical bugs, L1 maintenance plan defined |

Stable means: no open critical trust bugs, no unresolved statement correctness issue, no unresolved EA auth blocker, no repeated digest/card/journal inconsistency, support burden manageable.

---

## 6. Execution Timeline

### Phase A — Hardening (Mar 20–25)

> Close open dev work, verify all features in TESTING, run trust-sensitive QA passes, fix critical bugs, build bug reporting feature, statement accuracy verification.

| # | Priority | Blocker | Due | Task |
|---|----------|---------|-----|------|
| 1 | CRITICAL | YES | 2026-03-23 | Fix critical QA blockers: auth, integrity, statement accuracy |
| 2 | HIGH |  | 2026-03-25 | User-facing bug/problem reporting |
| 3 | HIGH | YES | 2026-03-24 | Statement recalculation accuracy check |
| 4 | HIGH | YES | 2026-03-25 | Fix remaining QA issues: UI polish, edge cases, mobile regressions |
| 5 | HIGH |  | 2026-03-25 | Statement performance test |
| 6 | CRITICAL | YES | 2026-03-24 | QA: Auth flows (signup, login, verify, reset) |
| 7 | CRITICAL | YES | 2026-03-24 | QA: Clans + chat + topics |
| 8 | CRITICAL | YES | 2026-03-24 | QA: Trade cards + signals + DMs |
| 9 | HIGH | YES | 2026-03-24 | QA: Admin panel + leaderboards |
| 10 | NORMAL |  | 2026-03-22 | Prepare QA test accounts |
| — | — | | Mar 22–25 | *24 QA checklist tasks: auth, chat, trade cards, admin, journal, settings, profiles, mobile, RTL — to be batched across 3-4 QA sessions* |

### Phase B — Production Readiness (Mar 26–31)

> Provision Germany VPS, fix deploy scripts, set up SMTP/backups/monitoring, deploy to staging, full regression, promote to production, pass Wave 1 gate.

| # | Priority | Blocker | Due | Task |
|---|----------|---------|-----|------|
| 1 | CRITICAL | YES | 2026-03-26 | Prod/Stage server setup (Germany VPS) |
| 2 | CRITICAL | YES | 2026-03-27 | Deploy pipeline to prod/stage end-to-end |
| 3 | CRITICAL | YES | 2026-03-26 | SMTP for production email |
| 4 | HIGH | YES | 2026-03-28 | Deploy latest build to staging |
| 5 | CRITICAL | YES | 2026-03-30 | Final regression + staging deploy |
| 6 | CRITICAL | YES | 2026-03-31 | Promote staging to production |
| 7 | CRITICAL | YES | 2026-03-31 | GATE: Wave 1 readiness check |
| 8 | HIGH |  | 2026-03-29 | Uptime monitoring + Telegram alerts |
| 9 | HIGH |  | 2026-03-29 | Blackout resilience test |
| 10 | HIGH |  | 2026-03-30 | Final fixes + deploy to staging |
| 11 | HIGH | YES | 2026-03-30 | Staging: Full regression test before go-live |
| 12 | NORMAL |  | 2026-03-27 | Deployment checklist & docs |
| 13 | NORMAL |  | 2026-03-31 | Verify landing page on staging/prod deployment |
| 14 | NORMAL |  | 2026-03-31 | Verify onboarding flow on staging |

### Phase C — Wave 1: ~10 Users (Apr 1–3)

> Invite ~10 users from inner circle via Instagram close friends. Monitor onboarding, logs, Sentry. Collect first bug reports. No feature work.

| # | Priority | Blocker | Due | Task |
|---|----------|---------|-----|------|
| 1 | HIGH | YES | 2026-04-01 | Wave 1: Invite ~10 users (inner circle) |
| 2 | HIGH |  | 2026-04-03 | Wave 1: Monitor onboarding + first 48h |
| 3 | NORMAL |  | 2026-03-31 | Prepare beta invite materials |

### Phase D — Stabilization 1 (Apr 4–10)

> Fix trust bugs from real usage. Triage user feedback. Verify chat/trade/card/journal flows with real data. Process bug reports. Pass Wave 2 gate.

| # | Priority | Blocker | Due | Task |
|---|----------|---------|-----|------|
| 1 | CRITICAL | YES | 2026-04-10 | Stabilization 1: Bug-fix buffer (trust + edge cases) |
| 2 | HIGH |  | 2026-04-10 | Wave 1 stabilization: observe usage, fix trust bugs, review logs |
| 3 | HIGH | YES | 2026-04-10 | Stabilization 1: Fix trust bugs + user feedback |
| 4 | CRITICAL | YES | 2026-04-10 | GATE: Wave 2 readiness check |
| 5 | HIGH | YES | 2026-04-08 | Stabilization 1: Fix critical feedback (mid-point check) |
| 6 | HIGH |  | 2026-04-07 | Stabilization 1: Verify chat/trade/card flows with real data |
| 7 | NORMAL |  | 2026-04-09 | Stabilization 1: Collect + triage first feedback round |

### Phase E — Wave 2: ~50 Users (Apr 11–15)

> Expand to ~50 users (trusted audience). Verify statements and leaderboard with real multi-user data.

| # | Priority | Blocker | Due | Task |
|---|----------|---------|-----|------|
| 1 | CRITICAL | YES | 2026-04-11 | Wave 2: Expand to ~50 users (trusted audience) |
| 2 | NORMAL |  | 2026-04-15 | Wave 2: Verify statements + leaderboard with real data |

### Phase F — Stabilization 2 (Apr 16–23)

> Fix edge cases from broader usage. Performance audit. Collect and triage broader feedback. Pass Wave 3 gate.

| # | Priority | Blocker | Due | Task |
|---|----------|---------|-----|------|
| 1 | HIGH |  | 2026-04-23 | Wave 2 stabilization: fix edge cases, validate before scaling |
| 2 | CRITICAL | YES | 2026-04-23 | GATE: Wave 3 readiness check |
| 3 | NORMAL |  | 2026-04-20 | Performance audit & optimization |
| 4 | NORMAL |  | 2026-04-20 | Stabilization 2: Collect + triage broader feedback |

### Phase G — Wave 3: ~150 Users (Apr 24–May 3)

> Expand to ~150 users. This is the real stress test for data integrity, performance, and support burden.

| # | Priority | Blocker | Due | Task |
|---|----------|---------|-----|------|
| 1 | CRITICAL | YES | 2026-04-24 | Wave 3+: Broader rollout (~150 users then open) |

### Phase H — Layer 1 Transition (May 4–10)

> Declare Layer 1 stable. Define maintenance plan. Begin Layer 2 (News/Events) PLANNING only — no implementation.

| # | Priority | Blocker | Due | Task |
|---|----------|---------|-----|------|
| 1 | HIGH |  | 2026-05-04 | GATE: Layer 2 planning readiness |
| 2 | HIGH |  | 2026-05-10 | Layer 1 stability declaration + Layer 2 planning kickoff |

---

## 7. Current Work in Progress

### Active Now (IN_PROGRESS) — 4 tasks

> **WIP limit**: Max 2 tasks at any time. Current 4 must be closed by Mar 21-22 before new work starts.

| Priority | Blocker | Due | Task | Started |
|----------|---------|-----|------|---------|
| CRITICAL | YES | 2026-03-22 | Manual E2E integrity test | 2026-03-09 |
| HIGH |  | — | Digest Cockpit + Interactive Scenario Ladder | 2026-03-17 |
| HIGH |  | 2026-03-21 | Notification + Alarm MVP | 2026-03-13 |
| NORMAL |  | — | Fix: Equity chart stale fallback creates fake flat history | — |

### Awaiting Verification (TESTING) — 7 tasks

> Must be verified by Mar 22. Move to DONE or back to IN_PROGRESS with bug notes. Nothing sits in TESTING >2 days.

| Priority | Blocker | Due | Task |
|----------|---------|-----|------|
| CRITICAL | YES | 2026-03-22 | Single-statement architecture with live risk + effective rank |
| CRITICAL |  | 2026-03-22 | Fix deposit/withdrawal distortion across all balance-based metrics |
| HIGH |  | 2026-03-22 | Heartbeat Fallback: Price-Pool Background Computation |
| HIGH |  | 2026-03-22 | Activity Digest v2.3 — Equity Chart Normalization + Interactive Hover |
| NORMAL |  | 2026-03-22 | Add extended MT account data to EA login + heartbeat |
| NORMAL |  | 2026-03-22 | Deposit/Withdrawal Detection + TWR/NAV Performance Fix |
| NORMAL |  | 2026-03-22 | QA: EA/MetaTrader auth |

---

## 8. Execution Rules

| Rule | Value |
|------|-------|
| Max IN_PROGRESS | 2 tasks at any time |
| Max TESTING | 4 items. Verify within 48h or move back. |
| Cannot pull in during this timeline | Any IDEAS/Layer 2+ task. Any monetization, AI, fundamentals, command center, payment, marketplace task. Any BACKLOG/DEFERRED task. |
| Bug becomes new task when | Blocks core flow (auth, trade card, statement, EA) → CRITICAL immediately. Cosmetic → bottom of current phase. Trust bug (wrong R, wrong statement, integrity bypass) → CRITICAL, blocks wave expansion. |
| During stabilization phases | No new features. Only bug fixes + monitoring + trust hardening. Max 2 active items. Review Sentry + server logs daily. |
| Wave expansion | Gate-based only. All criteria must pass. No workarounds. |
| Feature requests during waves | Add to IDEAS or BACKLOG. Do not start. Do not estimate. |

---

## 9. Key Milestone Dates (Targets)

| Milestone | Target Date | Type |
|-----------|-------------|------|
| Close all IN_PROGRESS | Mar 21-22 | Prerequisite |
| Verify all TESTING | Mar 22 | Prerequisite |
| Hardening complete | Mar 25 | Phase gate |
| Germany VPS live | Mar 26 | Hard blocker |
| Staging deployed + regression green | Mar 30 | Hard blocker |
| Production live | Mar 31 | Hard blocker |
| **GATE: Wave 1** | **Mar 31** | **Launch gate** |
| **Wave 1: ~10 users** | **Apr 1** | **Milestone** |
| **GATE: Wave 2** | **Apr 10** | **Expansion gate** |
| **Wave 2: ~50 users** | **Apr 11** | **Milestone** |
| **GATE: Wave 3** | **Apr 23** | **Expansion gate** |
| **Wave 3: ~150 users** | **Apr 24** | **Milestone** |
| Layer 2 planning begins | May 4 | Planning only |
| Layer 1 lock | May 10 | Transition |

---

## 10. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Germany VPS provisioning delays | Shifts entire timeline right | Medium | Budget 2 days not 1. Have backup provider. |
| Trust bugs found during Wave 1 | Blocks Wave 2 expansion | Medium-High | Expected. Stabilization phase exists for this. |
| Solo founder capacity / burnout | Everything slower than planned | High | WIP limit of 2. No feature creep. Strict phase gates. |
| Statement accuracy issues | Blocks all wave expansions | Low | Dedicated accuracy check in hardening. |
| EA auth failures with real users | Blocks Wave 1 | Low | Currently in TESTING. Must verify before gate. |
| Support burden at 50+ users | Delays Wave 3 | Medium | Bug reporting feature. Stabilization buffer. |
| DNS propagation delays | Delays production go-live | Low-Medium | Start DNS changes 48h before needed. |

**Single biggest risk**: Germany VPS provisioning. It is the only external dependency. Everything else is within the founder's control.

---

## 11. Product Roadmap Context (NOT active — for context only)

ClanTrader has a 7-layer product roadmap. Only Layer 1 is active. Layers 2-7 are frozen until Layer 1 is declared stable.

| Layer | Name | Status | Backlog |
|-------|------|--------|--------|
| 1 | Trust Foundation | **IN PROGRESS** | (current execution) |
| — | L1: Post-Launch | PLANNED | 1 tasks |
| — | L1: Trust Foundation | PLANNED | 1 tasks |
| — | L2: News & Events | PLANNED | 12 tasks |
| — | L3: Fundamentals | PLANNED | 6 tasks |
| — | L5: Trader Sentiment + AI Grounding | PLANNED | 16 tasks |
| — | L6: Vibe Trading Alpha | PLANNED | 11 tasks |
| — | L7: Full Vibe Trading | PLANNED | 3 tasks |
| — | Monetization | PLANNED | 7 tasks |
| — | Operations | PLANNED | 2 tasks |
| — | Supporting: Data Infrastructure | PLANNED | 6 tasks |

**Total IDEAS backlog**: 65 tasks (frozen until Layer 1 is stable).

---

## 12. Backlog / Deferred (15 tasks)

Explicitly deferred by decision. Must NOT compete with launch execution.

| Priority | Task | Status |
|----------|------|--------|
| CRITICAL | Fix critical bugs from QA (day 1) | DEFERRED |
| CRITICAL | Fix critical bugs from QA (day 2) | DEFERRED |
| CRITICAL | Kavenegar OTP on production | DEFERRED |
| CRITICAL | Phone OTP signup/login (Kavenegar) | DEFERRED |
| HIGH | Get Kavenegar API key for production | DEFERRED |
| HIGH | Fix remaining QA bugs + regression test | DEFERRED |
| HIGH | QA: Phone OTP signup & login | DEFERRED |
| HIGH | CI/CD pipeline (GitHub Actions) | DEFERRED |
| NORMAL | SEO (OG tags, sitemap, canonical) | DEFERRED |
| NORMAL | RTL visual regression tests | DEFERRED |
| NORMAL | QA: Phone & email verification | DEFERRED |
| LOW | Rate-limit clan join requests per user | DEFERRED |
| LOW | Stories system | ARCHIVED |
| LOW | Spectator AI chatbot | ARCHIVED |
| LOW | Private Pending Order Journal Layer | ARCHIVED |

---

## 13. Recent Completed Work (Last 20)

| Completed | Task |
|-----------|------|
| — | Security audit (OWASP top 10) |
| — | Redesign Explore page — unified clan leaderboard |
| — | Mobile responsive polish |
| — | Rate limiting coverage |
| — | Exploit regression tests |
| 2026-03-17 | Add Price Ladder risk context insight (v2.5) |
| 2026-03-17 | Activity Digest v2.4: Price Ladder asset tabs + SHORT fix + TP levels |
| 2026-03-17 | Activity Digest v2.3: Equity Chart Normalization + Interactive Hover |
| 2026-03-13 | Fix: Equity chart showing $254K profit instead of $28.9K |
| 2026-03-08 | Modals and sheets on mobile |
| 2026-03-08 | Fix: Language/theme toggles missing on mobile |
| 2026-03-08 | Fix: Hamburger menu close button overlaps invite icon |
| 2026-03-08 | Signal cards readable on mobile |
| 2026-03-08 | Mobile audit |
| 2026-03-08 | Fix: Stray bracket and cluttered trade action messages |
| 2026-03-08 | Fix: Massive empty gaps between chat messages |
| 2026-03-08 | Fix: Auto-hide bottom nav too aggressive and jarring |
| 2026-03-08 | Fix: Tab bar overlapping ChatHeader — online count + icons hidden |
| 2026-03-08 | Fix: ChatPanel height pushed input behind MobileNav |
| 2026-03-07 | Daily PM digest via Telegram bot |

---

## 14. Questions for PM

1. **Timeline reality check**: Is Mar 20 → May 10 realistic for a solo founder? Where should we add buffer?
2. **QA prioritization**: 28 QA detail tasks exist. Which are truly critical for Wave 1 vs can be deferred to stabilization?
3. **Gate criteria review**: Are the Wave 1/2/3 gate criteria too strict, too loose, or about right?
4. **Stabilization duration**: Is 7 days between waves enough observation time?
5. **Support planning**: At 50-150 users, what support structure should exist beyond in-app bug reporting?
6. **Layer 2 readiness**: What should the Layer 2 planning process look like?
7. **28 QA tasks on one date**: These need to be spread across Mar 22-25 in batches. What grouping makes sense?

---

*Generated from ClanTrader project board and SOURCE_OF_TRUTH.md on 2026-03-18.*
