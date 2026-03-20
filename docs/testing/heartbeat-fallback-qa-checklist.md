# QA Checklist — Heartbeat Fallback Manual Verification

> Created: 2026-03-20
> Task board ID: cl3491f086dd7dd5e52fcf316
> Commit under test: 3c194bc

## Prerequisites

You need:
- 1 Admin account (you)
- 2 MT accounts connected: **Account A** (test subject) and **Account B** (price provider)
- Both accounts trading at least 1 common instrument (e.g., EURUSD or UKBRENT)
- Account A must have at least 1 open position with SL+TP set
- Market must be open (not weekend)

## Pre-flight SQL checks

Run all SQL with: `set -a; source .env; set +a; psql "$DATABASE_URL"`

### Q1: Feature flag enabled?
```sql
SELECT key, enabled FROM "FeatureFlag" WHERE key = 'heartbeat_fallback';
```
**Must return**: `enabled = true`. If missing or false, insert/update:
```sql
INSERT INTO "FeatureFlag" (id, key, name, enabled, "updatedAt")
VALUES (concat('cl', substr(md5(random()::text), 1, 23)), 'heartbeat_fallback', 'Heartbeat Fallback', true, now())
ON CONFLICT (key) DO UPDATE SET enabled = true, "updatedAt" = now();
```

### Q2: Both accounts active and heartbeating?
```sql
SELECT id, "accountNumber", "trackingStatus",
  "lastHeartbeat",
  EXTRACT(EPOCH FROM (now() - "lastHeartbeat")) AS secs_since_hb
FROM "MtAccount" WHERE "isActive" = true
ORDER BY "lastHeartbeat" DESC;
```
**Must return**: Both accounts with `trackingStatus = 'ACTIVE'`, `secs_since_hb < 180`.

### Q3: Account A has open trades?
```sql
SELECT t.id, tc.instrument, tc.direction, m."openPrice", m.lots, m.profit
FROM "Trade" t
JOIN "TradeCard" tc ON tc.id = t."tradeCardId"
LEFT JOIN "MtTradeMatch" m ON m."tradeId" = t.id AND m."isOpen" = true
WHERE t."userId" = '<ACCOUNT_A_USER_ID>'
  AND t.status IN ('PENDING', 'OPEN')
  AND t."officialSignalQualified" = true
LIMIT 10;
```
**Must return**: At least 1 row with non-null openPrice, lots.

## PM2 / Log commands

```bash
# Watch heartbeat fallback logs live
pm2 logs clantrader --lines 0 | grep -i 'HeartbeatFallback'

# Watch tracking status changes
pm2 logs clantrader --lines 0 | grep -i 'trackingStatus'

# Watch all fallback-related output
pm2 logs clantrader --lines 0 | grep -iE 'fallback|stale|tracking'

# Check recent log history
pm2 logs clantrader --lines 200 --nostream | grep -i 'HeartbeatFallback'
```

Expected log format when running:
```
[HeartbeatFallback] accounts=X prices=Y snapshots=Z pnl=P rankings=R errors=E
```

---

## Scenarios

### S1: Fresh price provider available

**What this tests**: Core fallback — Account B provides prices for Account A's instruments.

| Step | Action |
|------|--------|
| Setup | Both EAs running, both ACTIVE, Account A has open trades |
| 1 | Open Account A's statement page in browser, note live P/L values |
| 2 | Close Account A's MT terminal (kill EA) |
| 3 | Watch PM2 logs: `pm2 logs clantrader --lines 0 \| grep -i 'HeartbeatFallback'` |
| 4 | Wait 3-4 minutes (Account A transitions ACTIVE -> STALE) |
| 5 | Check statement page — does live risk section still show floating P/L? |

**DB check after ~4 min:**
```sql
SELECT "trackingStatus",
  EXTRACT(EPOCH FROM (now() - "lastHeartbeat")) AS secs_since_hb
FROM "MtAccount" WHERE id = '<ACCOUNT_A_ID>';
```
Must show `STALE` and `secs_since_hb` between 180-300.

```sql
SELECT "snapshotSource", "estimateQuality", "chartEligible",
  "isEstimated", "sourcePriceAgeMs", timestamp, balance, equity
FROM "EquitySnapshot"
WHERE "mtAccountId" = '<ACCOUNT_A_ID>'
ORDER BY timestamp DESC LIMIT 5;
```
Must show recent rows with `snapshotSource = 'FALLBACK'`, `estimateQuality = 'FALLBACK_FRESH'`, `chartEligible = true`.

**Log check**: `[HeartbeatFallback] accounts=1 prices=N snapshots=1 ...` appearing every 30s.

| Result | Criteria |
|--------|----------|
| PASS | Fallback snapshots created, estimateQuality = FALLBACK_FRESH, chartEligible = true, logs show accounts=1+ |
| FAIL (A) | No snapshots created despite stale account + fresh prices = code bug |
| FAIL (C) | Account A never goes STALE = EA still connected, test env issue |
| FAIL (B) | Snapshots created but UI doesn't show estimated indicator = UI honesty gap |

---

### S2: No price provider available

