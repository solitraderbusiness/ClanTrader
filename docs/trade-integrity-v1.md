# Trade Integrity System v1

## Problem

ClanTrader uses 1-minute OHLC candle data to verify trade outcomes. A single candle only provides four prices (open, high, low, close) — it cannot prove the **order** in which prices were visited within that minute. When both a stop-loss and take-profit level fall within the same candle's range, the system cannot determine which was hit first.

Without integrity checks, users could dishonestly report trade outcomes (e.g. claiming TP hit when SL was actually hit first), inflating their stats and unfairly competing in clan rankings.

## Solution

Trades that **cannot be verified** by candle data are marked `UNVERIFIED` and excluded from statements and competition stats. Manual status changes are flagged as `MANUAL_OVERRIDE` and also excluded.

### Key Design Decisions

- **Single target per trade (v1):** Exactly one take-profit target is enforced. Multi-target support will return in v2 when tick-level data is available.
- **Direction-based price ordering:** LONG requires SL < Entry < TP; SHORT requires TP < Entry < SL. Validated at creation time.
- **PENDING initial status:** Trades start as PENDING, not OPEN. The evaluator confirms entry when candle data shows the entry price was touched.
- **Honest by default:** Any ambiguity results in UNVERIFIED status rather than assuming a favorable outcome.

## Status Lifecycle

```
PENDING ──[entry confirmed]──> OPEN ──[TP touched]──> TP_HIT
                                    ──[SL touched]──> SL_HIT
                                    ──[manual BE]───> BE
                                    ──[manual close]─> CLOSED
                                    ──[conflict]────> UNVERIFIED

PENDING ──[entry+SL or entry+TP same candle]──> UNVERIFIED
```

Terminal statuses: `TP_HIT`, `SL_HIT`, `BE`, `CLOSED`, `UNVERIFIED`

## Evaluation Rules

### Rule 1: PENDING trades

For each 1-minute candle, check if price levels fall within `[candle.low, candle.high]`:

| Entry touched | SL touched | TP touched | Result |
|:---:|:---:|:---:|---|
| No | - | - | NOOP |
| Yes | No | No | ENTER (transition to OPEN) |
| Yes | Yes | - | MARK_UNVERIFIED (ENTRY_CONFLICT) |
| Yes | - | Yes | MARK_UNVERIFIED (ENTRY_CONFLICT) |

### Rule 2: OPEN trades

| SL touched | TP touched | Result |
|:---:|:---:|---|
| No | No | NOOP |
| No | Yes | RESOLVE_TP |
| Yes | No | RESOLVE_SL |
| Yes | Yes | MARK_UNVERIFIED (EXIT_CONFLICT) |

### Rule 3: Terminal statuses

Any trade in a terminal status returns NOOP.

### Touch test

A price level is "touched" if: `candle.low <= level && level <= candle.high`

This is direction-agnostic — the validation at trade creation ensures correct price ordering.

## Gap Detection

When consecutive candles have a time gap > 90 seconds:

- **CRYPTO:** Always counts as a real data gap
- **FOREX/CFD:** Check if the gap falls within the weekend window (not a gap if market is closed)

Weekend window (configurable via env vars):
- `FOREX_WEEKEND_START_UTC`: Default `"FRI 21:00"`
- `FOREX_WEEKEND_END_UTC`: Default `"MON 00:00"`

If a data gap is detected during market hours, the trade is marked `UNVERIFIED` with reason `DATA_GAP`.

## Manual Override Policy

When a user manually sets a trade to a resolved status (TP_HIT, SL_HIT, BE, CLOSED):

1. The claimed status is preserved (the trade shows as the user's claimed outcome)
2. `integrityStatus` is set to `UNVERIFIED`
3. `integrityReason` is set to `MANUAL_OVERRIDE`
4. `statementEligible` is set to `false`
5. `resolutionSource` is set to `MANUAL`
6. A `MANUAL_STATUS_SET` event is recorded

This means manually resolved trades appear in chat with their claimed status but are excluded from statement calculations and badge eligibility.

## Admin Override

Admins can toggle `statementEligible` via:

```
PATCH /api/admin/trades/:tradeId/statement-eligibility
Body: { statementEligible: boolean, reason: string }
```

This creates an `ADMIN_STATEMENT_TOGGLE` event in the trade's history. Setting `statementEligible: true` on an UNVERIFIED trade logs a warning event.

## Candle Provider

The system uses an adapter pattern for candle data:

```typescript
interface CandleProvider {
  fetchOneMinuteCandles(instrument: string, from: Date, to: Date): Promise<CandleData[]>;
}
```

Currently uses `StubCandleProvider` (returns empty arrays — safe no-op). Swap with a real provider by calling `setCandleProvider()` or configuring the `CANDLE_PROVIDER` env var.

## Evaluator Scheduling

The evaluator runs on a 60-second interval in `server.ts`, gated behind the `trade_integrity_evaluator` feature flag (disabled by default). It can also be triggered manually:

```
POST /api/internal/evaluate-trades (admin-only)
```

Batch size: 50 trades per cycle. Queries trades with `status IN (PENDING, OPEN)` and `resolutionSource != MANUAL`.

## Instrument Type Detection

Instruments are classified for gap detection purposes:

| Type | Examples | Detection |
|---|---|---|
| CRYPTO | BTCUSD, ETHUSD | Name starts with BTC, ETH, SOL, etc. |
| CFD | US30, NAS100, USOIL | Known index/commodity patterns |
| FOREX | EURUSD, XAUUSD, GBPUSD | Default for all others |

## Database Schema

New fields on `Trade` model:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `entryFilledAt` | DateTime? | null | When entry was confirmed by evaluator |
| `lastEvaluatedAt` | DateTime? | null | Last candle evaluation timestamp |
| `integrityStatus` | IntegrityStatus | VERIFIED | VERIFIED or UNVERIFIED |
| `integrityReason` | IntegrityReason? | null | Why the trade is unverified |
| `integrityDetails` | Json? | null | Candle OHLC, touched levels, etc. |
| `statementEligible` | Boolean | true | Whether trade counts in statements |
| `resolutionSource` | ResolutionSource | UNKNOWN | EVALUATOR, MANUAL, or UNKNOWN |

## Future: Tick Data

When tick-level data becomes available (v2), the UNVERIFIED rate will drop significantly because tick data provides exact ordering of price events. The evaluator architecture is designed to swap the candle provider with a tick provider without changing the core logic.
