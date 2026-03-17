# Decision Log — ClanTrader

Running log of in-progress decisions captured during task work.
Newest entries first.

---

## 2026-03-15 — Equity Chart Hardening: Stop fake flat history from stale fallback prices

- **Task:** heartbeat-fallback (hardening)
- **Decision:** Gate fallback snapshot creation on price freshness (90s threshold). Added `SnapshotSource` (EA/FALLBACK) and `EstimateQuality` (REAL/FALLBACK_FRESH/FALLBACK_STALE/NO_PRICE) enums to EquitySnapshot. Only FALLBACK_FRESH snapshots are `chartEligible`, update MtAccount.equity, and broadcast socket PnL. Stale/no-price estimates silently skipped. Chart queries filter `chartEligible: true`, use anchor baseline for normalization, and detect time gaps >10min as visual breaks.
- **Why:** Fallback service created snapshots from hours-old prices, producing fake flat dashed lines on equity charts. When fresh prices resumed, a misleading jump appeared. The fix separates "we have an estimate" from "we have a trustworthy estimate."
- **Affected files/rules:** schema.prisma (2 enums, 4 fields), heartbeat-fallback.service.ts, ea.service.ts, digest-v2.service.ts, digest-engines.ts, digest-v2-schema.ts, DigestSheetV2.tsx
- **Needs SOURCE_OF_TRUTH update now?:** yes — done in same session
- **Needs manual testing?:** yes — disconnect MT for 5+ min, verify no new flat dashed lines, reconnect and verify chart resumes with gap

---

## 2026-03-14 — Ghost Trade Resolution: Auto-evaluate disconnected trades

- **Task:** ghost-trade-resolution
- **Decision:** When a user's MT disconnects permanently, the system should auto-evaluate open trades in two phases: (1) immediate advisory chat message when fallback price crosses SL/TP, (2) auto-close via trade evaluator after 7 days of TRACKING_LOST
- **Why:** Without this, trade cards stay "open" forever if a user never reconnects, distorting statements, rankings, and live risk
- **Affected files/rules:** heartbeat-fallback.service.ts, trade-evaluator.service.ts, ea-signal-close.service.ts
- **Needs SOURCE_OF_TRUTH update now?:** no (post-MVP task, not yet implemented)
- **Needs manual testing?:** no (backlog item)

---

## 2026-03-14 — Cross-user price pool via watchSymbols/marketPrices

- **Task:** heartbeat-fallback
- **Decision:** EAs with no open trades now send market prices for symbols other users need. Server sends `watchSymbols` in heartbeat response, EA sends back `marketPrices` with bid prices from its Market Watch. Symbol names preserved in original case (MT is case-sensitive).
- **Why:** Without this, the fallback system had no fresh prices when the only connected EAs had zero open trades
- **Affected files/rules:** ea.service.ts (watchSymbols/marketPrices), price-pool.service.ts (uppercase fix), validators.ts (marketPrices schema), EA MQL4/MQL5 (ParseWatchSymbols, SymbolSelect)
- **Needs SOURCE_OF_TRUTH update now?:** yes
- **Needs manual testing?:** yes — verify aliso's trade cards show updating BTC price via ali's EA

---

## 2026-03-14 — EA download serves from public/ea/ (single-file build)

- **Task:** heartbeat-fallback
- **Decision:** The download page serves EA files from `public/ea/`, not `ea/MQL5/`. The public version is now a single merged file (no separate Include files needed). Source-of-truth EA code remains in `ea/MQL5/` with includes; `public/ea/` is the distribution copy.
- **Why:** Users couldn't compile the EA because Include files weren't available for download
- **Affected files/rules:** public/ea/ClanTrader_EA.mq5, ea/MQL5/ (source of truth)
- **Needs SOURCE_OF_TRUTH update now?:** no (infrastructure detail)
- **Needs manual testing?:** no (already verified)

---

## 2026-03-13 — Tracking Lost Notifications: Reduce Sensitivity

