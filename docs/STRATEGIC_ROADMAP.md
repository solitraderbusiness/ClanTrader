> **Status:** ACTIVE
> **Last reviewed:** 2026-03-15
> **Authority:** SOURCE_OF_TRUTH.md
> **Notes:** Strategic roadmap for ClanTrader. Reorganizes all current work and 60+ post-MVP ideas into a 7-phase execution plan.

# ClanTrader — Strategic Roadmap

---

## 1. Executive Verdict

**Where we are:** Phase 1 (Trust Foundation) is ~95% complete. 88+ features shipped, 823 unit tests, 30+ DB models, 14 digest engines, 5-layer source-aware price cache, 12 loophole fixes, 49 services — all running on dev. This is not a prototype. It is a feature-complete competitive trading platform missing only production infrastructure and payments.

**The strategic thesis:** ClanTrader's moat is its integrity engine and verified performance data. No competitor has a 7-condition deny-by-default system with frozen risk snapshots, 20-second qualification windows, source-aware pricing, and cross-user heartbeat fallback — all running live. Phases 1–3 strengthen and monetize that data moat. Phases 4–5 build intelligence layers on top. Phases 6–7 add AI as the top interaction layer.

**The product is NOT a social feed app.** The early experience should be closer to a performance/rankings discovery platform (think ZuluTrade with integrity guarantees), not a Telegram clone with trade cards. The command center comes later, when the data layers are strong enough to power it.

**Revenue ladder:**
- Phase 2: Affiliate / broker referral (zero gateway cost, referral tracking already exists)
- Phase 3–4: Pro subscriptions (news intelligence, advanced digest, unlimited alerts)
- Phase 5–7: Premium AI / Vibe (highest margin, longest runway)

| Phase | Name | Est. Duration | Revenue Model | Key Metric |
|-------|------|---------------|---------------|------------|
| 1 | Trust Foundation | **Done** (95%) | None | Integrity rate, users |
| 2 | Launch + Early Revenue | 4–6 weeks | Affiliate, referral | Beta users, first $ |
| 3 | News / Events Layer | 3–4 weeks | Pro subscriptions | DAU, retention |
| 4 | Command Center | 4–6 weeks | Pro upsell, ZarinPal | Engagement, conversion |
| 5 | Sentiment + AI Foundation | 4–6 weeks | Premium tier | AI interaction rate |
| 6 | Vibe Trading Alpha | 6–8 weeks | Premium AI | Vibe accuracy |
| 7 | Full Vibe Trading | Ongoing | Premium AI | Revenue per user |

**Timeline reality check:** Phase 1 took ~6 weeks of solo development (Feb–Mar 2026). Remaining phases vary from 3–8 weeks each. Total estimated runway to Phase 5: 5–7 months. Phases 6–7 are aspirational and depend on Phase 5 success.

---

## 2. What "Integrity" Means in ClanTrader

**Definition:** Integrity is the set of mechanisms that prevent false, stale, incomplete, or misleading trading data from appearing true.

This is NOT just "data validation." It is the entire trust architecture that makes ClanTrader's performance data credible enough to compete on. Without it, the platform is just another unverifiable leaderboard.

### Integrity Mechanisms (All LIVE)

| Mechanism | What It Prevents | Implementation |
|-----------|-----------------|----------------|
| **7-condition deny-by-default** | Unverified trades appearing in statements | `integrity.service.ts` — all 7 must pass for `statementEligible = true` |
| **20-second qualification window** | Retroactive signal creation after seeing outcome | `signal-qualification.service.ts` — missed = analysis-origin forever |
| **Frozen risk snapshots** | Post-hoc SL/TP editing to fake better R:R | `officialEntry/SL/TP/RiskAbs/RiskMoney` — mutable within 20s, immutable after |
| **Source-aware pricing** | Cross-broker price manipulation in trade close | `price-pool.service.ts` — verification-grade prices never cross-source |
| **Duplicate ticket detection** | Double-counting trades across accounts | Integrity condition #6 |
| **Signal-before-trade rule** | Claiming a trade was signaled after the fact | Integrity condition #4 — card must pre-exist MT trade open |
| **Stale data guards** | Outdated heartbeat appearing as live data | Tracking status (ACTIVE/STALE/TRACKING_LOST), `isEstimated` flags |
| **Cash-flow-neutral performance** | Deposits inflating P&L%, withdrawals deflating it | `balance-event.service.ts` — TWR/NAV parallel tracking |
| **Effective rank penalty** | Hiding open losses behind clean closed record | `effectiveRankR = closedOfficialR + openLossPenaltyR` — losses penalize, profits don't help |
| **Tracking status degradation** | Ranking traders with stale data as if reliable | RANKED → PROVISIONAL (stale) → UNRANKED (lost tracking) |
| **Resolution source verification** | Manual trade resolution bypassing verification | Only EA_VERIFIED or EVALUATOR sources count (not MANUAL) |
| **Heartbeat fallback freshness gate** | Fake estimated data poisoning equity charts | Only FALLBACK_FRESH (<90s) creates chart-eligible snapshots |

### What Tasks Belong in "Integrity"