**What this tests**: Graceful degradation when no other EA has the instrument's price.

| Step | Action |
|------|--------|
| Setup | Account A has open trades in an instrument ONLY Account A trades |
| 1 | Close Account A's MT terminal |
| 2 | Wait 3-4 minutes |
| 3 | Check logs and DB |

**DB check:**
```sql
SELECT "snapshotSource", "estimateQuality", "chartEligible", timestamp
FROM "EquitySnapshot"
WHERE "mtAccountId" = '<ACCOUNT_A_ID>'
ORDER BY timestamp DESC LIMIT 5;
```

| Result | Criteria |
|--------|----------|
| PASS | No new FALLBACK snapshots for that instrument's trades, OR snapshots with `estimateQuality = 'NO_PRICE'`, `chartEligible = false` |
| PASS (alt) | If Account A trades BOTH a unique instrument AND a shared one: shared instrument gets estimated, unique one shows NO_PRICE |
| FAIL (A) | Fallback snapshots with `chartEligible = true` despite no price source = code bug |
| FAIL (C) | Another EA happens to trade the same instrument = test env limitation, re-test with truly unique instrument |

---

### S3: Stale prices older than 90s

**What this tests**: The 90s freshness gate — prices older than 90s must NOT be used for estimation.

| Step | Action |
|------|--------|
| Setup | Account A has open trades, Account B provides prices |
| 1 | Close Account A's MT terminal |
| 2 | Wait 2 minutes (Account A goes STALE, fallback starts) |
| 3 | Verify fallback is working (check logs: `snapshots=1`) |
| 4 | **Now close Account B's MT terminal** (price provider dies) |
| 5 | Wait 2 more minutes (price pool ages past 90s) |
| 6 | Check logs — snapshots should stop or show NO_PRICE quality |

**DB check after prices go stale:**
```sql
SELECT "snapshotSource", "estimateQuality", "chartEligible",
  "sourcePriceAgeMs", timestamp
FROM "EquitySnapshot"
WHERE "mtAccountId" = '<ACCOUNT_A_ID>'
ORDER BY timestamp DESC LIMIT 10;
```

After Account B dies, recent snapshots should show `estimateQuality = 'FALLBACK_STALE'` or `'NO_PRICE'`, `chartEligible = false`.

**Live risk check** — the 90s gate in `getLiveOpenRisk()`:
```sql
-- Check if live risk is still computing estimated P/L
-- (runtime only — observe the statement page)
```
Statement page should show stale warning, NOT estimated P/L, after prices age past 90s.

| Result | Criteria |
|--------|----------|
| PASS | After Account B offline >90s: snapshots show FALLBACK_STALE/NO_PRICE, chartEligible = false |
| FAIL (A) | Still showing FALLBACK_FRESH with chartEligible = true after provider offline >90s = freshness gate bug |
| FAIL (B) | Data correct but UI still shows estimated P/L as if fresh = UI honesty gap |

---

### S4: Reconnect after fallback

**What this tests**: Seamless transition from estimated back to verified data.

| Step | Action |
|------|--------|
| Setup | Account A is offline and receiving fallback data (S1 completed) |
| 1 | Reopen Account A's MT terminal, let EA reconnect |
| 2 | Watch PM2 logs for heartbeat processing |
| 3 | Wait 30-60 seconds |
| 4 | Check Account A's tracking status and snapshots |

**DB check:**
```sql
SELECT "trackingStatus",
  EXTRACT(EPOCH FROM (now() - "lastHeartbeat")) AS secs_since_hb
FROM "MtAccount" WHERE id = '<ACCOUNT_A_ID>';
```
Must return `ACTIVE`, `secs_since_hb < 30`.

```sql
SELECT "snapshotSource", "estimateQuality", "chartEligible",
  "isEstimated", timestamp
FROM "EquitySnapshot"
WHERE "mtAccountId" = '<ACCOUNT_A_ID>'
ORDER BY timestamp DESC LIMIT 5;
```
Most recent rows should show `snapshotSource = 'EA'`, `estimateQuality = 'REAL'`, `chartEligible = true`.

| Result | Criteria |
|--------|----------|
| PASS | Account goes back to ACTIVE, new EA snapshots appear, verified data resumes |
| FAIL (A) | Account stays STALE despite heartbeat resuming = tracking status update bug |
| FAIL (A) | Still creating FALLBACK snapshots after EA reconnected = stale account query not refreshing |
| FAIL (C) | EA won't reconnect = MT/EA configuration issue, not a code bug |

---

### S5: Ranking status degradation

**What this tests**: RANKED -> PROVISIONAL -> UNRANKED transitions.

| Step | Action |
|------|--------|
| Setup | Account A is ACTIVE with open official signal-qualified trades |
| 1 | Verify ranking status via leaderboard or admin panel |
| 2 | Close Account A's MT terminal |
| 3 | Wait 3 minutes (STALE threshold) |
| 4 | Check ranking status — should be PROVISIONAL |
| 5 | Wait 2 more minutes (5 min total, TRACKING_LOST threshold) |
| 6 | Check ranking status — should be UNRANKED |