- **Task:** notification-alarm-mvp
- **Decision:** (1) Raise TRACKING_LOST threshold from 120s (2min) to 300s (5min). (2) Raise STALE threshold from 60s to 180s (3min). (3) Increase tracking notification cooldown from 600s (10min) to 3600s (1hr). (4) Demote TRACKING_LOST from CRITICAL to IMPORTANT severity — brief disconnects are not emergencies. (5) Keep TRACKING_RESTORED at IMPORTANT.
- **Why:** User feedback: "all of my notifications are Connection lost — too sensitive to connection." On Iranian internet, brief EA disconnects are common. The 2-minute threshold caused constant false alarms. Each flap cycle produced 2 notifications (lost + restored). The 10-min cooldown wasn't enough — users got a new pair every 10 minutes during unstable periods. The EA heartbeat runs every 30s, so a 5-minute threshold means ~10 missed heartbeats before alarming, which indicates a real problem rather than a network hiccup.
- **Affected files/rules:** `live-risk.service.ts` (thresholds), `notification-types.ts` (cooldown + severity), notification-triggers (unchanged)
- **Needs SOURCE_OF_TRUTH update now?:** no — tuning existing feature, no new capability
- **Needs manual testing?:** yes — disconnect EA for 3min (should NOT notify), disconnect for 6min (should notify), reconnect (should notify restored after 1hr cooldown window)

---

## 2026-03-13 — Notification MVP: Hardening Pass

- **Task:** notification-alarm-mvp
- **Decision:** (1) Replace `db push` with proper Prisma migration (`20260313120000_add_notifications_price_alerts`) for 3 models + 4 enums. (2) Rename "In-app notifications" toggle to "Live popups" with explicit description: "Your notification history is always available regardless of this setting." The toggle controls Socket.io real-time delivery + toasts, NOT inbox persistence. (3) Add E2E REST test (`e2e/simulator/11-notifications.spec.ts`) covering notification CRUD, preferences, price alert CRUD + validation + max limit + immediate trigger. (4) Drawdown notifications use 4 threshold levels (5%/10%/15%/20%) — only fire once per crossing direction, not repeatedly.
- **Why:** MVP was functional but had three production-discipline gaps: no migration file (risky for staging/prod deploy), ambiguous UX label (users might think OFF = no history), and no E2E test coverage. Closing these before considering the task done.
- **Affected files/rules:** `prisma/migrations/20260313120000_*`, `en.json`/`fa.json` (toggle wording), `e2e/simulator/11-notifications.spec.ts`, `SOURCE_OF_TRUTH.md`
- **Needs SOURCE_OF_TRUTH update now?:** yes — done in same session
- **Needs manual testing?:** yes — verify toggle wording on `/settings/notifications`, run E2E suite

---

## 2026-03-13 — Notification + Alarm MVP Implementation

- **Task:** notification-alarm-mvp
- **Decision:** Implement full in-app notification system with: (A) Persisted notification center (bell icon, dropdown, `/notifications` page, mark read, severity tabs), (B) Simple preferences (live popups on/off, critical-only/all), (C) Server-side price alerts (ABOVE/BELOW, 15s eval interval, source-group aware, one-time trigger), (D) 12 notification types wired from real event sources (tracking, trade close, action results, risk warnings, integrity, qualification, rank, clan). Architecture: centralized `notification.service.ts` with Redis cooldown, dynamic import pattern for fire-and-forget hooks, Socket.io user rooms for targeted delivery. No Telegram/push/email/SMS/webhooks.
- **Why:** ClanTrader had no way to inform users about important events (tracking loss, trade outcomes, risk). Price alerts are a basic expectation. Design principle: "only interrupt when something actually matters" — smart underneath, simple surface.
- **Affected files/rules:** 16 new files (services, components, API routes, pages), 12 modified services (event hooks), schema (3 models, 4 enums), ~45 i18n keys
- **Needs SOURCE_OF_TRUTH update now?:** yes — done in same session
- **Needs manual testing?:** yes — full test plan at `docs/testing/notification-alarm-mvp-test-plan.md`

---

## 2026-03-13 — Price Ladder v2.4: Asset Tabs, SHORT Fix, TP Levels, Collision Resolver

- **Task:** activity-digest
- **Decision:** Replace stacked per-symbol ladders with a single ladder + horizontal asset tab pills. Add SHORT-aware gradient inversion, Take Profit level support, data-level collision resolver (3% threshold, priority-based merging), unrealistic level filter (0.2x–2x current price), and position context line (direction · trades · lots · P/L). Auto-select tab with largest absolute P/L.
- **Why:** Stacked ladders destroyed the compact "digest" feel — 3 assets = 3x scroll. SHORT positions had inverted profit/loss semantics but used LONG gradient colors. TP levels were missing despite data being available. Levels at similar prices overlapped visually. Tiny positions on large accounts showed absurd loss prices ($69K gold for -50%).
- **Affected files/rules:** `digest-engines.ts` (computePriceLadder rewrite: TP levels, collision resolver, unrealistic filter, tradeCount, currentTP input), `DigestSheetV2.tsx` (new PriceLadderSection with tabs, PriceLadderCard SHORT gradient, context line)
- **Needs SOURCE_OF_TRUTH update now?:** no — enhancement within existing Activity Digest feature
- **Needs manual testing?:** yes — asset tab switching, SHORT gradient colors, TP level placement, collision merging behavior, unrealistic level hiding