Any task that touches: verification rules, stale-data guards, source-aware logic, qualification rules, official snapshot truth, unknown/uncertain state handling, deny-by-default behavior, anti-manipulation measures, or audit trails.

**Examples:** Ghost trade resolution (stale trade state), close price correction (data accuracy), re-qualification within window (snapshot truth), balance event detection (cash-flow integrity).

---

## 3. Phase-by-Phase Strategy Map

---

### Phase 1 — Trust Foundation

**Status: 95% Complete**

**Goal:** Build the verified, tamper-resistant, publicly auditable trading data that everything else depends on.

**Why it matters:** Without trust, the platform is just another unverifiable leaderboard. Every later phase — news, command center, AI, vibe trading — depends on this data being credible.

**What belongs in Phase 1:**
- Signal qualification + frozen snapshots ✅
- 7-condition integrity contract ✅
- Auto-generated statements from MT data ✅
- Leaderboards (6 lenses + composite + effective rank) ✅
- Badges (rank/performance/trophy) ✅
- Live open risk overlay ✅
- Activity Digest v2.5 (14 engines, price ladder, equity curve) ✅
- Journal (equity curve, calendar, streaks, breakdowns) ✅
- Trader/clan discovery (Explore page with performance metrics) ✅
- Notifications + price alerts ✅
- Heartbeat fallback + cross-user price pool ✅
- Deposit/withdrawal detection (TWR/NAV) ✅
- Ghost trade resolution (Phase 1: advisory chat message) ❌ NOT DONE

**What does NOT belong in Phase 1:**
- News/RSS feeds
- AI features
- Payment processing
- Home feed redesign
- Market data pipeline

**Key dependencies:** None — this is the foundation.

**Monetization relevance:** None directly, but all future monetization depends on Phase 1 being solid.

**Remaining 5% to close:**

| Item | Effort | Priority |
|------|--------|----------|
| Ghost trade resolution (advisory chat message when fallback crosses SL/TP) | 1–2 days | HIGH |
| Admin impersonation audit trail | 0.5 day | MEDIUM |
| API key hashing (currently plaintext) | 0.5 day | MEDIUM |
| Minimum moderation (admin: delete messages, ban users) | 1–2 days | HIGH |

**Exit criteria:**
- [ ] Ghost trade Phase 1 implemented
- [ ] Admin impersonation logs to audit trail
- [ ] Basic moderation tools exist (admin message delete, user ban)
- [ ] All existing unit tests pass (823+)
- [ ] Build clean, lint clean

---

### Phase 2 — Launch + Early Revenue

**Goal:** Get to production, get real users, generate first revenue without building a payment gateway.

**Why it matters:** 88 features on a dev server is risk, not progress. Revenue validates product-market fit faster than features. A single dollar of affiliate revenue proves more than 10 more features.

**What belongs in Phase 2:**

**Sub-phase 2A — Production Infrastructure (weeks 1–2):**
- Germany VPS setup (PostgreSQL, Redis, Node, PM2, Nginx, SSL)
- Deploy pipeline end-to-end (pack, scp, staging, promote)
- SMTP for production email
- `/api/health` endpoint
- Automated PostgreSQL backups (pg_dump cron, 7-day retention)
- Structured logging (Pino) — from Ideas list, pulled forward
- Production Sentry + Telegram alerts (production-only mode) — from Ideas list
- CI/CD pipeline (GitHub Actions: lint + type-check + unit tests on PR)

**Sub-phase 2B — Beta Test (weeks 2–3):**
- Invite 10–20 beta traders, monitor, fix critical feedback
- Ghost trade resolution Phase 2 (auto-evaluate after 7 days TRACKING_LOST)
- Final notification sensitivity tuning

**Sub-phase 2C — Early Revenue (weeks 3–6):**
- Broker affiliate/referral program (referral tracking already exists — just need partner agreements and conversion dashboard)
- Enforce PaywallRule on gated features (model already exists, admin UI works, zero enforcement currently)
- Pro tier definition: free vs pro feature split

**What does NOT belong in Phase 2:**
- ZarinPal (defer to Phase 4)
- News ingestion
- AI features
- Home feed redesign
- New social features

**Key dependencies:** Germany VPS procurement, broker partner agreement

**Monetization:** Affiliate/broker referral commission (zero gateway cost). PaywallRule enforcement as pro tier gating.

**Exit criteria:**
- [ ] Production running on Germany VPS for 14+ days
- [ ] 20+ active users
- [ ] First affiliate revenue generated
- [ ] PaywallRule enforced on at least one feature
- [ ] Zero data loss incidents
- [ ] CI/CD pipeline running on PRs

---

### Phase 3 — News / Events Layer

**Goal:** Add the information layer that traders need to make decisions, making ClanTrader the place you go to understand the market — not just track trades.

**Why it matters:** Traders currently go to Telegram channels, Investing.com, and ForexLive for market context. ClanTrader should aggregate this, classify it by relevant instruments, and present it alongside their own trade data. This is the first "intelligence" layer and the first strong argument for a Pro subscription.

**What belongs in Phase 3:**

