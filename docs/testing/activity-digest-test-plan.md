# Test Plan: Activity Digest v2 — Decision Engines

> Last updated: 2026-03-11

## Manual Test Scenarios

### State Assessment Engine

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Open trades with no SL | Safety band drops (AT_RISK or CRITICAL), unprotectedCount > 0 | Not tested |
| 2 | Unknown-risk trades present | Confidence drops, unknownRiskCount reflected in metrics | Not tested |
| 3 | All trades protected with known risk | Safety = SAFE (80+), confidence HIGH | Not tested |
| 4 | Zero open trades | Safety SAFE, confidence HIGH (no risk = safe) | Not tested |
| 5 | Stale heartbeat on accounts with open trades | Safety drops, staleTradeCount > 0, tracking coverage reduced | Not tested |
| 6 | Tracking lost on account with open positions | Safety drops significantly, confidence drops | Not tested |
| 7 | Mixed: some healthy, some broken | Scores reflect proportional risk | Not tested |
| 8 | All accounts inactive | activeAccountCoverage = 0, confidence degraded | Not tested |

### Delta Engine

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 9 | First digest load (no prior snapshot) | Shows "Tracking changes from next refresh", deltas null | Not tested |
| 10 | Second load after some trades changed | Deltas show with correct direction (good/bad/neutral) | Not tested |
| 11 | needActionCount decreased | Delta shows as "good" direction (green) | Not tested |
| 12 | unknownRiskCount increased | Delta shows as "bad" direction (red) | Not tested |
| 13 | Open P/L increased | Delta shows as "good" direction | Not tested |
| 14 | Switching period tabs (today/week/month) | Each period has independent snapshot | Not tested |
| 15 | Redis unavailable | Deltas silently fail, digest still loads | Not tested |

### Risk Severity Engine

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 16 | Tracking lost with open exposure | Alert type `tracking_lost_with_exposure`, severity 85+ | Not tested |
| 17 | Account inactive with open positions | Alert generated, severity ~80 | Not tested |
| 18 | Multiple unprotected trades | Alert with severity modified by trade count | Not tested |
| 19 | Worsening trend (more issues than last check) | +10 severity modifier applied | Not tested |
| 20 | No issues present | Empty alerts array | Not tested |
| 21 | Multiple alert types present | Sorted by severity score descending | Not tested |

### Action Queue Engine

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 22 | Single critical alert | One action item shown | Not tested |
| 23 | Many alerts | Only top 3 actions shown (ACTION_MAX = 3) | Not tested |
| 24 | Actions sorted correctly | Highest priority first (severity + trend + count) | Not tested |
| 25 | No alerts | No actions block shown | Not tested |

### Member Impact Engine

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 26 | One member causing all issues | Impact score near 100, "main_risk_source" label | Not tested |
| 27 | Issues spread evenly across members | Lower individual impact scores | Not tested |
| 28 | Member recovered (no current issues) | No impact label shown | Not tested |
| 29 | Member with critical alert | +10 modifier, impact label visible | Not tested |

### UI Components

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 30 | StateStatusBar with SAFE state | Green styling, no explanation reasons | Not tested |
| 31 | StateStatusBar with CRITICAL state | Red styling, explanation reasons shown (max 3) | Not tested |
| 32 | DeltaStrip with mixed deltas | Good=green, bad=red, neutral=gray, top 5 shown | Not tested |
| 33 | TopActionsBlock renders | Numbered list, translated labels, correct action count | Not tested |
| 34 | Member impact badge | Orange badge with translated impact label | Not tested |
| 35 | RTL layout | All components use logical CSS properties (ms/me/ps/pe) | Not tested |
| 36 | Dark mode | Components visible and readable in dark theme | Not tested |

### Integration

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 37 | Today/week/month tab switching | All engines recompute for selected period | Not tested |
| 38 | Multiple clan members viewing same digest | Shared digest data, per-user deltas | Not tested |
| 39 | Digest with mixed official/unofficial trades | Correct split in cockpit, alerts only for relevant issues | Not tested |
| 40 | Many open positions (20+) | Performance acceptable, no timeout | Not tested |
| 41 | Persian language | All new keys render in Farsi | Not tested |

### MT-Specific (requires MetaTrader)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 42 | EA heartbeat goes stale mid-session | Stale alerts appear on next digest refresh | Not tested |
| 43 | EA reconnects after tracking lost | Tracking restored, impact label changes to "recovered" if applicable | Not tested |
| 44 | Open trade closed in MT | Delta shows reduced openTradeCount, closed count up | Not tested |
| 45 | New trade opened without SL in MT | Unprotected alert appears, safety score drops | Not tested |