---

## 2026-03-13 — Price Ladder v2.5: Auto-Generated Risk Context Insight

- **Task:** activity-digest
- **Decision:** Add a `generateLadderInsight()` pure function that computes a single-line risk context sentence below each Price Ladder. Uses account impact per 1% price move and distance to -10% account loss to classify into 4 tiers (Low/Moderate/Significant/High). When positions have no stop loss, appends gap risk warning. When loss levels are beyond possible price range (negative prices), shows hidden level count.
- **Why:** On large accounts with moderate positions, the -10%/-20%/-50% loss levels can appear impossibly far from current price (e.g., -10% requires a 64% price crash for UKBRENT). Without context, traders misread this as "I'm safe" when the real insight is "low leverage but no stop loss = gap risk." The insight turns a distant number into actionable understanding.
- **Affected files/rules:** `digest-engines.ts` (new `generateLadderInsight()`, updated `computePriceLadder()`, `PriceLadderData` interface), `DigestSheetV2.tsx` (PriceLadderCard renders insight)
- **Needs SOURCE_OF_TRUTH update now?:** no — enhancement within existing Activity Digest feature
- **Needs manual testing?:** yes — verify insight text accuracy for different account/position sizes

---

## 2026-03-13 — Deposit/Withdrawal Detection: TWR/NAV + Adjusted Series Architecture

- **Task:** deposit-withdrawal-fix
- **Decision:** Separate money truth from performance truth using two parallel tracks: (A) Raw balance/equity stays as broker reports, (B) Cash-flow-neutral NAV tracks trading-only performance. Detection uses `externalFlow = balanceDelta - closedTradesPnL` with dynamic account-size threshold. Equity chart adjusted by subtracting cumulative flows. NAV-based drawdown replaces raw peak equity for performance metrics.
- **Why:** Deposits/withdrawals distorted every balance-based metric. Rankings and statements were already safe (R-based), but equity chart, hero P/L %, floating %, and drawdown % were all broken. TWR/NAV is the industry-standard approach for cash-flow-neutral performance measurement. Proportional peak scaling was rejected as a hack — NAV provides a clean accounting model.
- **Affected files/rules:** `schema.prisma` (BalanceEvent model, MtAccount NAV fields, EquitySnapshot annotations), `ea.service.ts` (heartbeat restructured), `balance-event.service.ts` (NEW), `digest-engines.ts`, `digest-v2-schema.ts`, `digest-v2.service.ts`, `DigestSheetV2.tsx`
- **Needs SOURCE_OF_TRUTH update now?:** yes — done in same session
- **Needs manual testing?:** yes — deposit/withdraw on dev server and verify chart + events

---

## 2026-03-12 — Heartbeat Fallback: Use Price Pool for Background Estimation

- **Task:** heartbeat-fallback
- **Decision:** When a user's EA heartbeat is lost, the system should use the price pool (fed by all other connected EAs) to continue computing estimated equity, floating P/L, equity snapshots, and live risk data. Estimated data must be clearly labeled (`isEstimated` flag on snapshots, visual indicator in UI, PROVISIONAL ranking status). This does NOT affect signal qualification (strict 20s window), integrity contract, or statement eligibility — those remain heartbeat-only.
- **Why:** Deep research identified 13 systems affected by heartbeat loss. 6 of them (equity snapshots, live risk, effective rank, digest cockpit, socket broadcasts, ranking status) can be served by the price pool — the data exists from other users' EAs but isn't used. Users shouldn't lose data just because their personal MT connection dropped.
- **Affected files/rules:** `ea.service.ts`, `live-risk.service.ts`, `price-pool.service.ts`, `digest-v2.service.ts`, `ranking.service.ts`, `server.ts` (new background job), `schema.prisma` (EquitySnapshot.isEstimated)
- **Needs SOURCE_OF_TRUTH update now?:** yes — new system capability, affects EA bridge and live risk sections
- **Needs manual testing?:** yes — full test plan at `docs/testing/heartbeat-fallback-test-plan.md`