**Sub-phase 3A — News Ingestion (weeks 1–2):**
- `NewsItem` model (category, instruments[], impact, sentiment, source, publishedAt)
- RSS fetcher service (ForexLive, Investing.com, relevant Farsi finance sites)
- API fetcher (Finnhub or NewsData.io) — secondary source
- News dedup engine (externalId hash)
- News cron worker (every 2–5 minutes, server-side)
- News image proxy (serve external images through server — Iran-safe)

**Sub-phase 3B — News UI + Classification (weeks 2–3):**
- News API endpoint (`GET /api/news` with pagination, instrument filter)
- News page UI (`/news` replacing static `/geo-news`)
- Admin manual EventCard posting (leaders post curated market events)
- **AI news classifier** — FIRST AI FEATURE. Uses OpenRouter to classify each news item by: category, instruments affected, impact (low/medium/high), sentiment (bullish/bearish/neutral). Cheapest possible AI usage (classification, not generation).

**Sub-phase 3C — Market Context Integration (weeks 3–4):**
- News linked to instruments being traded ("XAUUSD news" when clan has gold positions)
- Economic calendar UI improvement (backend sync already exists from MT5 EA)
- Season results page (now meaningful — a season has completed)
- OpenRouter client wrapper (retries, rate limits, cost tracking) — infrastructure for Phase 5+
- LLMRunRecord model (cost, latency, token usage tracking) — infrastructure for Phase 5+

**What does NOT belong in Phase 3:**
- Daily AI briefing generation (Phase 5)
- Fundamentals reasoning blocks (Phase 4–5)
- Command center dashboard (Phase 4)
- Vibe/paper trading (Phase 6)

**Key dependencies:** OpenRouter API access, RSS feed sources, at least one broker data API

**Monetization:** Pro tier — AI-classified news by instrument, unlimited price alerts, advanced digest analysis, full journal features. Free tier — basic news feed, 5 price alerts.

**Exit criteria:**
- [ ] News items flowing from at least 2 sources
- [ ] AI classification running on all news items
- [ ] OpenRouter wrapper tested with cost tracking active
- [ ] News page live and filterable by instrument
- [ ] Pro subscription active with at least 1 paying user

---

### Phase 4 — Command Center

**Goal:** Transform the homepage from a simple feed into an intelligent trading dashboard that replaces a trader's 10-tab morning workflow.

**Why it matters:** Phase 3 brings external information in. Phase 4 organizes ALL information (personal trades, clan activity, news, prices, alerts) into a single command center. This is the strongest Pro subscription driver.

**What belongs in Phase 4:**

**Sub-phase 4A — Intelligent Homepage (weeks 1–2):**
- Redesigned home as multi-panel dashboard:
  1. Your positions summary with live P&L
  2. News for your instruments
  3. Clan activity stream
  4. Price alerts status
  5. Today's economic events
- Watchlist enhancement (real-time prices from price pool, news count per instrument)
- Compare views (your performance vs clan average, vs top trader)
- Best clans/traders by asset (filterable intelligence panels)

**Sub-phase 4B — Market Data Pipeline (weeks 2–4):**
- `MarketPricePoint` model (persistent historical price storage)
- OHLC candle aggregation (1m/5m/1h/4h/1d — start with top 20 instruments)
- Symbol normalization resolver (cross-broker: XAUUSD vs GOLD vs GOLD.m)
- Market data health dashboard (admin: coverage, staleness, symbol mapping)

**Sub-phase 4C — Full Monetization (weeks 4–6):**
- ZarinPal payment gateway integration
- Subscription checkout flow
- Subscription management (upgrade/downgrade/cancel)
- Invoice generation
- Channel subscription marketplace (clan leaders sell premium channel access)
- PaywallRule enforcement on all gated features

**What does NOT belong in Phase 4:**
- AI briefing generation (Phase 5)
- Sentiment analysis (Phase 5)
- Paper/vibe trading (Phase 6)
- Request Analysis marketplace (Phase 5+)

**Key dependencies:** Phase 3 news data, ZarinPal merchant account

**Monetization:** ZarinPal subscriptions (Pro tier), channel marketplace revenue share, expanded paywall enforcement.

**Exit criteria:**
- [ ] Homepage dashboard live with multi-panel layout
- [ ] OHLC candles aggregating for at least 3 timeframes
- [ ] ZarinPal checkout working end-to-end
- [ ] 10+ paying subscribers
- [ ] Symbol normalization handling top 20 instruments

---

### Phase 5 — Trader Sentiment + AI Foundation

**Goal:** Build the intelligence layers that make ClanTrader's data uniquely valuable — and lay the AI infrastructure for Phases 6–7.

**Why it matters:** Phases 1–4 generated a unique dataset: verified trade data, real-time clan positions, classified news, price history. Phase 5 adds intelligence on top. This is where ClanTrader stops being "better Myfxbook" and becomes something new.

**What belongs in Phase 5:**

**Sub-phase 5A — AI Infrastructure (weeks 1–2):**
- ContextBuilder service (assembles MarketSnapshot from: prices, positions, news, calendar, clan data)
- AI router service with failover chain
- Prompt versioning + A/B testing
- LLMRunRecord cost tracking (model ready from Phase 3)

