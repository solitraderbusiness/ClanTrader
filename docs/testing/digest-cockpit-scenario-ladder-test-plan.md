# Test Plan — Digest Cockpit Redesign + Interactive Scenario Ladder

> Last updated: 2026-03-17

## Scope

Tests the digest cockpit redesign (Right Now / Today panels, attention queue, member/trade rows) and the new interactive scenario ladder (draggable marker, pain levels, scenario math, Define My Risk mode).

## Preconditions

- At least one user with MT account connected and open trades
- Some trades with SL, some without (for unprotected scenarios)
- At least one closed trade today (for Today panel)
- Feature branch `feature/digest-cockpit-scenario-ladder` deployed

## Digest Cockpit Tests

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Right Now panel shows floating P/L | Large prominent number, green if positive, red if negative | Not tested |
| 2 | Right Now panel shows floating R | Shows R value when computable, "—" when not | Not tested |
| 3 | Right Now panel shows current open risk | Shows risk-to-SL in $ and % of balance | Not tested |
| 4 | Right Now panel shows trades needing action | Count of AT_RISK + BROKEN_PLAN trades | Not tested |
| 5 | Right Now panel shows live confidence | HIGH/PARTIAL/LOW indicator | Not tested |
| 6 | Today panel shows realized P/L | Today's closed trade P/L | Not tested |
| 7 | Today panel shows realized R | Today's closed trade R total | Not tested |
| 8 | Today panel shows closed count | Number of trades closed today | Not tested |
| 9 | Today panel shows official win rate | Win rate of official closed trades today | Not tested |
| 10 | No snapshots → no drift shown | Start-of-day drift NOT displayed | Not tested |

## Attention Queue Tests

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 11 | Multiple tracking-lost for same member | Grouped: "MemberName — tracking lost on X trades" | Not tested |
| 12 | Repeated issues deduped | No duplicate alerts for same condition | Not tested |
| 13 | Max 5 items | Queue capped at 5, most important first | Not tested |
| 14 | Each item shows issue + member + action | Clear actionable text per item | Not tested |

## Member Row Tests

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 15 | Member row shows floating P/L | P/L number visible in collapsed row | Not tested |
| 16 | Member row shows floating R | R value visible when computable | Not tested |
| 17 | Member row shows open risk | Risk-to-SL visible | Not tested |
| 18 | Member row shows action count | Number of trades needing action | Not tested |
| 19 | Health labels are secondary | Numbers prominent, health badges smaller/muted | Not tested |

## Trade Row Tests

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 20 | Trade shows P/L prominently | Floating P/L is primary visual | Not tested |
| 21 | Trade shows R when computable | R value next to P/L | Not tested |
| 22 | Trade shows risk to SL | Distance/risk to current SL | Not tested |
| 23 | Trade shows status badge | One clear badge (healthy/at-risk/etc) | Not tested |
| 24 | Trade shows recommended action | One clear action when needed | Not tested |
| 25 | Unknown R still shows P/L | P/L visible + "Risk Unknown" badge | Not tested |
| 26 | No i18n keys leak | All text properly translated | Not tested |

## Scenario Ladder Logic Tests

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 27 | Projected P/L at scenario price | Correct for LONG and SHORT trades | Not tested |
| 28 | Projected balance % | Correct: (projectedPnl - currentPnl) / balance * 100 | Not tested |
| 29 | Projected equity % | Correct: (projectedPnl - currentPnl) / equity * 100 | Not tested |
| 30 | Projected R when computable | Correct: (scenarioPrice - entry) / riskAbs for LONG | Not tested |
| 31 | Unknown-R handled honestly | Shows P/L + % but no R, with explanation | Not tested |
| 32 | Pain level -1% correct | Price where loss equals 1% of balance | Not tested |
| 33 | Pain level -2% correct | Price where loss equals 2% of balance | Not tested |
| 34 | Pain level -5% correct | Price where loss equals 5% of balance | Not tested |
| 35 | Pain level -10% correct | Price where loss equals 10% of balance | Not tested |
| 36 | Current open risk calculated | Sum of (currentPrice - SL) * lots * pointValue | Not tested |
| 37 | No-SL mode activates | Ladder shows pain levels + suggested SL when no SL | Not tested |
| 38 | Define My Risk mode | Correct SL price for 1%/2%/5% risk cap | Not tested |
| 39 | Multi-trade ladders | Correctly aggregates multiple trades same symbol | Not tested |

## Scenario Ladder UX Tests

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 40 | Current marker stays fixed | White circle at current price, not movable | Not tested |
| 41 | Scenario marker is draggable | Purple/distinct marker, draggable up/down | Not tested |
| 42 | Scenario summary updates live | Panel updates as marker moves | Not tested |
| 43 | Quick-jump chips work | Clicking "Breakeven" jumps scenario to BE price | Not tested |
| 44 | Snap points work | Marker snaps to key levels when close | Not tested |
| 45 | Mobile drag interaction | Touch drag works on mobile | Not tested |
| 46 | Desktop interaction | Mouse drag works on desktop | Not tested |
| 47 | RTL layout | Ladder and summary render correctly in RTL | Not tested |
| 48 | English/Persian i18n | All labels translated | Not tested |
| 49 | Ladder stays readable | Not cluttered with too many labels | Not tested |

## Integrity / Fallback Tests

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 50 | Unknown R never zeroed | R shows "—" or "Unknown", never 0 when not computable | Not tested |
| 51 | Tracking lost → no fake conclusions | No price-sensitive analysis for lost-tracking trades | Not tested |
| 52 | V1 fallback still works | When API returns v1 data, old UI renders | Not tested |
| 53 | V2 cockpit works | When API returns v2 data, new cockpit renders | Not tested |
| 54 | Balance unavailable → pain levels hidden | Pain levels not shown when no balance data | Not tested |

## Not Yet Tested

- Start-of-day drift metrics (deferred — no daily snapshot model)
- Profit velocity sparkline (deferred — no P/L history)
- Market context card (deferred — no candle data)
- Direct price input for scenario (deferred if not clean)