### Concentration Analysis (Phase 2)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 46 | 3+ trades on same instrument+direction | Concentration cluster shown | Not tested |
| 47 | Multiple members in same position | Cluster shows member count | Not tested |
| 48 | Below threshold (2 trades same instrument) | No cluster shown | Not tested |
| 49 | Multiple clusters | Sorted by trade count descending | Not tested |

### Risk Budget (Phase 2+3)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 50 | Low risk (< 3R SL exposure) | Green bar, "Low exposure" | Not tested |
| 51 | High risk (6-10R SL exposure) | Orange bar, "High exposure" | Not tested |
| 52 | Critical risk (> 10R exposure) | Red bar, "Critical exposure" | Not tested |
| 53 | No open trades | Risk budget not shown | Not tested |
| 54 | MT accounts have equity data | Equity impact % shown | Not tested |

### Member Trends (Phase 2)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 55 | First digest view (no previous snapshot) | All members show "new" (no badge) | Not tested |
| 56 | Member's issues decreased | "Improving" badge (green) | Not tested |
| 57 | Member's issues increased | "Declining" badge (red) | Not tested |
| 58 | Member's issues unchanged | No trend badge (stable) | Not tested |

### Predictive Hints (Phase 3)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 59 | Safety score dropped 10+ since last check | "Safety dropped rapidly" hint shown | Not tested |
| 60 | Unknown risk count high and growing | "Unknown risk growing" hint shown | Not tested |
| 61 | No worsening trends | No hints shown | Not tested |
| 62 | First load (no previous) | No hints shown | Not tested |

### Scope Switcher (Phase 4)

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 63 | Default opens in Trader mode | Scope switcher shows Trader selected, digest shows personal data | Not tested |
| 64 | Switch to Clan mode | All sections update to clan-wide data, member breakdown appears | Not tested |
| 65 | Switch back to Trader mode | Personal view restores, member breakdown replaced with My Positions | Not tested |
| 66 | No stale clan state leaks into Trader mode | Trader hero shows personal safety/confidence, not clan-wide | Not tested |
| 67 | No stale trader state leaks into Clan mode | Clan hero shows clan-wide safety/confidence | Not tested |
| 68 | Trader with few trades but clan in bad state | Trader mode shows personal status (e.g. SAFE), not clan CRITICAL | Not tested |
| 69 | Trader with personal issues | Trader mode shows own critical state correctly | Not tested |
| 70 | Trader-only deltas work | Shows personal delta changes, not clan-wide | Not tested |
| 71 | Trader-only actions are personal | Actions reference own trades (e.g. "Add SL to 2 trades") | Not tested |
| 72 | Member breakdown hidden in Trader mode | Zone 6 shows My Positions/My Closed Trades instead | Not tested |
| 73 | Trader concentration shows own positions only | Clusters from own trades, no other members mixed in | Not tested |
| 74 | Trader attention queue personal | Only alerts for current user's issues | Not tested |
| 75 | User with zero activity in period (Trader mode) | Empty state shown | Not tested |
| 76 | User with open trades but no closed (Trader mode) | Shows open positions, no closed section | Not tested |
| 77 | One-member clan | Trader and Clan views similar but distinct (Trader has My Positions, Clan has Member Breakdown) | Not tested |
| 78 | Scope switching + period switching | Independent — can switch scope without refetch, can switch period in any scope | Not tested |
| 79 | Mobile view | Scope switcher fits cleanly on small screens | Not tested |
| 80 | RTL layout for scope switcher | Icons and text properly aligned in RTL | Not tested |
| 81 | Persian labels | Scope switcher shows Persian translations | Not tested |

## Unit Test Coverage (Implemented)

File: `src/lib/__tests__/digest-engines.test.ts`

Test groups:
- `computeStateAssessment` — score computation, band mapping, zero trades
- `computeStateMetrics` — metric counting from health results
- `createDigestSnapshot` / `createDigestSnapshotV2` — snapshot shape with member data
- `computeDeltas` — delta direction (good-when-up/down), null previous
- `generateAlerts` — per-member + aggregate + concentration alerts, severity modifiers
- `generateActions` — priority sorting, ACTION_MAX cap
- `computeMemberImpactScore` — weighted shares, zero-total exclusion
- `getMemberImpactLabel` — label thresholds
- `computeConcentration` — clustering, threshold filtering
- `computeRiskBudget` — band assignment, equity %, null cases
- `computeMemberTrend` — improving/declining/stable/new
- `computePredictiveHints` — rapid drops, worsening metrics