**Sub-phase 5B — Sentiment + Briefings (weeks 2–4):**
- Clan position consensus ("8 of 12 traders are LONG XAUUSD")
- Trader sentiment by asset (aggregate direction + conviction)
- Consensus/conflict/crowding detection
- Daily briefing generator (AI, grounded in real data + news + calendar)
- Briefing UI (card-based, shareable to clan)
- Per-asset mini-briefing (short AI summary on watchlist)

**Sub-phase 5C — Behavioral Intelligence (weeks 4–6):**
- Trade analysis cards (AI) — patterns, behavioral insights from trade history
- Behavioral insights (overtrading, revenge trading, pattern recognition)
- Weekly coaching digest (AI review: what went well, what to break, focus)
- Trader insight reports (monthly: performance + behavior + market conditions)
- Chat summary generation (summarize clan chat by topic/instrument)

**What does NOT belong in Phase 5:**
- Vibe/paper trading (Phase 6)
- Direct AI chat interaction (Phase 6)
- Spectator chatbot (Phase 7 or never)

**Key dependencies:** Phase 3 OpenRouter wrapper, Phase 4 OHLC data, sufficient user activity data

**Monetization:** Premium tier — AI briefings, behavioral insights, coaching digest, sentiment dashboard. This is the highest-margin subscription tier before vibe trading.

**Exit criteria:**
- [ ] ContextBuilder producing valid MarketSnapshots
- [ ] Daily briefings generating for at least 5 instruments
- [ ] At least one behavioral insight type working end-to-end
- [ ] AI cost tracking active and under budget
- [ ] Prompt versioning with at least 2 A/B tests completed

---

### Phase 6 — Vibe Trading Alpha

**Goal:** Translate unstructured trader intuition ("vibes") into structured, backtestable paper trade plans grounded in ClanTrader's verified data.

**Why it matters:** Most traders can't articulate a structured trade plan, but they have intuitions — a direction feeling, a news event they think matters, a price level they're watching. Vibe Trading bridges that gap with AI.

**What belongs in Phase 6:**

**Sub-phase 6A — Core Vibe Loop (weeks 1–4):**
- Vibe input UI (natural language: "I think gold is going up because of Iran tensions")
- ParsedVibe extraction (AI extracts: instrument, direction, conviction, reasoning, time horizon)
- TradePlanCandidate builder (deterministic math — AI NEVER sizes positions)
- Typed contracts (Zod schemas for MarketSnapshot, EventCard, BriefingRecord)
- Paper position creation (snapshot locked at creation)
- Paper position lifecycle (track against real prices from OHLC pipeline)
- Outcome scoring (did the vibe pan out?)

**Sub-phase 6B — Vibe Profile (weeks 4–8):**
- Paper portfolio dashboard
- VibeScoreProfile (rolling accuracy: how good are your vibes?)
- Replay UI (review: vibe → market snapshot → plan → outcome)
- Clan AI assistant (@ai mention in chat)

**What does NOT belong in Phase 6:**
- Real trade execution from vibes (Phase 7)
- Kill switch (Phase 7)
- Money management presets (Phase 7)

**Anti-integrity-contamination rules:**
- Snapshot ID locked at creation — no retroactive scoring
- Calc version stored on every output — reproducible math
- LLM never does position sizing or R:R — deterministic math only
- Paper trading performance NEVER mixed with real trading statements
- Vibe scores derived from real outcome data only

**Key dependencies:** Phase 4 OHLC data, Phase 5 ContextBuilder + AI router

**Monetization:** Premium AI subscription (highest tier).

**Exit criteria:**
- [ ] Vibe input producing structured paper trades
- [ ] Paper position lifecycle tracking against real prices
- [ ] VibeScoreProfile computing for at least 10 users
- [ ] AI cost per vibe under budget target

---

### Phase 7 — Full Vibe Trading

**Goal:** AI as the top intelligence layer of ClanTrader — live command center + AI interaction + real trade execution.

**Why it matters:** This is the full vision. Not a chatbot bolted on — an AI layer that synthesizes rankings, trader data, news, fundamentals, and sentiment into actionable intelligence.

**What belongs in Phase 7:**
- Send plan to MT (convert paper trade to real trade via EA pending action, requires user confirmation)
- Emergency close all positions (kill switch)
- Execution journal (auto-log trades with AI context attached)
- Money management presets (conservative/moderate/aggressive sizing templates)
- Watch tasks (user-defined market conditions to monitor)
- Alert pipeline (alert when watch conditions are met)
- Deeper synthesis across all product layers

**What does NOT belong in Phase 7:**
- Rebuilding core infrastructure
- Re-architecting integrity (it should be settled by now)

**Key dependencies:** Phase 6 vibe loop working, Phase 4 market data pipeline

**Monetization:** Premium AI (highest margin), potential institutional/B2B licensing.

**Exit criteria:**
- [ ] MT execution bridge tested with real trades
- [ ] Kill switch tested and working
- [ ] No integrity contamination between paper and real trades
- [ ] User retention metrics justify premium pricing

---

## 4. Current Tasks Mapped to Phases

### Already Done / Mostly Done

