> **ARCHIVED** — Post-MVP roadmap (P9–P16). These phases are deferred and not part of current launch.
> See [docs/MVP.md](../MVP.md) for active launch scope.
> Last Verified: 2026-03-10 | Status: Archived (Post-MVP)

---

# ClanTrader Product Roadmap

> Last updated: 2026-03-04
> Timing unit: WORK_DAY (1 day = ~8 hours)
> Status model: PLANNED → IMPLEMENTED → INTEGRATED → CONFIGURED → VERIFIED → HARDENED → OPERABLE

---

## Audit Summary

### Working (VERIFIED or better)
- Auth: email signup/login, OTP (Kavenegar), email verification, password reset, profiles, usernames, JWT sessions, EA/MT auth, referral tracking
- Trade integrity: 6-condition deny-by-default, retroactive signal prevention, analysis upgrade blocked, TP drag tracking
- EA bridge: heartbeat (10s), two-way sync, pending actions, trade matching, signal auto-creation, calendar events
- Chat + DMs: Socket.io real-time, topics, reactions, pinning, typing indicators, online presence, image uploads
- Clans: CRUD, roles (leader/co-leader/member), invites, join requests, discovery, tiers
- Leaderboards: seasons, rankings (6 lenses), trader statements, auto-recalculation on trade close
- Content: channel feed, auto-post from signals, discover page, follow system, clan digest
- Badges: rank/performance/trophy categories, automated evaluation, admin CRUD, dry-run preview
- Deployment: pack → staging → prod pipeline, PM2 process management, nginx + SSL
- PWA: service worker with cache strategies, offline page, auto-update
- Feature flags, onboarding wizard, referral system, E2E tests (Playwright)

### Critical Gaps (PLANNED)
- **No DB backups** — no pg_dump automation, no restore drill
- **No error tracking** — no Sentry/GlitchTip, console.log only
- **No CI/CD** — no GitHub Actions, manual deployment only
- **Rate limiting gaps** — only OTP + chat; login/signup/API unprotected
- **No env validation** — missing vars fail silently
- **No monitoring/alerting** — PM2 restarts silently, no uptime checks
- **Iran VPS never tested** — deployment scripts exist but never run on Iran server
- **Payments** — models exist, no gateway (ZarinPal planned)

---

## Phase P9: Stabilization & Alpha Test

**Goal**: Production-ready on Iran VPS, validated by real traders
**Estimated**: 18–22 work days
**Milestone**: ALPHA_TEST

### Epic A: Production Infrastructure (P0) — ~5 days

| Key | Task | Est. (B/L/W) | Priority | Status |
|-----|------|-------------|----------|--------|
| stabilize.db-backups | Automated PostgreSQL backups (pg_dump cron + 7d retention + restore drill) | 1/1/2 | P0 | PLANNED |
| stabilize.error-tracking | Self-hosted error tracking (GlitchTip) | 1/2/3 | P0 | PLANNED |
| stabilize.env-validation | Zod env validation at startup (fail-fast) | -/1/1 | P1 | PLANNED |
| stabilize.rate-limits | Rate limiting on login, signup, reset, all public routes | 1/1/2 | P0 | PLANNED |
| stabilize.health-endpoint | /api/health (DB + Redis + Socket.io status) | -/1/1 | P1 | PLANNED |

### Epic B: Iran Deployment (P0) — ~4 days

| Key | Task | Est. (B/L/W) | Priority | Status |
|-----|------|-------------|----------|--------|
| stabilize.iran-vps | Iran VPS setup (PostgreSQL, Redis, Node, nginx, SSL) | 1/2/4 | P0 | PLANNED |
| stabilize.kavenegar-prod | Kavenegar OTP on Iran staging + prod | -/1/1 | P0 | PLANNED |
| stabilize.smtp-prod | SMTP for email verification + reset | -/1/1 | P0 | PLANNED |
| stabilize.deploy-iran | Deploy pipeline to Iran end-to-end | 1/1/2 | P0 | PLANNED |

### Epic C: Mobile + RTL Polish (P0) — ~3 days

| Key | Task | Est. (B/L/W) | Priority | Status |
|-----|------|-------------|----------|--------|
| stabilize.mobile-audit | No horizontal scroll, touch targets, keyboard overlap | 1/2/3 | P0 | PLANNED |
| stabilize.signal-cards-mobile | Signal cards readable on mobile | -/1/1 | P0 | PLANNED |
| stabilize.modals-mobile | Modals/sheets closable, empty states guide | -/1/1 | P1 | PLANNED |
| stabilize.rtl-tests | RTL visual regression tests | -/1/2 | P2 | PLANNED |

