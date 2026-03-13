# Task: Activity Digest — Complete Redesign for Live Trading Intelligence

> Status: IN_PROGRESS
> Started: 2026-03-11
> Last updated: 2026-03-12

## 1. Goal

Transform the Activity Digest from a data display into a **live trading intelligence panel** that feels like "a smart trading partner who just glanced at your positions and tells you the 3 things you need to know right now."

Core principle: **Money first, context over raw numbers, insights over labels, dense but scannable.**

### Design Target
- 3-zone layout: Cockpit (above fold, no scroll) → Analysis (scrollable cards) → Details (positions + system health)
- P/L is THE HERO — visible in under 5 seconds, with % of account equity context
- Smart Actions replace system-maintenance actions — driven by trading intelligence
- System health demoted to collapsible bottom section
- Bloomberg terminal aesthetic, not admin dashboard

## 2. Background

Phases 1-5a built the engine foundation: 12 pure-function engines (state, delta, severity, actions, impact, concentration, risk budget, trend, hints, entry quality, scaling pattern, concentration summary), scope-aware Trader/Clan split, account-aware attribution. Phase 6 is a complete visual/structural redesign on top of this foundation.

## 3. Decisions

- **5-engine architecture**: All engines are pure functions in `src/lib/digest-engines.ts` — no DB/Redis access, fully unit-testable
- **Per-user delta snapshots**: Stored in Redis (`digest-snap:{clanId}:{userId}:{period}`, 24h TTL). Digest data is shared (90s cache), deltas are per-user (computed at route level)
- **Severity scoring**: Base severity per alert type + modifiers (trade count, worsening trend, top-impact member)
- **Member impact**: Weighted clan-relative shares (0.35 needAction + 0.25 unknownRisk + 0.25 trackingLost + 0.15 openTrades). Dimensions with 0 clan total are excluded to prevent inflation
- **Confidence score**: `round(100 * (0.40 * trackingCoverage + 0.35 * knownRiskCoverage + 0.25 * activeAccountCoverage))`
- **Safety score**: `round(100 * (0.45 * protectionCoverage + 0.30 * safeUnknown + 0.25 * safeTracking))`
- **Best-effort deltas**: Delta computation wrapped in try/catch — never fails the digest
- **Phase 6 redesign direction**: Complete 3-zone layout — Cockpit (above fold) → Analysis (scrollable cards) → Details (positions + system health at bottom). P/L is the hero, not safety score. Smart Actions replace system-ops actions. System health demoted to collapsible bottom.
- **Data availability assessment (2026-03-12)**:
  - AVAILABLE: account equity/balance, per-trade floatingPnl, per-trade floatingR, hold duration (createdAt), SL/TP protection status, lots, openPrice, accountLabel
  - NOT AVAILABLE: P/L timeline history (no snapshots), price range high/low (candle provider is stub), yesterday's low / weekly low, point value / tick value per symbol
  - IMPLICATION: Profit Velocity sparkline, Market Context card, and what-if scenario calculations need either stub/placeholder UI or new data infrastructure
- **Component decomposition**: Planned move from monolithic DigestSheetV2.tsx (~1500 lines) to modular card components. Each zone section becomes its own component for maintainability.

## 4. Scope

### UI/UX Modernization (implemented)
- [x] Hero status card: gradient-bg, 2xl safety label, 3xl score, progress bar, confidence inline
- [x] Modern pill tab period selector (replaces Button toggle)
- [x] Delta strip: rounded-full pills, separated label+value, no border noise
- [x] Top Actions: orange accent card with circular number badges
- [x] Key metrics: 2-column grid with larger MetricCard (bg-muted/30, no borders)
- [x] Concentration: visual progress bars proportional to trade count
- [x] Attention queue: left-accent border (border-s-2) by severity, no full borders
- [x] Member cards: rounded-xl bg-muted/20, larger avatar, bold R metric, clean stats row
- [x] Visual zones with space-y-6 between major groups, space-y-3 within
- [x] Section headers: 11px uppercase tracking-wider
- [x] Removed Badge/Button shadcn dependencies (plain styled elements)
- [x] Flex layout for sheet (overflow-hidden flex flex-col, flex-1 scrollable)