| Task | Status |
|------|--------|
| Email + password auth | ✅ DONE |
| Phone OTP (Kavenegar) | ✅ DONE (optional) |
| Clans CRUD + roles + join/leave/switch | ✅ DONE |
| Real-time chat (Socket.io, topics, reactions, presence) | ✅ DONE |
| DMs | ✅ DONE |
| Trade cards (signal + analysis) | ✅ DONE |
| EA bridge (full lifecycle) | ✅ DONE |
| Signal qualification (20s window) | ✅ DONE |
| Integrity contract (7-condition) | ✅ DONE |
| Auto-generated statements | ✅ DONE |
| Live open risk overlay | ✅ DONE |
| Leaderboards (6 lenses + composite) | ✅ DONE |
| Badges (rank/performance/trophy) | ✅ DONE |
| Activity Digest v2.5 | ✅ DONE |
| Channel posts (full lifecycle) | ✅ DONE |
| Journal (equity curve, calendar, streaks) | ✅ DONE |
| Notifications + price alerts | ✅ DONE |
| Heartbeat fallback + cross-user price pool | ✅ DONE |
| Deposit/withdrawal detection (TWR/NAV) | ✅ DONE |
| Admin panel (9 routes) | ✅ DONE |
| i18n (EN + FA, 1200+ keys, RTL) | ✅ DONE |
| Mobile responsive | ✅ DONE |
| Referral tracking (signup events) | ✅ DONE |
| Paywall infrastructure (isPro, PaywallRule model) | ✅ DONE (not enforced) |
| Explore page with clan performance metrics | ✅ DONE |
| Kanban board | ✅ DONE |

### Phase 1 — Remaining

| Task | Source | Priority |
|------|--------|----------|
| Ghost trade resolution (advisory message) | Task brief exists | HIGH |
| Admin impersonation audit trail | SOT verification queue | MEDIUM |
| Minimum moderation (admin delete, ban) | SOT known gap | HIGH |
| API key hashing | SOT security note | MEDIUM |

### Phase 2 — Launch + Early Revenue

| Task | Source | Priority |
|------|--------|----------|
| Germany VPS setup | MVP.md Stage C | CRITICAL |
| Deploy pipeline to prod/stage | MVP.md Stage C | CRITICAL |
| SMTP for production email | MVP.md Stage C | CRITICAL |
| CI/CD pipeline (GitHub Actions) | MVP.md Stage B | HIGH |
| `/api/health` endpoint | SOT known gap | HIGH |
| Automated PostgreSQL backups | SOT known gap | HIGH |
| Structured logging (Pino) | Ideas: Infrastructure | HIGH |
| Telegram error alerts: production-only | Ideas: Infrastructure | NORMAL |
| Beta invite + monitoring | MVP.md Stage D | HIGH |
| Ghost trade auto-eval (7-day TRACKING_LOST) | Task brief exists | NORMAL |
| Referral reward system | Ideas: Monetization | HIGH |
| PaywallRule enforcement | SOT: rules exist, not enforced | HIGH |
| Broker affiliate setup | New | HIGH |
| SEO (OG tags, sitemap, canonical) | Backlog | NORMAL |

### Phase 3 — News / Events Layer

| Task | Source |
|------|--------|
| NewsItem model | Ideas: News System |
| RSS fetcher service | Ideas: News System |
| Finnhub + NewsData.io API fetcher | Ideas: News System |
| News dedup engine | Ideas: News System |
| News cron worker | Ideas: News System |
| News API endpoint | Ideas: News System |
| News image proxy | Ideas: News System |
| News page UI | Ideas: News System |
| Admin manual EventCard posting | Ideas: News System |
| Live news feed | Ideas: News System |
| OpenRouter client wrapper | Ideas: AI & Intelligence |
| AI news classifier | Ideas: AI & Intelligence |
| Season results page | Ideas: Social |
| LLMRunRecord cost tracking model | New |

### Phase 4 — Command Center

| Task | Source |
|------|--------|
| Intelligent homepage (multi-panel dashboard) | New (replaces home feed) |
| Watchlist enhancement | Existing service, needs UI |
| Compare views | New |
| Best clans/traders by asset panels | New |
| MT quote storage | Ideas: Market Data Pipeline |
| OHLC candle aggregation | Ideas: Market Data Pipeline |
| Price freshness rules | Ideas: Market Data Pipeline |
| Symbol normalization resolver | Ideas: Market Data Pipeline |
| Market data health dashboard | Ideas: Market Data Pipeline |
| ZarinPal payment gateway | Ideas: Monetization |
| Subscription checkout flow | Ideas: Monetization |
| Subscription management | Ideas: Monetization |
| Paywall enforcement (full) | Ideas: Monetization |
| Channel subscription marketplace | Ideas: Monetization |
| Invoice generation | Ideas: Monetization |

### Phase 5 — Sentiment + AI Foundation

