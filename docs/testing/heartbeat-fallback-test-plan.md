# Test Plan — Heartbeat Fallback

> Last updated: 2026-03-20

## Scope

Tests that the system continues providing estimated equity, floating P/L, and live risk data when a user's EA heartbeat is lost, using prices from other connected EAs via the price pool.

## Preconditions

- At least 2 MT accounts connected (Account A = test subject, Account B = price provider)
- Both accounts trading the same instrument (e.g., UKBRENT)
- Account A has open positions with known entry price, lots, SL
- Price pool is being fed by Account B's heartbeat
- Equity snapshots exist for Account A from before disconnection
- Feature flag `heartbeat_fallback` is enabled in DB

## Key implementation details

- **Freshness gate**: `FALLBACK_FRESH_THRESHOLD_MS = 90_000` (90s) — prices older than 90s are rejected
- **Snapshot quality**: `snapshotSource` (EA/FALLBACK), `estimateQuality` (FRESH/STALE/NO_PRICE), `chartEligible` (boolean)
- **Effective rank**: Status-degrade only (PROVISIONAL/UNRANKED) — R value uses last MT profit, NOT fallback prices
- **Interval**: 30s in `server.ts`, de-duplicated via `fallbackRunning` boolean

## Site scenarios

### S1: Equity curve continues with estimated data
1. Open digest for Account A's clan
2. Verify equity chart is updating (live)
3. Disconnect Account A's EA (close MT)
4. Wait 2-3 minutes
5. **Expected**: Chart continues with estimated snapshots (`snapshotSource = 'FALLBACK'`, `estimateQuality = 'FRESH'`, `chartEligible = true`)
6. **Expected**: Header values (equity change, floating P/L) continue updating

### S2: Live risk overlay uses fallback
1. Navigate to Account A's statement page
2. Disconnect Account A's EA
3. Wait 1-2 minutes
4. **Expected**: Live risk section still shows floating P/L (with `isEstimated: true`)
5. **Expected**: Values update as price moves (from Account B's heartbeat)
6. **Expected**: Prices older than 90s are NOT used for estimation

### S3: Digest cockpit shows estimated indicator
1. Open Activity Digest in Trader mode
2. Disconnect Account A's EA
3. **Expected**: Hero P/L continues updating with estimated values
4. **Expected**: Visual indicator that data is estimated

### S4: Reconnection restores verified data
1. Start with Account A disconnected (using estimated data)
2. Reconnect Account A's EA (open MT, let heartbeat resume)
3. **Expected**: Within 30 seconds, values switch to verified MT data
4. **Expected**: New snapshots have `snapshotSource = 'EA'`, `estimateQuality = null`, `chartEligible = true`
5. **Expected**: Estimated indicator disappears

### S5: No price provider available
1. Ensure Account A is the ONLY account trading that instrument
2. Disconnect Account A's EA
3. Wait for price pool cache to expire
4. **Expected**: System gracefully stops estimating — shows last known value
5. **Expected**: No crash, no fake data

## MetaTrader scenarios

### M1: Partial instrument coverage
1. Account A has positions in UKBRENT and EURUSD
2. Account B only trades UKBRENT
3. Disconnect Account A
4. **Expected**: UKBRENT positions get estimated P/L, EURUSD shows stale
5. **Expected**: Total floating P/L = estimated UKBRENT + last known EURUSD

### M2: Market closed behavior
1. Disconnect Account A during weekend
2. **Expected**: No estimated snapshots created (market_closed status from price pool)
3. **Expected**: Last known values persist, no false updates

## Edge-case scenarios

### E1: Multiple accounts, one disconnected
1. User has Account A (offline) and Account C (online, same instruments)
2. **Expected**: Account C provides verified data, Account A gets estimated from price pool
3. **Expected**: Combined equity/P/L uses verified for C, estimated for A

### E2: Effective rank status degradation
1. Account A goes offline with a losing position
2. Price moves further against the position
3. **Expected**: Ranking status degrades to PROVISIONAL (stale + open trades)
4. **Expected**: Effective rank R value does NOT change (uses last MT profit only — no fallback prices in R)
5. **Expected**: If tracking lost (≥5min) + open trades → UNRANKED

### E3: EquitySnapshot quality fields
1. Disconnect Account A
2. Wait for 2 estimated snapshots to be recorded
3. Query DB: `SELECT "snapshotSource", "estimateQuality", "chartEligible" FROM "EquitySnapshot" WHERE "mtAccountId" = 'X' ORDER BY timestamp DESC LIMIT 5`
4. **Expected**: Recent snapshots have `snapshotSource = 'FALLBACK'`, `estimateQuality = 'FRESH'` or `'STALE'`, `chartEligible` matches freshness
5. Reconnect Account A, wait for heartbeat snapshot
6. **Expected**: New snapshot has `snapshotSource = 'EA'`, `chartEligible = true`

### E4: Freshness gating (90s threshold)
1. Disconnect ALL EAs so price pool goes stale
2. Wait > 90s so all prices age past threshold
3. **Expected**: `getLiveOpenRisk()` rejects stale prices (does not estimate P/L)
4. **Expected**: `heartbeat-fallback.service.ts` classifies quality as `STALE` or `NO_PRICE`, `chartEligible = false`

## Expected results

| Scenario | Success Criteria |
|----------|-----------------|
| Equity curve continuity | No gaps in chart when EA offline (if price pool has fresh data) |
| Live risk accuracy | Estimated P/L within ~1-2% of real MT value |
| Freshness enforcement | Prices > 90s old are rejected for estimation |
| Reconnection smoothness | No visible disruption, verified data resumes |
| Data integrity | Estimated data never affects statement eligibility or integrity contract |
| Ranking honesty | Status degrades to PROVISIONAL/UNRANKED; R value unchanged |
| Graceful degradation | If no price available, shows stale warning — no fake data |

## Not yet tested (runtime only)

- UI visual distinction for estimated vs verified equity segments (data flagged, UI TBD)
- UI "estimated" indicator on digest/live-risk overlays
- Performance under high stale-account count (many disconnected users)
