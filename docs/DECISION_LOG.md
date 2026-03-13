# Decision Log — ClanTrader

Running log of in-progress decisions captured during task work.
Newest entries first.

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
