# Task Brief — Deposit/Withdrawal Fix

> Started: 2026-03-13
> Status: IN_PROGRESS

## 1. Goal
Fix all balance-based performance metrics so deposits and withdrawals don't distort equity charts, hero P/L %, drawdown %, or any other percentage derived from account balance/equity changes.

## 2. Why it exists
When a trader deposits or withdraws money, every naive balance-based metric breaks:
- $10K account with $200 profit (2%) → withdraw $9K → naive math shows +20% return
- Equity chart shows fake cliff/spike at deposit/withdrawal boundaries
- Peak equity gets poisoned → phantom drawdown forever after withdrawal
- Competition fairness compromised (strategic withdrawals can game percentages)

## 3. Current decisions
- **Two parallel tracks**: Raw money truth (actual balance/equity) vs Performance truth (cash-flow-neutral TWR/NAV)
- **Detection formula**: `externalFlow = balanceDelta - closedTradesPnL` on each heartbeat
- **Dynamic threshold**: Tiered by account size ($1–$25), not flat
- **NAV-based drawdown**: Uses unitized NAV instead of raw peakEquity scaling
- **Adjusted chart series**: `adjustedEquity = rawEquity - cumulativeExternalFlow`
- **Conservative classification**: Ambiguous residuals → `UNKNOWN_EXTERNAL_FLOW`
- **Statement/ranking metrics SAFE**: Already 100% R-based, no fix needed

## 4. Rules touched
- EA heartbeat processing order (balance update moved after trade close detection)
- Equity drawdown tracking (NAV-based parallel track added)
- Equity curve normalization (cash-flow adjustment)
- EquitySnapshot recording (annotated with external flow data)

## 5. Files / systems involved
| File | Change |
|------|--------|
| `prisma/schema.prisma` | BalanceEvent model, MtAccount NAV fields, EquitySnapshot annotations |
| `src/services/balance-event.service.ts` | NEW: detection, TWR/NAV math, recording |
| `src/services/__tests__/balance-event.service.test.ts` | NEW: 49 unit tests |
| `src/services/ea.service.ts` | Restructured processHeartbeat() — balance update moved after detection |
| `src/services/live-risk.service.ts` | updateEquityDrawdown() unchanged (raw), NAV drawdown added |
| `src/lib/digest-engines.ts` | normalizeEquityData() + computeEquityCurveStats() adjusted for flows |
| `src/lib/digest-v2-schema.ts` | externalFlowSigned + isBalanceEventBoundary on data point |
| `src/services/digest-v2.service.ts` | Equity query includes flow annotations |
| `src/components/chat/DigestSheetV2.tsx` | Live overlay adjusted for cumulative flows |
| `scripts/backfill-balance-events.ts` | NEW: historical backfill with dry-run |

## 6. Edge cases
- First heartbeat: `initialBalance` set, no comparison possible (no previous balance)
- Trade close + deposit in same heartbeat interval: formula handles correctly
- Zero balance accounts: skipped (no detection possible)
- Very small residuals (broker noise): below threshold, ignored
- Multiple flows in quick succession: each detected independently
- Estimated snapshots (heartbeat fallback): still annotated correctly

## 7. Manual test scenarios
1. Normal trade close — verify no BalanceEvent created
2. Deposit with no trade close — verify BalanceEvent created, chart stays flat
3. Withdrawal with no trade close — same
4. Trade close + deposit — verify correct separation
5. Trade close + withdrawal — same
6. Run backfill in dry-run mode
7. Run backfill with --apply

## 8. Done definition
- BalanceEvent model in production DB
- Detection running on every heartbeat
- Equity chart doesn't spike/cliff on deposits/withdrawals
- NAV-based drawdown tracking active
- 49+ unit tests passing
- Backfill script available and tested
- SOURCE_OF_TRUTH.md updated

## 9. Open questions
- Should balance event markers be visible in the chart UI (small icons at boundaries)?
- Should we add an admin page to view/audit balance events?
- Should competitions explicitly use TWR instead of R-based ranking?

## 10. Change notes
- 2026-03-13: Task created. Schema + service + heartbeat integration + digest fix + tests + backfill implemented.