### Phase 1 (implemented)
- [x] State Assessment Engine (safety score, confidence score, bands)
- [x] Delta Engine (per-user Redis snapshots, delta computation)
- [x] Risk Severity Engine (alert generation, severity scoring)
- [x] Action Queue Engine (top 3 prioritized actions)
- [x] Member Impact Engine (impact score, impact labels)
- [x] StateStatusBar UI component
- [x] DeltaStrip UI component
- [x] TopActionsBlock UI component
- [x] Member impact indicators in member rows
- [x] i18n keys (en + fa)
- [x] Zod schemas for all new types

### Phase 2 (implemented)
- [x] Concentration / risk cluster logic (Engine 6)
- [x] Risk budget visualization with progress bar (Engine 7)
- [x] Symbol/direction clustering in alerts (concentration_risk alert type)
- [x] Per-member trend states — improving/declining/stable badges (Engine 8)
- [x] Digest engines unit tests
- [x] ConcentrationBlock, RiskBudgetBar, MemberTrendBadge UI components
- [x] Equity/balance data from MT accounts for risk budget
- [x] i18n keys for concentration, risk budget, trends, hints

### Phase 3 (implemented)
- [x] Risk-budget with account equity data (equity impact %)
- [x] Predictive deterioration hints (Engine 9 — rapid drops, worsening trends)
- [x] HintsBlock UI component
- [x] Enhanced snapshots with per-member metrics for trend computation
- [ ] Start-of-day baseline comparison (deferred — needs trigger mechanism)
- [ ] Timeframe-selectable baselines (deferred — needs additional UI)
- [ ] Advanced attribution scoring (deferred — current impact scoring is sufficient)
- [ ] Deeper drill-down flows (deferred — needs trade detail page linking)

### Phase 4: Scope-Aware Digest (implemented)
- [x] Scope switcher (Trader / Clan) — pill tabs with User/Users icons
- [x] Default scope: Trader
- [x] `buildTraderView` — client-side derivation of trader-scoped DigestV2Response
- [x] Trader-only state assessment (safety score, confidence, bands from own positions)
- [x] Trader-only cockpit (floating PnL/R, risk, actions from own data)
- [x] Trader-only concentration (own positions only)
- [x] Trader-only alerts and actions (from own issues only)
- [x] Trader-only risk budget (own SL exposure)
- [x] Trader-only attention queue (filtered to own userId)
- [x] Trader-only tracking summary (own account status)
- [x] Scope-aware deltas: server computes traderDeltas with separate Redis key
- [x] Scope-aware hints: server computes traderHints from trader snapshot
- [x] Zone 6 scope split: Clan shows member breakdown, Trader shows "My Positions" directly
- [x] Schema updated: `currentUserId`, `traderDeltas`, `traderHints` fields
- [x] Route updated: trader-scoped snapshot/delta computation with `:trader` key suffix
- [x] i18n keys: scope.trader, scope.clan, myPositions, myClosedTrades (en + fa)

### Phase 5a: Live Trading Intelligence (implemented)
- [x] Engine 10: Entry Quality — weighted avg entry, entry spread %, quality label (tight/spread/wide)
- [x] Engine 11: Scaling Pattern — lot sequence analysis, pattern detection (balanced/increasing/decreasing/spike)
- [x] Engine 12: Concentration Summary — symbol/direction shares, single-exposure flags, risk level
- [x] Account-aware issue attribution: account label on every open position row (account number + broker + platform)
- [x] Lots and open price displayed in position expanded view
- [x] EntryInsightBlock UI component — cluster quality cards with avg entry, spread %, quality badge
- [x] ScalingInsightBlock UI component — pattern cards with leg count, lots, largest leg %, last leg vs avg
- [x] ConcentrationSummaryBlock UI component — risk level badge, top symbol %, direction balance, warning text
- [x] buildTraderView computes trader-scoped entry/scaling/concentration insights
- [x] Schema updated: openPrice, lots, accountLabel on positions; 3 new insight schemas on response
- [x] Service pipeline: lots/ticket from MtTrade, accountNumber/accountName from MtAccount, accountLabel construction
- [x] Fix refresh/close icon overlap (pe-10 on header row)
- [x] i18n: 30+ new keys in en.json + fa.json
- [ ] Profit quality / drawdown path (deferred — no per-trade P/L history)
- [ ] What-if downside scenarios (deferred — no pip value tables)