| Task | Source |
|------|--------|
| ContextBuilder service | Ideas: AI & Intelligence |
| AI router service (failover chain) | Ideas: AI & Intelligence |
| Prompt versioning + A/B testing | Ideas: AI & Intelligence |
| Daily briefing generator | Ideas: AI & Intelligence |
| Briefing UI | Ideas: AI & Intelligence |
| Per-asset mini-briefing | Ideas: AI & Intelligence |
| Trade analysis cards (AI) | Ideas: AI & Intelligence |
| Chat summary generation | Ideas: AI & Intelligence |
| Behavioral insights | Ideas: AI & Intelligence |
| Weekly coaching digest | Ideas: AI & Intelligence |
| Trader insight reports | Ideas: AI & Intelligence |
| Clan position consensus | New |
| Trader sentiment by asset | New |
| Request Analysis marketplace | Ideas: Monetization |

### Phase 6 — Vibe Trading Alpha

| Task | Source |
|------|--------|
| Vibe input UI | Ideas: Paper/Vibe Trading |
| ParsedVibe extraction | Ideas: Paper/Vibe Trading |
| TradePlanCandidate builder | Ideas: Paper/Vibe Trading |
| Typed contracts (Zod schemas) | Ideas: Paper/Vibe Trading |
| Paper position creation | Ideas: Paper/Vibe Trading |
| Paper position lifecycle | Ideas: Paper/Vibe Trading |
| Outcome scoring | Ideas: Paper/Vibe Trading |
| Paper portfolio dashboard | Ideas: Paper/Vibe Trading |
| VibeScoreProfile | Ideas: Paper/Vibe Trading |
| Replay UI | Ideas: Paper/Vibe Trading |
| Clan AI assistant (@ai mention) | Ideas: AI & Intelligence |

### Phase 7 — Full Vibe Trading

| Task | Source |
|------|--------|
| Send plan to MT | Ideas: Paper/Vibe Trading |
| Emergency close all positions | Ideas: Paper/Vibe Trading |
| Execution journal | Ideas: Paper/Vibe Trading |
| Money management presets | Ideas: Paper/Vibe Trading |
| Watch tasks | Ideas: Paper/Vibe Trading |
| Alert pipeline | Ideas: Paper/Vibe Trading |

### Icebox / Not Needed

| Task | Reason |
|------|--------|
| Spectator AI chatbot | Low value, high maintenance, distraction risk for solo founder |
| Stories system | Social feature with no trading value — this is not Instagram |
| Add Geo Live News page with Liveuamap widget | External widget dependency violates Iran-first principle, no trading value |
| RTL visual regression tests | Nice-to-have, not blocking anything |

### Backlog — Phone OTP (keep as optional)

| Task | Status |
|------|--------|
| Kavenegar OTP on production | Ready when API key is set |
| Get Kavenegar API key for production | Admin task |
| QA: Phone OTP signup & login | After production |
| QA: Phone & email verification | After production |

---

## 5. Keep / Delay / Cut / Reframe

### KEEP — Highly Aligned with Strategy

| Task | Phase | Why |
|------|-------|-----|
| Ghost trade resolution | 1–2 | Integrity — stale trades must resolve |
| Structured logging (Pino) | 2 | Production without logs is blind |
| Referral reward system | 2 | First revenue path, infra already exists |
| PaywallRule enforcement | 2 | Pro tier gating, model already built |
| OpenRouter client wrapper | 3 | Foundation for all AI features |
| AI news classifier | 3 | First AI feature, cheapest to run |
| RSS fetcher + NewsItem model | 3 | Core Phase 3 deliverable |
| News dedup + cron | 3 | Data quality for news layer |
| News page UI | 3 | User-facing Phase 3 value |
| OHLC candle aggregation | 4 | Data pipeline for command center |
| ZarinPal payment gateway | 4 | Full monetization unlock |
| Subscription checkout flow | 4 | Pro tier revenue |
| ContextBuilder service | 5 | AI data substrate |
| Daily briefing generator | 5 | High-value AI feature |
| Behavioral insights | 5 | Unique competitive advantage |
| Vibe input + paper positions | 6 | Vision feature |

### DELAY — Good Tasks, Wrong Time

| Task | Delay Until | Why |
|------|------------|-----|
| Briefing UI | Phase 5 | Needs AI generation first |
| Per-asset mini-briefing | Phase 5 | Needs AI generation first |
| Request Analysis marketplace | Phase 5+ | Needs AI analysis generation |
| Clan AI assistant (@ai mention) | Phase 6 | Needs vibe infrastructure |
| Money management presets | Phase 7 | Part of full vibe trading |
| Send plan to MT | Phase 7 | Needs proven paper trading first |
| Season results page | Phase 3 | Needs a completed season |
| Channel subscription marketplace | Phase 4 | Needs payment gateway first |

### CUT — Remove from Active Planning

| Task | Why |
|------|-----|
| Add Geo Live News page with Liveuamap widget | External widget dependency, violates Iran-first, no trading intelligence value |
| Stories system | Social vanity feature with no trading value. ClanTrader is not Instagram. |
| Spectator AI chatbot | Low ROI, high maintenance, distraction risk. Solo founder cannot maintain a chatbot AND a vibe trading system. |

### REFRAME — Right Idea, Wrong Direction