### Epic D: Integrity & Statements (P1) — ~2 days

| Key | Task | Est. (B/L/W) | Priority | Status |
|-----|------|-------------|----------|--------|
| stabilize.integrity-e2e | All 6 integrity conditions enforced E2E | -/1/1 | P0 | PLANNED |
| stabilize.statement-accuracy | Statement recalculation accuracy check | -/1/1 | P1 | PLANNED |
| stabilize.statement-perf | Performance test: 500+ trades | -/1/1 | P1 | PLANNED |
| stabilize.exploit-regression | Regression tests for known exploits | -/1/1 | P0 | PLANNED |

### Epic E: Alpha Test (P0) — ~7+ days

| Key | Task | Est. (B/L/W) | Priority | Status |
|-----|------|-------------|----------|--------|
| stabilize.alpha-invite | Invite 10-20 traders, create 2-3 clans | -/1/1 | P0 | PLANNED |
| stabilize.alpha-bugfix | Bug-fix buffer from alpha feedback | 3/5/7 | P0 | PLANNED |

### Gate Criteria
- [ ] Core signup + login works from Iran (OTP + email)
- [ ] Mobile RTL flows verified on real devices
- [ ] Leaderboards/statements produce correct numbers
- [ ] DB backups running, error tracking active
- [ ] Alpha group completes 7+ days without critical incidents

---

## Phase P10: Market Data Foundation

**Goal**: MT-derived price data flowing into storage, OpenRouter wrapper ready
**Estimated**: 8–10 work days
**Milestone**: PUBLIC_LAUNCH

| Key | Task | Est. (B/L/W) | Priority |
|-----|------|-------------|----------|
| market-data.mt-quote-storage | MarketPricePoint model + store from EA heartbeat | 1/1/2 | P0 |
| market-data.ohlc-aggregation | OHLC candle aggregation (1m–1d) | 1/2/3 | P0 |
| market-data.symbol-normalization | Symbol normalization resolver | -/1/2 | P1 |
| market-data.freshness-rules | Stale price warnings | -/1/1 | P0 |
| market-data.health-dashboard | Admin Market Data Health dashboard | 1/1/2 | P1 |
| market-data.openrouter-wrapper | OpenRouter client (retries, rate limits, prompt versioning, LLMRunRecord) | 1/2/3 | P0 |
| market-data.typed-contracts | MarketSnapshot, EventCard, BriefingRecord Zod schemas | -/1/2 | P0 |

### Gate Criteria
- [ ] Market prices flowing MT → DB → Redis
- [ ] OHLC candles aggregating for at least 3 timeframes
- [ ] OpenRouter wrapper tested with real API call
- [ ] Typed contracts shared across services

---

## Phase P11: News & Events (Market Intelligence)

**Goal**: Automated news aggregation with AI classification
**Estimated**: 10–12 work days
**Milestone**: PUBLIC_LAUNCH

| Key | Task | Est. (B/L/W) | Priority |
|-----|------|-------------|----------|
| news.item-model | NewsItem model + enums | -/1/1 | P0 |
| news.rss-fetcher | RSS fetcher (Investing.com, ForexLive, Al Jazeera, Reuters) | 1/2/3 | P0 |
| news.api-fetcher | Finnhub + NewsData.io fetcher | 1/1/2 | P0 |
| news.dedup-engine | Dedup engine (externalId hash) | -/1/1 | P0 |
| news.ai-classifier | OpenRouter AI classifier | 1/2/2 | P0 |
| news.cron-worker | Cron worker (every 2 min) | 1/1/2 | P0 |
| news.api-endpoint | GET /api/news (paginated, filterable) | -/1/1 | P1 |
| news.image-proxy | Image proxy (no external CDN) | -/1/1 | P1 |
| news.page-ui | /news page UI | 1/2/3 | P1 |
| news.admin-posting | Admin EventCard posting tool | -/1/1 | P1 |

---

## Phase P12: Market Copilot

**Goal**: AI-generated daily briefings grounded in real market data
**Estimated**: 8–10 work days
**Milestone**: PUBLIC_LAUNCH