### Phase 7: v2 Visual Redesign — Price Ladder, Position Profile, Hero Stats (implemented)
- [x] Engine 14: Price Ladder computation — levels (Current, Half Profit, Breakeven, -10%/-20%/-50%, SL levels)
- [x] HeroStats component — 36-40px P/L with % of equity, context line
- [x] PriceLadderCard component — SVG vertical thermometer with gradient zones
- [x] PositionProfileCard component — SVG donut (lots), stacked bar (profit), entry gauge
- [x] CollapsibleSection component — reusable collapsible wrapper
- [x] CompactPositionRow component — single-line position row
- [x] "If all SLs hit" smart action (P4 priority)
- [x] Schema: currentPrice, currentSL, currentTP on open positions
- [x] Service: carry currentPrice/currentSL/currentTP through openHealthResults array
- [x] Removed text-heavy v1 sections (PositionSummary, RiskExposure, EntryQuality, ScalingPattern, ProfitAttribution, Concentration, HintsBlock, PeriodResultsCard)
- [x] i18n: ladder.title, profile.*, smart.allSLHit keys (en + fa)

### Phase 8: v2.1 Fixes + Equity Curve (implemented)
- [x] FIX 1: Price Ladder — derive pointValue from real trade data (not hardcoded)
- [x] FIX 2: Hero — show $/pt fallback when no equity, better % display
- [x] FIX 3: Position Profile — actionable insight sentences instead of raw metrics
- [x] NEW: Equity & Balance Curve — SVG chart, equity snapshots table, EA recording
- [x] FIX 4A: Smart Actions — separators between items
- [x] FIX 4B: Price Ladder — improved collision handling
- [x] FIX 4C: Position List — total row when expanded
- [x] FIX 4D: Price Ladder height / non-linear scale

### Phase 9: v2.3 Equity Chart Normalization + Interactivity (implemented)
- [x] Normalize equity chart Y-axis: plot $ change from period start (not absolute values)
- [x] Zero line representing period start balance — always visible
- [x] Dual-format Y-axis labels: `+$15,000 (+1.5%)`
- [x] Auto-scale Y-axis to fit data range with 10% padding
- [x] Interactive vertical crosshair on hover (desktop) / touch drag (mobile)
- [x] Desktop: floating tooltip with Equity, Balance, Floating P/L, Period P/L ($ + %)
- [x] Mobile: fixed info bar above chart that updates on touch scrub
- [x] Stats below chart: Peak, Low (max drawdown), Current floating — all in $ and %
- [x] `normalizeEquityData()` engine function — baseline from first snapshot's balance
- [x] `NormalizedEquityStats` with peak/low times, baseline balance, floating %
- [x] i18n: `equity.touchHint`, `equity.periodPL` keys (en + fa)

### Phase 10: v2.5 Price Ladder Risk Context Insight (implemented)
- [x] `generateLadderInsight()` engine function — computes risk context based on account/position leverage
- [x] 4 tiers: Low (<0.2%/1% move, >50% crash for -10%), Moderate (20-50%), Significant (5-20%), High (<5%)
- [x] No-SL gap risk warning appended when positions lack stop losses
- [x] Hidden loss levels note when -20%/-50% require impossible (negative) prices
- [x] `PriceLadderData.insight` and `hiddenLossLevels` fields added
- [x] `PriceLadderCard` renders insight below SVG thermometer
- [x] `computePriceLadder()` tracks hidden loss levels and generates insight per ladder