---

## 2026-03-12 — Activity Digest v2.3: Equity Chart Normalization + Interactive Hover

- **Task:** activity-digest
- **Decision:** Normalize equity chart Y-axis to show dollar change from period start instead of absolute values. Both equity and balance lines normalized relative to starting balance (not starting equity). Added interactive vertical crosshair + tooltip on desktop hover and fixed info bar with touch scrub on mobile.
- **Why:** Absolute values make the chart useless on large accounts — a $25K swing on a $1M account looks like a flat line. Normalized view makes the actual day's story visible regardless of account size. Interactivity lets users explore exact values at any point in time.
- **Affected files/rules:** `digest-engines.ts` (normalizeEquityData, NormalizedEquityStats, computeEquityCurveStats rewrite), `DigestSheetV2.tsx` (EquityCurveCard rewrite with SVG interactivity, module-level constants), `en.json`/`fa.json` (+2 keys)
- **Needs SOURCE_OF_TRUTH update now?:** no — enhancement within existing Activity Digest feature
- **Needs manual testing?:** yes — verify chart normalization on real account data, hover tooltip accuracy, mobile touch scrub behavior

---

## 2026-03-12 — Activity Digest v2.1: Critical pointValue fix + Equity Curve

- **Task:** activity-digest
- **Decision:** (1) Derive point value from real trade data instead of hardcoded lookup table — formula: `PL / (lots × priceChange)`. Fallback to conservative defaults only when no usable trades exist. (2) Add equity/balance curve as new Section 3. (3) Create `EquitySnapshot` model to record balance+equity every EA heartbeat. (4) Replace raw Position Profile metrics with actionable insight sentences. (5) Show `$X/pt` as hero fallback when account equity unavailable.
- **Why:** Hardcoded pointValue=100 for UKBRENT when real is ~10 caused all Price Ladder levels to be 10x compressed. Equity curve provides temporal context MT cannot show. Raw metrics without implications are noise.
- **Affected files/rules:** `digest-engines.ts` (derivePointValue, computePriceLadder rewrite), `DigestSheetV2.tsx` (HeroStats, PositionProfileCard, EquityCurveCard), `schema.prisma` (EquitySnapshot model), `ea.service.ts` (snapshot recording), `digest-v2.service.ts` (equity curve data query)
- **Needs SOURCE_OF_TRUTH update now?:** no — enhancements within existing Activity Digest feature
- **Needs manual testing?:** yes — verify Price Ladder levels against real trade math, equity curve rendering, insight sentence accuracy

---

## 2026-03-12 — Activity Digest Phase 7: v2 Visual Redesign

- **Task:** activity-digest
- **Decision:** Replaced text-heavy v1 sections with visual-first components: SVG Price Ladder thermometer, SVG donut (lot distribution), stacked bar (profit contribution), entry spread gauge. Added Price Ladder engine (Engine 14) with symbol point value lookup. Added "If all SLs hit" smart action. Positions collapsed by default.
- **Why:** v1 was too vertical, too much text, repeated what MT already shows. Price Ladder is the killer feature — shows cross-position breakeven/loss levels MT never computes.
- **Affected files/rules:** `DigestSheetV2.tsx` (5 new components, 8 old removed), `digest-engines.ts` (Engine 14 + POINT_VALUES + updated smart actions), `digest-v2-schema.ts` (currentPrice/currentSL/currentTP), `digest-v2.service.ts` (carry price data through), i18n (10+ new keys)
- **Needs SOURCE_OF_TRUTH update now?:** no
- **Needs manual testing?:** yes — SVG rendering, price ladder level accuracy, donut chart, stacked bar, mobile layout

---

## 2026-03-12 — Activity Digest Phase 6: Implementation Complete

- **Task:** activity-digest
- **Decision:** Implemented the 3-zone redesign. DigestSheetV2.tsx fully rewritten (~1900 lines). Engine 13 (Smart Actions) added to digest-engines.ts. Profit Velocity and Market Context deferred (no data). System health moved to collapsible bottom section. 37 new i18n keys added.
- **Why:** Phase 6 planning was approved — this is the execution. P/L is now the hero element, Smart Actions show trade intelligence (not system ops), system health is demoted.
- **Affected files/rules:** `DigestSheetV2.tsx` (complete rewrite), `digest-engines.ts` (+Smart Action engine), `en.json`/`fa.json` (+37 keys each)
- **Needs SOURCE_OF_TRUTH update now?:** no — visual/structural redesign of existing feature
- **Needs manual testing?:** yes — full visual review in Trader + Clan modes, all 3 zones, Smart Action accuracy, mobile layout, dark mode, RTL

