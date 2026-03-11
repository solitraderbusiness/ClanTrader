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

## Unit Test Coverage (Phase 2)

Target file: `src/lib/__tests__/digest-engines.test.ts`

Planned test groups:
- `computeStateAssessment` — score computation, band mapping, edge cases
- `createDigestSnapshot` / `computeDeltas` — snapshot shape, delta direction
- `generateAlerts` — alert generation per type, severity modifiers
- `generateActions` — priority sorting, ACTION_MAX cap
- `computeMemberImpactScore` — weighted shares, zero-total handling