### Phase 6: Complete Redesign — 3-Zone Trading Intelligence Panel (implemented)

#### Zone 1: "The Cockpit" — Above the fold, no scrolling
- [x] 1A. System Status Bar — slim inline indicator (green/amber/red dot + "Live"/"Tracking lost"/"Stale"), replaces giant hero card
- [x] 1B. Money Line (THE HERO) — large P/L (3xl font), % of account equity, open R, SL risk, unknown risk count
- [x] 1D. Smart Actions — 2-3 trade-intelligence actions with WHY context, replaces "Top Actions Now"
  - Priority 1: No SL on profitable positions
  - Priority 2: Position size anomaly (>40% deviation from avg)
  - Priority 3: Single-asset concentration (>80% in one symbol)
  - Priority 4: Wide entry spread (>10% of current price)
  - Priority 5: No SL on non-profitable positions
  - Priority 6: Extended hold without SL (>48h)
- [ ] 1C. Profit Velocity Sparkline (DEFERRED — needs P/L history data)

#### Zone 2: "The Analysis" — Scrollable intelligence cards
- [x] 2A. Position Summary Card — grouped by symbol with stacked P/L bar, avg entry, total lots
- [x] 2B. Risk Exposure Card — unprotected P/L total, no-SL count, SL risk R
- [x] 2C. Entry Quality Card — cluster quality with avg entry, spread %, insight sentence
- [x] 2D. Scaling Pattern Card — timeline visual with lot sizes and largest leg highlight
- [x] 2E. Profit Attribution Card — P/L by trade with contribution bars and $/day efficiency
- [x] 2G. Concentration Risk Card — risk level badge, stacked direction bar, warning text
- [x] Delta Strip + Hints Block retained
- [ ] 2F. Market Context Card (DEFERRED — needs candle data)

#### Zone 3: "The Details" — Supporting data + System Health
- [x] 3A. Enhanced position list — lots, entry price, hold duration, SL/TP status per row
- [x] 3B. Period Results — conditional, hidden when no closed trades
- [x] 3C. System Health — MOVED to bottom, collapsible, contains safety bar, risk budget, actions, attention queue

#### Structural changes
- [x] DigestSheetV2.tsx rewritten as modular sub-components (~1900 lines, all in one file for now)
- [x] Smart Action Priority Engine (Engine 13) — pure function in digest-engines.ts
- [x] System health demoted from hero position to collapsible bottom section
- [x] Trader/Clan scope switcher and period tabs preserved
- [x] Dense card spacing (Bloomberg terminal aesthetic)
- [x] i18n: 37 new keys in en.json + fa.json for all Phase 6 components

#### Data infrastructure needed (not in Phase 6)
- [ ] P/L snapshot history per trade (for Profit Velocity, profit attribution by time)
- [ ] Candle/OHLC provider (for Market Context, price ranges)
- [ ] Point value per symbol (for exposure per point, what-if scenarios)

## 5. Files & Systems

| File | Change |
|------|--------|
| `src/lib/digest-engines.ts` | 14 engines + normalizeEquityData, NormalizedEquityStats: state, delta, alerts, actions, impact, concentration, risk budget, member trend, predictive hints, entry quality, scaling pattern, concentration summary, smart actions, price ladder, equity normalization |
| `src/lib/digest-constants.ts` | Snapshot prefix/TTL + risk budget thresholds |
| `src/lib/digest-v2-schema.ts` | Schemas for all engine outputs + scope-aware fields + Phase 5 insight schemas |
| `src/services/digest-v2.service.ts` | Wired all engines, equity data from MT accounts, account label construction, lots/openPrice pipeline |
| `src/app/api/clans/[clanId]/digest/route.ts` | Enhanced per-user snapshots with member metrics, trends, hints + trader-scoped snapshot/delta |
| `src/components/chat/DigestSheetV2.tsx` | Complete 3-zone rewrite: SystemStatusBar, MoneyLine, SmartActions, PositionSummary, RiskExposure, ProfitAttribution, SystemHealth (collapsed) |
| `src/lib/__tests__/digest-engines.test.ts` | Unit tests for all 13 engines |
| `src/locales/en.json` | ~137 digest keys |
| `src/locales/fa.json` | ~137 Persian translations |

