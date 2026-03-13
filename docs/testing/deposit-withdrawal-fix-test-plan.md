# Test Plan — Deposit/Withdrawal Fix

> Last updated: 2026-03-13

## Scope
Tests that deposit/withdrawal detection works correctly and doesn't distort charts, drawdown, or performance metrics.

## Preconditions
- At least one MT account connected with EA running
- Some open trades for floating P/L
- `heartbeat_fallback` feature flag enabled (for fallback testing)

## Unit tests (automated — 49 tests)
Run: `npx vitest run src/services/__tests__/balance-event.service.test.ts`

Covers:
- Dynamic threshold tiers (6 tests)
- External flow detection: normal close, noise, deposit, withdrawal, combined (10 tests)
- Flow classification: deposit, withdrawal, unknown (3 tests)
- Sub-period return: normal, with deposit, with withdrawal, negative, zero (7 tests)
- TWR computation: multi-period, empty, single, compound, negative (5 tests)
- NAV update: normal, deposit-stripped, withdrawal-stripped, growth, clamping, zero (6 tests)
- NAV drawdown: at peak, below peak, new peak, zero (4 tests)
- Adjusted equity series: no flow, deposit, withdrawal, multiple, metadata (5 tests)
- Acceptance: deposit case, withdrawal case, drawdown case (3 tests)

## Site scenarios

### Scenario 1: Normal trading (no deposit/withdrawal)
1. Connect MT account, open a trade
2. Wait for several heartbeats
3. Close the trade
4. Check: No BalanceEvent created, equity chart shows normal P/L movement

### Scenario 2: Deposit detection
1. Note current balance in digest
2. Deposit money via MT terminal
3. Wait for next heartbeat (30s)
4. Check DB: `SELECT * FROM "BalanceEvent" ORDER BY "detectedAt" DESC LIMIT 1`
5. Expected: type=DEPOSIT, signedAmount > 0, metadata has detection math
6. Check digest chart: should NOT show a spike — chart should be flat at the deposit boundary

### Scenario 3: Withdrawal detection
1. Note current balance
2. Withdraw money via MT terminal
3. Wait for next heartbeat
4. Check DB: type=WITHDRAWAL, signedAmount < 0
5. Chart should NOT show a cliff

### Scenario 4: Trade close + deposit
1. Have an open trade with known floating P/L
2. Close the trade AND deposit money (within the same heartbeat interval)
3. Wait for heartbeat
4. Check: BalanceEvent should show only the deposit, not the trade P/L
5. `signedAmount ≈ deposit_amount` (not deposit + tradePnL)

## MetaTrader scenarios

### EA backward compatibility
1. Use an older EA version (without extended fields)
2. Verify heartbeat still processes normally
3. Verify balance events still detected (uses DB previous balance, not EA field)

## Edge-case scenarios

### Small residual (broker noise)
1. Close a trade where commission causes a residual < threshold
2. Verify: No BalanceEvent created (filtered by threshold)

### Multiple deposits in one day
1. Make 2-3 deposits with gaps between heartbeats
2. Verify each creates a separate BalanceEvent
3. Verify chart accumulates adjustments correctly

## Expected results
- All 49 unit tests pass
- BalanceEvent records created for real deposits/withdrawals
- No BalanceEvent for normal trade closes
- Equity chart smooth across boundaries
- NAV-based drawdown not poisoned by withdrawals
- Backfill script detects historical events in dry-run

## Not yet tested
- Competition fairness (no active competitions to test)
- Balance event markers in chart UI (not implemented yet)
- Admin audit page for balance events (not implemented yet)
- Production-scale backfill performance