---

## 2026-03-12 — Activity Digest Phase 6: Complete 3-Zone Redesign Direction

- **Task:** activity-digest
- **Decision:** Redesign the Activity Digest as a 3-zone live trading intelligence panel. Zone 1 (above fold): slim system status bar, Money Line P/L hero, Smart Actions. Zone 2 (scrollable): Position Summary, Risk Exposure, Entry Quality, Scaling Pattern, Profit Attribution, Market Context, Concentration Risk — all as dense card components. Zone 3: detailed positions + collapsible System Health at bottom. System health demoted from hero position. Smart Actions replace system-ops "Top Actions Now".
- **Why:** Current digest leads with platform health/system status and generic labels. A trader should see live P/L, risk exposure, and actionable trading insights within 5 seconds. The redesign follows "money first, insights over labels, dense but scannable" principles.
- **Affected files/rules:** `DigestSheetV2.tsx` (complete restructure into modular cards), `digest-engines.ts` (Smart Action engine needed), service/schema (mostly stable — reuse existing data pipeline)
- **Data gaps identified:**
  - NOT AVAILABLE: P/L timeline history (no per-trade snapshots), price range OHLC (candle provider is stub), point/pip value per symbol
  - AVAILABLE: account equity/balance, per-trade floatingPnl, SL/TP status, lots, openPrice, hold duration
  - Strategy: Implement Profit Velocity and Market Context as placeholder cards until data infra exists
- **Needs SOURCE_OF_TRUTH update now?:** no — still the same Activity Digest feature, redesign is visual/structural
- **Needs manual testing?:** yes — full visual review, Zone 1 above-fold fit, Smart Action accuracy, mobile layout

---

## 2026-03-11 — Activity Digest Phase 5a: Live Trading Intelligence

- **Task:** activity-digest
- **Decision:** Add live trading intelligence layers to Activity Digest — 3 new engines (entry quality, scaling pattern, concentration summary), account-aware attribution on positions, enhanced position details (lots, open price). Deferred profit quality (no P/L history) and what-if downside (no pip value tables) as not truthfully implementable with current data.
- **Why:** The digest was underpowered as a trading-intelligence tool — it told users about system maintenance (reconnect terminal, restore account) but didn't help with trading decisions. The new engines analyze entry clustering, sizing patterns, and concentration risk — things MetaTrader alone doesn't summarize for the trader.
- **Affected files/rules:** `digest-engines.ts` (3 new engines), `digest-v2-schema.ts` (6 new schema additions), `digest-v2.service.ts` (lots/account pipeline, engine wiring), `DigestSheetV2.tsx` (3 new UI blocks, account labels, position details), `en.json` + `fa.json` (30+ keys)
- **Needs SOURCE_OF_TRUTH update now?:** no — these are enhancements within the existing Activity Digest feature, not new product behavior or rule changes
- **Needs manual testing?:** yes — entry quality calculations, scaling pattern detection, concentration summary accuracy, account labels on positions

---

## 2026-03-11 — Activity Digest Phase 4: Scope-Aware Trader/Clan split

- **Task:** activity-digest
- **Decision:** Add Trader/Clan scope switcher to Activity Digest. Trader mode shows personal-only data (state, deltas, actions, concentration, alerts, positions). Clan mode preserves current clan-wide view. Default: Trader. Implementation: hybrid — server computes trader deltas/hints (needs Redis), client derives trader state/cockpit/alerts from member data using imported pure engine functions. No refetch on scope switch.
- **Why:** The digest was mixing personal and clan-wide data, causing false stress (trader sees "43 unprotected trades" when they only have 4). Separating scopes makes Trader mode emotionally accurate and personally useful, while Clan mode serves monitoring/supervision.
- **Affected files/rules:** `DigestSheetV2.tsx` (scope switcher, buildTraderView, scope-aware zones), `route.ts` (trader snapshot/delta computation), `digest-v2-schema.ts` (3 new optional fields), `en.json` + `fa.json` (4 new keys)
- **Needs SOURCE_OF_TRUTH update now?:** yes — material UX/product change (scope-aware digest is a new product behavior)
- **Needs manual testing?:** yes — scope switching, trader-only state accuracy, clan state isolation, edge cases (0 trades, one-member clan)