## 6. Edge Cases

- No prior snapshot → show "Tracking changes from next refresh" instead of fake zeros
- Zero open trades → safety/confidence default to safe bands (no trades = no risk)
- Division by zero → all ratios use `max(denominator, 1)` fallback
- Member impact with 0 clan-total for a dimension → exclude that dimension from weighted average
- Delta for "good when down" metrics → positive delta = bad direction
- Redis failure on snapshot → silently skip deltas, return `deltas: null`
- Alert worsening detection → compare with previous snapshot if available
- High trade cluster threshold = 5 trades per member
- Scope switcher: Trader mode default, no refetch on scope change (client-side derivation)
- Trader not in members list → traderView null → empty state in Trader mode
- Trader with 0 trades → SAFE state, empty sections (correct behavior)
- One-member clan → Trader and Clan views nearly identical
- Per-member realizedPnl not available → shows "—" in trader cockpit
- Account equity null → Money Line shows P/L without % context, note "equity unavailable"
- No floatingPnl on any trade → Money Line shows "—" or "No P/L data"
- All trades have SL → smart action for "Set SL" not shown (correct behavior)
- Single trade → scaling/entry quality sections hidden (need 2+ trades)
- Position summary with multiple symbols → sort by total exposure descending
- P/L history unavailable → Profit Velocity shows placeholder ("Tracking will start from next refresh")
- Candle data unavailable → Market Context shows placeholder or is hidden
- Zero equity on account → % of equity computation skipped
- Smart Actions: system-ops actions (reconnect, restore) moved to System Health, NOT shown in Zone 1
- Mobile view: Zone 1 must fit in ~400-450px vertical space
- Period filter affects which card data is shown (today vs week vs month)
- Profit attribution by trade: uses individual trade floatingPnl, sorted by contribution descending

## 7. Test Scenarios

See `docs/testing/activity-digest-test-plan.md`

## 8. Dependencies

- Redis (for delta snapshots)
- Feature flag `digest_v2` (to enable v2 path)
- Open trade health system (`open-trade-health.ts`)
- MT heartbeat data for tracking/stale detection

## 9. Risks

- Safety/confidence scores may need tuning after real data testing
- Alert severity base scores are heuristic — may need adjustment
- Persian translations need native speaker review

## 10. Change Notes

### 2026-03-13 (Phase 10: v2.5 Price Ladder Risk Context Insight)
- Added `generateLadderInsight()` to digest-engines.ts — pure function that computes risk context
- Calculates account impact per 1% price move and distance to -10% account loss
- 4 insight tiers: Low relative risk / Moderate exposure / Significant exposure / High leverage
- No-SL warning: "No stop loss — gap risk remains" appended when unprotected
- Hidden loss levels: "(2 loss levels beyond possible price range)" when -20%/-50% require negative prices
- `PriceLadderData` extended with `insight?: string` and `hiddenLossLevels: number`
- `PriceLadderCard` renders insight text below SVG with subtle top border
- `computePriceLadder()` now tracks hidden levels and generates insight for each ladder

### 2026-03-12 (Heartbeat fallback + estimated data indicators)
- Equity chart now renders estimated data points as dashed line segments (60% opacity)
- "Estimated" badge (yellow pill) shown on chart title when any estimated data present
- Tooltip shows "Estimated" label when hovering on estimated data points
- Stats section shows "Dashed segments are estimated" hint when estimated data present
- `normalizeEquityData()` now passes through `isEstimated` from input to output
- 3 new i18n keys: estimated, estimatedTooltip, equity.estimatedSegment (en + fa)
- Integrates with heartbeat-fallback.service.ts (separate task)