**DB check at each stage:**
```sql
SELECT "trackingStatus",
  EXTRACT(EPOCH FROM (now() - "lastHeartbeat")) AS secs_since_hb
FROM "MtAccount" WHERE id = '<ACCOUNT_A_ID>';
```

Thresholds:
- `< 180s` = ACTIVE
- `180-300s` = STALE
- `>= 300s` = TRACKING_LOST

Ranking eligibility (requires open official signal-qualified trades):
- STALE (heartbeat 180-300s) + open trades = PROVISIONAL
- TRACKING_LOST (heartbeat >=300s) + open trades = UNRANKED

| Result | Criteria |
|--------|----------|
| PASS | Status transitions match thresholds, ranking degrades correctly |
| FAIL (A) | Status doesn't change at expected threshold = updateTrackingStatus bug |
| FAIL (B) | Status changes in DB but leaderboard UI doesn't reflect it = UI rendering gap |
| FAIL (D) | No open signal-qualified trades = expected behavior (no degradation without open trades) |

---

### S6: Live risk estimated state

**What this tests**: `getLiveOpenRisk()` returns `isEstimated: true` for stale accounts with fresh prices.

| Step | Action |
|------|--------|
| Setup | Account A STALE, Account B providing prices (S1 state) |
| 1 | Open Account A's statement page |
| 2 | Check live risk section — should show floating P/L |
| 3 | Inspect via browser DevTools Network tab: find the live-risk API call |
| 4 | Check response JSON for `isEstimated: true` |

**No direct SQL check** — this is computed on-demand from trade data + price pool.

To verify the freshness gate is working, combine with S3:
- When Account B is alive (fresh prices): `isEstimated: true`, P/L computed from price pool
- When Account B is dead >90s (stale prices): `isEstimated: false`, P/L from last MT value

| Result | Criteria |
|--------|----------|
| PASS | `isEstimated: true` when stale account + fresh prices, `false` when prices stale |
| FAIL (A) | `isEstimated: true` when prices are >90s old = freshness gate not working |
| FAIL (B) | API returns correct data but UI doesn't show estimated indicator = UI honesty gap |

---

### S7: Equity chart behavior

**What this tests**: Estimated snapshots appear in equity chart, visually distinguishable.

| Step | Action |
|------|--------|
| Setup | Account A was offline for 5+ minutes with fallback data (S1 completed, then S4 reconnected) |
| 1 | Open digest/equity chart for Account A |
| 2 | Look for the period where Account A was offline |
| 3 | Check if chart shows continuous data (no gap) |
| 4 | Check if estimated segment is visually different |

**DB check** — verify chart-eligible snapshots exist for the offline period:
```sql
SELECT timestamp, balance, equity,
  "snapshotSource", "estimateQuality", "chartEligible"
FROM "EquitySnapshot"
WHERE "mtAccountId" = '<ACCOUNT_A_ID>'
  AND timestamp > now() - interval '30 minutes'
ORDER BY timestamp ASC;
```

Look for a sequence like:
```
EA / REAL / true       ← before disconnect
FALLBACK / FRESH / true  ← during disconnect (chart shows these)
EA / REAL / true       ← after reconnect
```

| Result | Criteria |
|--------|----------|
| PASS | Chart shows continuous line through offline period, estimated snapshots visible |
| FAIL (B) | Snapshots exist but chart has gap = chart query filters out FALLBACK snapshots incorrectly |
| FAIL (B) | Chart is continuous but no visual distinction = UI honesty gap (deferred, not a blocker) |
| FAIL (C) | Too few snapshots to see continuity = test was too short, run longer |

---

## Decision Matrix

After running all scenarios, use this to decide:

| Condition | Action |
|-----------|--------|
| S1-S7 all PASS | Move to **DONE** |
| Any FAIL (A) — code bug | Move to **IN_PROGRESS**, file bug, fix, re-test |
| Only FAIL (B) — UI honesty gap | Move to **DONE** with note: "UI estimated indicators deferred" (already documented in task brief done-definition) |
| Only FAIL (C) — test env limitation | Re-test with proper setup before deciding |
| Only FAIL (D) — expected behavior | PASS (document why) |
| Mix of (A) + others | Fix (A) first, then re-evaluate |

### Board commands

```bash
# Close as DONE
set -a; source .env; set +a; psql "$DATABASE_URL" -c "
  UPDATE \"ProjectTask\"
  SET \"column\" = 'DONE', \"completedAt\" = now(),
      result = 'QA verified: [list which scenarios passed]. [any notes]',
      \"updatedAt\" = now()
  WHERE id = 'cl3491f086dd7dd5e52fcf316';
"

# Reopen to IN_PROGRESS
set -a; source .env; set +a; psql "$DATABASE_URL" -c "
  UPDATE \"ProjectTask\"
  SET \"column\" = 'IN_PROGRESS',
      result = 'QA failed: [which scenario] — [failure type A/B/C/D] — [details]',
      \"updatedAt\" = now()
  WHERE id = 'cl3491f086dd7dd5e52fcf316';
"
```