| Key | Task | Est. (B/L/W) | Priority |
|-----|------|-------------|----------|
| copilot.context-builder | ContextBuilder (MarketSnapshot from MT + news) | 1/2/3 | P0 |
| copilot.daily-briefing | Daily briefing generator | 1/2/3 | P0 |
| copilot.briefing-ui | Briefing UI + share to clan | 1/2/2 | P1 |
| copilot.asset-briefing | Per-asset mini-briefing | 1/2/2 | P1 |
| copilot.prompt-versioning | Prompt versioning + A/B testing | -/1/2 | P1 |

---

## Phase P13: Vibe Validator (Paper-First)

**Goal**: Users input trading "vibes", get structured paper trade plans
**Estimated**: 10–12 work days
**Milestone**: POST_LAUNCH

| Key | Task | Est. (B/L/W) | Priority |
|-----|------|-------------|----------|
| vibe.input-ui | Vibe input UI | -/1/2 | P1 |
| vibe.parsed-vibe | ParsedVibe extraction via OpenRouter | 1/2/3 | P1 |
| vibe.trade-plan | TradePlanCandidate (deterministic math, LLM never sizes) | 1/2/3 | P0 |
| vibe.paper-position | PaperPositionRecord (snapshot locked) | 1/2/2 | P1 |
| vibe.paper-lifecycle | Paper position lifecycle (MT-derived prices) | 1/2/3 | P1 |
| vibe.outcome-scoring | OutcomeRecord scoring | 1/2/2 | P1 |

**Anti-loophole rules**: Snapshot ID locked at creation, no retroactive scoring, calc version stored on every output, LLM never does position sizing or R:R calculation.

---

## Phase P14: Paper Trading & Replay

**Estimated**: 6–8 work days | **Milestone**: POST_LAUNCH

| Key | Task | Est. (B/L/W) | Priority |
|-----|------|-------------|----------|
| paper.portfolio-dashboard | Paper portfolio (positions, P&L, history) | 1/2/3 | P1 |
| paper.replay-ui | Replay: vibe → snapshot → plan → outcome | 1/2/3 | P2 |
| paper.vibe-score | VibeScoreProfile (rolling accuracy) | 1/2/3 | P2 |

---

## Phase P15: Behavioral Coach & Watcher

**Estimated**: 8–10 work days | **Milestone**: POST_LAUNCH

| Key | Task | Est. (B/L/W) | Priority |
|-----|------|-------------|----------|
| coach.behavioral-insights | Trade history analysis (overtrading, revenge, patterns) | 2/3/5 | P2 |
| coach.weekly-digest | Automated weekly coaching digest | 1/2/3 | P2 |
| coach.watch-tasks | User-defined watch conditions | 1/2/3 | P2 |
| coach.alert-pipeline | Alert pipeline (Socket.io + email) | 1/2/2 | P2 |

---

## Phase P16: Execution Bridge (Later)

**Estimated**: 6–8 work days | **Milestone**: POST_LAUNCH

| Key | Task | Est. (B/L/W) | Priority |
|-----|------|-------------|----------|
| execution.send-to-mt | Send plan to MT (pending action, requires confirm) | 1/2/3 | P2 |
| execution.money-management | Money management presets + guardrails | 1/2/3 | P2 |
| execution.kill-switch | Emergency close all positions | -/1/2 | P2 |
| execution.journal | Auto-log all executed trades with context | -/1/2 | P2 |

---

## Timing Summary

| Phase | Work Days (likely) | Cumulative |
|-------|-------------------|------------|
| P9: Stabilization & Alpha | 18–22 | 18–22 |
| P10: Market Data | 8–10 | 28–32 |
| P11: News & Events | 10–12 | 40–44 |
| P12: Copilot | 8–10 | 50–54 |
| P13: Vibe Validator | 10–12 | 62–66 |
| P14: Paper Trading | 6–8 | 70–74 |
| P15: Coach & Watcher | 8–10 | 80–84 |
| P16: Execution Bridge | 6–8 | 88–92 |

**Total**: ~88–92 work days (~4–5 months at 8hrs/day)

**P9 + P10 + P11** (usable product with news): ~40–44 work days (~2 months)

---

## Constraints

- **No external price APIs** — MT EA heartbeats are the primary price source
- **All LLM calls via OpenRouter** — single wrapper with logging, retries, prompt versioning
- **Iran-safe** — server-side fetching only, self-hosted fonts, no external CDN
- **Anti-loophole** — snapshot IDs locked at creation, deterministic math only, full audit trail
- **Evidence-based status** — features marked OPERABLE only after production verification