### 2026-03-12 (Phase 9 implemented: v2.3 Equity Chart Normalization + Interactivity)
- Equity chart Y-axis normalized: shows $ change from period start, not absolute values
- Added `normalizeEquityData()` engine: baseline from first snapshot's balance, both equity and balance relative to same baseline
- Added `NormalizedEquityStats` type with peak/low values, times, baseline balance, floating %
- Rewrote `computeEquityCurveStats()` to return normalized stats
- EquityCurveCard completely rewritten: SVG with normalized Y-axis, zero line, auto-scaling
- Interactive hover: vertical crosshair + floating tooltip (Equity, Balance, Float, Period P/L with $ and %)
- Mobile: fixed info bar above chart with touch scrub support (onTouchMove/onTouchEnd)
- Stats section: Peak (+$X, +Y%) at time, Low (-$X, -Y%) at time, Floating P/L
- Module-level chart constants (EQ_W, EQ_H, EQ_PAD_L, EQ_CHART_W) for React hook safety
- 2 new i18n keys: equity.touchHint, equity.periodPL (en + fa)

### 2026-03-12 (Phase 7 implemented: v2 Visual Redesign)
- Added Price Ladder (Engine 14): SVG thermometer showing Current Price, Half Profit, Breakeven, -10%/-20%/-50% Account, SL levels
- Hero Stats: 36-40px P/L with % of equity + context line ("5 positions · 250L UKBRENT · 5 unprotected")
- Position Profile: SVG donut (lot distribution) + stacked bar (profit contribution) + entry spread gauge
- "If all SLs hit" smart action added as P4 priority
- Removed 8 text-heavy v1 components; replaced with 5 visual-first components
- Schema + service updated: currentPrice/currentSL/currentTP passed through to frontend
- Fixed service bug: currentPrice/currentSL/mt were out-of-scope in position push (carried through openHealthResults array)

### 2026-03-12 (Phase 8 started: v2.1 Fixes + Equity Curve)
- FIX 1: Price Ladder pointValue hardcoded at 100, should be ~10 for UKBRENT. Fix: derive from real trade data (PL / lots / priceChange)
- FIX 2: Hero shows "—%" when no equity — fallback to "$X/pt" (dollarsPerPoint = totalLots × derivedPointValue)
- FIX 3: Position Profile raw labels ("Spread: 14.47%") → actionable insight sentences ("Wide spread — averaging down")
- NEW: Equity & Balance Curve — SVG dual-line chart, equity_snapshots table, EA heartbeat recording
- FIX 4: Visual polish — smart action separators, position list total row, ladder collision handling

### 2026-03-12 (Phase 6 implemented: Complete 3-Zone Redesign)
- Complete rewrite of DigestSheetV2.tsx into 3-zone layout (Cockpit / Analysis / Details)
- Engine 13 added: Smart Action Priority Engine — 6 priority levels, top 3 shown
- Zone 1: SystemStatusBar (slim dot), MoneyLine (P/L hero with % equity + R + SL risk), SmartActionsBlock
- Zone 2: PositionSummaryCard (grouped by symbol), RiskExposureCard, EntryQualityCard, ScalingPatternCard, ProfitAttributionCard (per-trade $/day), ConcentrationCard, DeltaStrip, HintsBlock
- Zone 3: My Positions / Member Breakdown, conditional Period Results, collapsible SystemHealthSection
- System health demoted from hero to collapsible bottom section
- 37 new i18n keys (en + fa) for smart actions, money line, position summary, risk exposure, system health, profit attribution, entry/scaling insights
- Deferred: Profit Velocity sparkline (no P/L history), Market Context (no candle data)

### 2026-03-12 (Phase 6 planning)
- New design prompt received: 3-zone layout (Cockpit/Analysis/Details), P/L as hero, Smart Actions, system health demoted
- Data availability assessment completed:
  - AVAILABLE: account equity, per-trade P/L, hold duration, SL/TP status, lots, openPrice, accountLabel
  - NOT AVAILABLE: P/L timeline history, candle data (high/low ranges), pip/point values