| Task | Current Direction | Reframed Direction |
|------|------------------|-------------------|
| Home feed | Chronological post stream (Telegram-like) | **Command center dashboard** — multi-panel: positions, news, alerts, activity. NOT a social feed. Phase 4. |
| Channel subscription marketplace | ZarinPal-dependent | **Pro-gated channel access** — use existing PaywallRule + isPro. No gateway needed in Phase 2. ZarinPal checkout in Phase 4. |
| AIRouter service | Generic failover chain | **OpenRouter-first with cost tracking** — start simple in Phase 3, add failover in Phase 5 when usage justifies complexity. |
| Explore/discover page | Clan listing with basic filters | **Performance/rankings discovery** — make this the main entry experience (ZuluTrade-style). Phase 2 polish. |

---

## 6. Recommended Project Board Structure

### Columns

| Column | Purpose |
|--------|---------|
| **Current Phase** | Active work for the current phase only |
| **Ready Next** | Spec'd, estimated, ready to pull into Current Phase |
| **Needs Spec** | Idea is clear but needs task brief + acceptance criteria |
| **Blocked / Dependency** | Waiting on external (VPS, API key, partner agreement) |
| **Later Phase** | Categorized into Phase 3–7, not active |
| **Icebox / Not Now** | Explicitly parked — not deleted, not planned |
| **Strategy / Foundation** | Infrastructure tasks that span phases (logging, CI, monitoring) |
| **Cleanup / Remove** | Tasks to archive or delete from board |
| **Done** | Completed with result summary |

### Labels / Tags

| Category | Tags |
|----------|------|
| **Trust** | `trust`, `integrity`, `verification` |
| **Performance** | `rankings`, `badges`, `statements`, `leaderboard` |
| **Trading** | `digest`, `journal`, `trade-cards`, `ea-bridge` |
| **Intelligence** | `news-events`, `fundamentals`, `command-center` |
| **AI** | `sentiment`, `ai-grounding`, `vibe`, `ai-classifier` |
| **Revenue** | `monetization`, `affiliate`, `subscription`, `paywall` |
| **Technical** | `infra`, `backend`, `ux`, `data-model`, `security` |
| **Phase** | `phase-1` through `phase-7` |

### Workstream Labels (from existing board)

- `PRODUCT_CORE` — Features users interact with
- `TRUST_INTEGRITY` — Integrity, qualification, verification
- `PLATFORM_OPS` — Infra, deploy, monitoring, security
- `MONETIZATION_GROWTH` — Revenue, referrals, subscriptions
- `MARKET_INTELLIGENCE` — News, data, AI, sentiment

---

## 7. Best Practical Execution Order

This is the realistic build sequence. Not "finish Phase 1 perfectly before touching Phase 2" — but practical sequencing that a solo founder can execute.

### Immediate (This Week)

| # | Task | Days | Phase |
|---|------|------|-------|
| 1 | Ghost trade resolution (advisory chat message) | 1–2 | 1 |
| 2 | Admin impersonation audit trail | 0.5 | 1 |
| 3 | Minimum moderation (admin delete messages, ban users) | 1–2 | 1 |

### Next 2 Weeks — Production Launch

| # | Task | Days | Phase |
|---|------|------|-------|
| 4 | Germany VPS setup (PostgreSQL, Redis, Node, PM2, Nginx, SSL) | 1–2 | 2 |
| 5 | Deploy pipeline (pack, scp, staging, promote) + path fixes | 1 | 2 |
| 6 | `/api/health` endpoint | 0.5 | 2 |
| 7 | SMTP for production email | 0.5 | 2 |
| 8 | Automated PostgreSQL backups | 0.5 | 2 |
| 9 | CI/CD pipeline (GitHub Actions) | 1 | 2 |
| 10 | Structured logging (Pino) | 1 | 2 |
| 11 | Deploy to staging → smoke test → promote to production | 1 | 2 |

### Weeks 3–4 — Beta + First Revenue

| # | Task | Days | Phase |
|---|------|------|-------|
| 12 | Invite 10–20 beta traders | 0.5 | 2 |
| 13 | Monitor + fix critical beta feedback | 5 | 2 |
| 14 | PaywallRule enforcement (pick 2–3 features to gate) | 1–2 | 2 |
| 15 | Broker affiliate setup + referral dashboard | 2–3 | 2 |
| 16 | SEO (OG tags, sitemap) | 1 | 2 |

### Weeks 5–8 — News Layer

| # | Task | Days | Phase |
|---|------|------|-------|
| 17 | NewsItem model + RSS fetcher service | 2 | 3 |
| 18 | API fetcher (Finnhub/NewsData.io) + dedup | 2 | 3 |
| 19 | News cron worker + image proxy | 1 | 3 |
| 20 | OpenRouter client wrapper (retries, cost tracking) | 2 | 3 |
| 21 | AI news classifier (category, instruments, impact, sentiment) | 2–3 | 3 |
| 22 | News page UI + API endpoint | 2–3 | 3 |
| 23 | News linked to traded instruments | 1–2 | 3 |
| 24 | Pro tier launch (news + unlimited alerts + full digest) | 1 | 3 |

### Infrastructure to Prepare Early (from later phases)

These are infrastructure pieces that should be stubbed or modeled early because later phases depend on them:

| Task | When to Prepare | Needed By |
|------|-----------------|-----------|
| OpenRouter wrapper | Phase 3 | Phase 5 AI features |
| LLMRunRecord model | Phase 3 | Phase 5 cost tracking |
| MarketPricePoint model (schema only) | Phase 3 | Phase 4 OHLC pipeline |
| ContextBuilder interface (types only) | Phase 3 | Phase 5 AI grounding |

---

## 8. Founder Idea Filter

For every new idea or feature request, run this 5-question filter:

### The Filter

| # | Question | Weight |
|---|----------|--------|
| 1 | **Does this increase trust or reduce confusion?** | Highest |
| 2 | **Does this improve trader discovery or decision quality?** | High |
| 3 | **Does this create useful structured data for later AI?** | High |
| 4 | **Does this support monetization in the next 1–2 phases?** | Medium |
| 5 | **Can a solo founder maintain it without burning out?** | Medium |

### Scoring

- **3+ Yes** → Consider for current or next phase
- **2 Yes** → Park in Later Phase, revisit when relevant
- **0–1 Yes** → Icebox or Cut

### Examples

| Idea | Q1 | Q2 | Q3 | Q4 | Q5 | Verdict |
|------|----|----|----|----|----|---------|
| Ghost trade resolution | ✅ Trust | ✅ Reduces confusion | ❌ | ❌ | ✅ Easy | **KEEP** (3/5) |
| Stories system | ❌ | ❌ | ❌ | ❌ | ❌ | **CUT** (0/5) |
| AI news classifier | ❌ | ✅ Decision quality | ✅ Structured data | ✅ Pro tier | ✅ Cheap to run | **KEEP** (4/5) |
| Spectator AI chatbot | ❌ | ❌ | ❌ | ❌ | ❌ Maintenance burden | **CUT** (0/5) |
| ZarinPal gateway | ❌ | ❌ | ❌ | ✅ Revenue | ✅ One-time | **DELAY** (2/5 — Phase 4) |
| Clan position consensus | ✅ Transparency | ✅ Discovery | ✅ Sentiment data | ✅ Premium | ✅ Uses existing data | **KEEP** (5/5) |

### Red Flags (Immediate Reject)

- "This would be cool" without a user asking for it
- Requires a new external dependency in production
- Adds a background job that can fail silently
- Makes the product harder to explain in one sentence
- Requires maintaining a separate system (native app, chatbot, webhook server)

---

## 9. Final Verdict

### A) Are we mostly on the right path?

**Yes, strongly.** Phase 1 is remarkably complete for a solo founder. The integrity engine (7-condition contract, 12 loophole fixes, frozen snapshots, source-aware pricing, heartbeat fallback, cash-flow detection) is a genuine technical moat. No competitor can replicate this casually. The product architecture is sound — trust-first, deny-by-default, conservative ranking. The strategy of building trust layers before intelligence layers is correct.

### B) What is the single biggest strategic mistake right now?

**88 features on a dev server with zero real users.** The product has not been validated by anyone except the founder. Every day spent adding features to dev instead of shipping to production is a day of accumulating risk: the code grows more complex, the deployment gap widens, and there is zero feedback from real traders. Phase 2 (production launch) should have started already.

### C) What is the single most important current phase?

**Phase 2 — Launch + Early Revenue.** Not Phase 1 completion (the remaining 5% is important but not blocking). Not Phase 3 (news can wait). The most important thing is: get the product on a production server, get 20 real traders using it, and prove that the integrity story resonates. Everything else is theory until real users touch it.

### D) What is the single strongest next monetization lever?

**Broker affiliate/referral.** Zero implementation cost — referral tracking already exists in the codebase. No payment gateway needed. No subscription management. Just: partner with a broker, generate referral links, earn commission on signups/deposits. This can generate revenue in Phase 2 while ZarinPal integration waits until Phase 4.

### E) Which current ideas/tasks are the most dangerous distraction?

**AI features before production launch.** The `/api/ai/` folder should stay empty until Phase 3. The temptation to build "just one AI feature" (briefings, chat summary, analysis cards) is strong because it's exciting. But every AI feature adds: API costs, prompt maintenance, model dependency, cost tracking overhead, and a new failure mode. None of this matters if the platform has zero users.

**Second most dangerous:** Redesigning the home feed. The current home feed is functional. Redesigning it into a "command center" is a Phase 4 task that requires news data (Phase 3), market data pipeline (Phase 4), and a real user base to design for. Doing it now would be designing in a vacuum.

---

## Appendix: Irrelevant or Low-Value Tasks

Tasks specifically identified as noise, premature complexity, or strategic misalignment:

| Task | Why It's a Distraction |
|------|----------------------|
| Stories system | Social vanity feature. ClanTrader is a performance/trust platform, not a social network. |
| Spectator AI chatbot | High maintenance, low value. A chatbot is a product in itself — a solo founder can't maintain it alongside the core platform. |
| Liveuamap widget page | External dependency, no trading intelligence value, violates Iran-first principle. |
| RTL visual regression tests | Nice quality-of-have but zero user-facing value. Manual RTL testing is sufficient for current scale. |
| Phone & email QA verification | Already works optionally. Not worth dedicated QA time until user volume justifies it. |
| Multiple AI router/failover complexity | Premature optimization. Start with OpenRouter, add failover only if reliability becomes an issue in Phase 5. |