---

## 2026-03-11 — Activity Digest UI/UX modernization: premium dashboard redesign

- **Task:** activity-digest
- **Decision:** Complete visual redesign of DigestSheetV2.tsx — hero status card with gradient bg and large scores, modern pill tab selector, rounded-full delta pills, orange accent action panel with circular numbers, 2-column borderless metric cards, proportional concentration bars, left-accent attention items, modern member cards. Replaced Badge/Button shadcn deps with plain styled elements.
- **Why:** The current layout felt crowded, badge-heavy, and old-admin-panel-like. All data and engines were already solid — the problem was pure presentation. Redesign focuses on visual hierarchy, spacing rhythm, reduced border noise, and premium dark dashboard aesthetic. Top 30% of screen now communicates 80% of value.
- **Affected files/rules:** `DigestSheetV2.tsx` (complete V2 sub-component redesign)
- **Needs SOURCE_OF_TRUTH update now?:** no — presentation-only, no product/scope/rule change
- **Needs manual testing?:** yes — visual review of all 7 redesigned sections in light/dark/mobile/desktop

---

## 2026-03-11 — Activity Digest Phase 2+3: concentration, risk budget, trends, hints

- **Task:** activity-digest
- **Decision:** Implement 4 additional engines: concentration analysis (group trades by instrument+direction), risk budget (SL exposure bar with equity %), member trend (improving/declining from snapshot history), predictive hints (detect worsening patterns). Also added `concentration_risk` alert type and enhanced snapshots with per-member metrics.
- **Why:** Phase 1 showed state + changes + danger + actions + attribution. Phase 2+3 adds deeper intelligence: what's concentrated, how much risk is open, which members are getting better/worse, and what's accelerating in a bad direction.
- **Affected files/rules:** `digest-engines.ts` (4 new engines), `digest-v2.service.ts` (equity fetch, concentration wiring), `route.ts` (enhanced snapshots, trends, hints), `DigestSheetV2.tsx` (4 new UI components)
- **Needs SOURCE_OF_TRUTH update now?:** yes — material feature additions
- **Needs manual testing?:** yes — concentration clusters, risk budget bar, member trend badges, predictive hints

---

## 2026-03-11 — Activity Digest 5-engine architecture

- **Task:** activity-digest
- **Decision:** Implement 5 decision engines (State, Delta, Severity, Actions, Impact) as pure functions in a single file (`digest-engines.ts`)
- **Why:** Pure functions with no DB/Redis access are fully unit-testable, composable, and don't add coupling. The service wires data in, engines compute, route adds per-user deltas.
- **Affected files/rules:** `src/lib/digest-engines.ts`, `src/services/digest-v2.service.ts`, `src/app/api/clans/[clanId]/digest/route.ts`
- **Needs SOURCE_OF_TRUTH update now?:** yes — material feature addition to Activity Digest
- **Needs manual testing?:** yes — safety/confidence scores, deltas, alerts, actions, member impact all need live data verification

## 2026-03-11 — Per-user Redis snapshots for digest deltas

- **Task:** activity-digest
- **Decision:** Store per-user digest snapshots in Redis (key: `digest-snap:{clanId}:{userId}:{period}`, TTL: 24h) for delta comparison. Digest data itself uses shared 90s cache; deltas are computed per-user at route level.
- **Why:** Different users check at different times. Shared deltas would be meaningless. Per-user snapshots are lightweight (~500 bytes each) and Redis is already available.
- **Affected files/rules:** `src/app/api/clans/[clanId]/digest/route.ts`, `src/lib/digest-constants.ts`
- **Needs SOURCE_OF_TRUTH update now?:** no — covered by the engine architecture decision above
- **Needs manual testing?:** yes — first load baseline, second load deltas, period tab independence

## 2026-03-11 — Member impact score excludes zero-total dimensions

- **Task:** activity-digest
- **Decision:** When computing member impact score, if the clan has 0 total for a dimension (e.g., 0 tracking-lost trades), that dimension is excluded from the weighted average instead of producing 1/1 = 100%.
- **Why:** Including zero-total dimensions would inflate impact scores for any member, even those with no issues. Exclusion produces truthful relative scores.
- **Affected files/rules:** `src/lib/digest-engines.ts` — `computeMemberImpactScore()`
- **Needs SOURCE_OF_TRUTH update now?:** no — implementation detail
- **Needs manual testing?:** yes — verify with clan that has no tracking-lost trades

---