- Phase 6 scope defined: 7 new/enhanced Zone 2 cards, Smart Action engine, Money Line hero, System Health demotion
- Placeholder strategy: Profit Velocity and Market Context cards get placeholder UI until data infrastructure exists
- Component decomposition planned: break DigestSheetV2.tsx (~1500 lines) into modular card components
- Previous phases (1-5a) provide the engine foundation — Phase 6 is a structural/visual redesign on top

### 2026-03-11 (Phase 5a: Live Trading Intelligence)
- Added 3 new pure-function engines: Entry Quality (Engine 10), Scaling Pattern (Engine 11), Concentration Summary (Engine 12)
- Account-aware attribution: every open position row now shows account label (number + broker + platform)
- Position expanded view shows lots and open price
- New UI blocks: ConcentrationSummaryBlock (risk level, % shares, direction balance, warnings), EntryInsightBlock (quality labels, avg entry, spread), ScalingInsightBlock (patterns, leg analysis)
- buildTraderView updated to compute trader-scoped entry/scaling/concentration insights
- Service pipeline updated: lots/ticket from MtTrade, accountNumber/accountName from MtAccount
- Schema: openPrice, lots, accountLabel on positions; entryInsights, scalingInsights, concentrationSummary on response
- Fixed refresh/close icon overlap in header
- 30+ i18n keys added (en + fa)
- Deferred: profit quality (needs P/L history), what-if downside (needs pip value tables)

### 2026-03-11 (Phase 4: Scope-Aware Digest)
- Added Trader/Clan scope switcher at top of digest (pill tabs with User/Users icons)
- Default scope: Trader — personal view of risk/performance/actions
- `buildTraderView()` derives full trader-scoped DigestV2Response from clan data on client
- Trader mode recomputes: state assessment, cockpit, concentration, alerts, actions, risk budget, attention queue
- Trader deltas use separate Redis snapshot key (`:trader` suffix) — computed server-side
- Zone 6 splits: Clan shows member breakdown, Trader shows "My Positions" directly
- Schema updated with `currentUserId`, `traderDeltas`, `traderHints` optional fields
- Route updated to compute trader-specific snapshots and deltas alongside clan deltas
- Engine functions imported into UI component (they're pure — no server deps)
- Scope switching is instant (no refetch, client-side computation)
- i18n: 4 new keys in en.json + fa.json

### 2026-03-11 (UI/UX Modernization)
- Complete visual redesign of DigestSheetV2.tsx
- Hero: gradient background, large safety label (2xl/3xl), progress bar, inline confidence
- Period selector: modern pill tabs instead of Button components
- Delta strip: rounded-full pills with separated label/value
- Actions: orange accent card with circular numbered badges
- Metrics: 2-column grid with larger borderless cards (bg-muted/30)
- Concentration: proportional progress bars instead of flat rows
- Attention: left-accent borders (border-s-2) by severity instead of full borders
- Members: rounded-xl cards with bg-muted tinting, larger avatars, bold R metric
- Layout: 6 visual zones with larger gaps (space-y-6) between groups
- Removed Badge and Button shadcn imports (simpler styled elements)
- Sheet uses flex layout for better scroll behavior

### 2026-03-11 (Phase 2+3)
- Phase 2+3 implemented: 4 new engines (concentration, risk budget, member trend, predictive hints)
- Concentration analysis groups open trades by instrument+direction across members
- Risk budget shows total SL exposure with progress bar + equity impact %
- Member trends computed from per-member snapshot comparison
- Predictive hints detect rapid safety/confidence drops and worsening patterns
- Enhanced snapshots include per-member metrics for trend tracking
- MT account equity/balance added to service query for risk budget
- `concentration_risk` alert type added to severity engine
- 4 new UI components + member trend badges
- Unit tests for all 9 engines
- V2 is now the default (no feature flag needed)

### 2026-03-11 (Phase 1)
- Phase 1 implemented: all 5 decision engines, 3 UI components, i18n, schemas
- Pure function pattern chosen for testability
- Per-user Redis snapshots for delta comparison
- Build verified (type-check + lint + build pass)
