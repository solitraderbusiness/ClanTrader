# ClanTrader — Price Data System Report

## 1. How Prices Enter the System

### EA Heartbeat (the only source of price data)

Every connected MetaTrader EA sends a **heartbeat** every ~10 seconds to `POST /api/ea/heartbeat`. The payload includes an array of up to 200 `openTrades`, each containing:

```
{ ticket, symbol, direction, lots, openPrice, closePrice, currentPrice, stopLoss, takeProfit, profit, commission, swap }
```

The `currentPrice` field is the live market price for that symbol at the moment the EA sent the heartbeat.

**Authentication:** Each EA authenticates via `Authorization: Bearer {apiKey}` — the API key uniquely identifies an `MtAccount` record in the database.

**File:** `src/services/ea.service.ts`, function `processHeartbeat()` (line 180)

---

## 2. How Prices Are Cached (Redis)

During heartbeat processing (lines 302-320 of `ea.service.ts`), prices are cached in Redis:

```typescript
// For each open trade in the heartbeat:
const priceJson = JSON.stringify({ price: trade.currentPrice, ts: Date.now() });
redis.set(`price:${sym}`, priceJson, "EX", ttl);

// Also cache under normalized symbol (e.g., EURUSDm → EURUSD)
const norm = normalizeSymbol(sym);
if (norm !== sym) {
  redis.set(`price:${norm}`, priceJson, "EX", ttl);
}
```

**Redis key format:** `price:{SYMBOL}` → `{ "price": 1.0845, "ts": 1709913600000 }`

### Symbol Normalization

`normalizeSymbol()` (line 530) strips broker-specific suffixes:
- `EURUSD_L` → `EURUSD`
- `EURUSD.i` → `EURUSD`
- `EURUSDm` → `EURUSD` (via regex `/[._][A-Z]$/i`)

This ensures all EAs write to the same key regardless of broker naming conventions.

### TTL (Time-To-Live) Strategy

`priceCacheTTL()` (line 490) implements market-aware expiry:

| Period | TTL | Reason |
|--------|-----|--------|
| **Market hours** (Sun 22:00 UTC – Fri 22:00 UTC) | **300 seconds (5 min)** | Prices refresh frequently from heartbeats |
| **Market closed** (Fri 22:00 – Sun 22:00 UTC) | **Until next Sunday 22:00 UTC** (~3 days max) | Friday's closing price persists through the weekend so watchlists/cards still show last known price |

---

## 3. Who Reads Prices and How

There are **4 locations** in the codebase that read prices from Redis, plus **2 locations** that use prices directly from the heartbeat payload (no Redis read).

### 3.1 Watchlist Service (Redis reader)

**File:** `src/services/watchlist.service.ts`, function `getInstrumentPrices()` (line 82)

```typescript
const keys = symbols.map((s) => `price:${s}`);
const values = await redis.mget(...keys);  // Bulk fetch all symbols in one call
```

Used by `getClanWatchlistData()` to build the TradingView-style instrument table. Returns `InstrumentRow[]` with `price` and `priceTs` fields.

**Fallback:** If a symbol isn't in Redis, the service queries the database for the latest `MtTrade.closePrice` from clan members' trades (sorted by `closeTime DESC`).

**Called by:** `GET /api/clans/[clanId]/watchlist` → polled by the UI every 30 seconds while the watchlist sheet is open.

### 3.2 Channel Service (Redis reader)

**File:** `src/services/channel.service.ts`, line 250

```typescript
const priceKeys = symbols.map((s) => `price:${s}`);
const priceValues = await redis.mget(...priceKeys);
```

Used inside `getChannelPosts()` to compute live PnL (R:R) for open trade cards displayed in channel streams. Builds a `livePnlMap` with `currentRR`, `currentPrice`, `targetRR`, `pricePnl`, and optional `mtProfit`.

**Called by:** `GET /api/clans/[clanId]/channels/[channelId]/posts`

### 3.3 Socket Handler — Initial PnL on Topic Join (Redis reader)

**File:** `src/lib/socket-handlers/shared.ts`, line 148

```typescript
const priceKeys = symbols.map((s) => `price:${s}`);
const priceValues = await redis.mget(...priceKeys);
```

When a user joins a chat topic, `sendInitialPnl()` fetches cached prices and computes live R:R for all open trades in that topic. This ensures PnL displays immediately without waiting for the next heartbeat cycle.

**Called by:** Socket `join_topic` event handler.

### 3.4 Close-Price Fallback (Redis reader)

**File:** `src/services/ea.service.ts`, line 252

```typescript
const cached = await redis.get(`price:${sym}`);
if (cached) {
  const parsed = JSON.parse(cached);
  closePrice = parsed.price;
}
```

During heartbeat reconciliation: if the EA's heartbeat no longer lists a trade that was previously open, it means the trade closed. If MetaTrader didn't provide a `closePrice`, the system falls back to the last cached Redis price as the closing price.

### 3.5 Linked Trade PnL Broadcast (uses heartbeat directly, NOT Redis)

**File:** `src/services/ea.service.ts`, function `broadcastTradePnl()` (line 534)

For trades linked to MT accounts, the `currentPrice` comes directly from the heartbeat's `openTrades[].currentPrice` — not from Redis. This is the most accurate and freshest price.

Calculates:
- `currentRR = (direction * (currentPrice - entry)) / riskDistance` (in R multiples)
- `targetRR = (target - entry) / riskDistance`
- `pricePnl = currentPrice - entry` (absolute points)
- `mtProfit = profit + commission + swap` (account profit in currency)

Emits `TRADE_PNL_UPDATE` socket event to `topic:{clanId}:{topicId}` and `clan:{clanId}` rooms.

### 3.6 Unlinked Trade PnL Broadcast (uses heartbeat directly, NOT Redis)

**File:** `src/services/ea.service.ts`, function `broadcastUnlinkedTradePnl()` (line 641)

For trade cards that have no MT link, builds a price map from the heartbeat's `openTrades` array (with normalized symbols), then calculates the same R:R metrics. Same socket emission pattern.

---

## 4. How the UI Displays Prices

### 4.1 Trade Cards (Real-Time via Socket)

**File:** `src/components/chat/TradeCardInline.tsx`

**State source:** Zustand store `tradePnl[tradeId]` in `src/stores/chat-store.ts` (line 163):
```typescript
tradePnl: Record<string, {
  currentRR: number | null;
  currentPrice: number;
  targetRR?: number | null;
  riskStatus?: string;
  pricePnl?: number | null;
  mtProfit?: number | null;
}>
```

**Display priority** (lines 224-271):
1. **Live R:R** (if `currentRR` available): Shows `+1.5R` colored green/red, with target like `/ 3.0R`
2. **MT Profit** (if `mtProfit` available): Shows dollar P&L like `+$245.30`
3. **Price PnL** (if `pricePnl` available): Shows raw price movement like `+0.0045`

Current price always shown in small grey text below.

**Update flow:** EA heartbeat → server `broadcastTradePnl()` → socket `TRADE_PNL_UPDATE` → Zustand `updateTradePnl()` → React re-render.

### 4.2 Watchlist (REST Polling)

**File:** `src/components/chat/WatchlistSheet.tsx`

Polls `GET /api/clans/[clanId]/watchlist` every **30 seconds** while open.

**Staleness indicator** — `PriceStaleDot` component (line 57):

| Age | Color | Label |
|-----|-------|-------|
| < 1 minute | Green (`bg-emerald-500`) | "Live (<1m)" |
| 1–5 minutes | Yellow (`bg-yellow-500`) | "Recent (<5m)" |
| > 5 minutes | Grey (`bg-muted-foreground/40`) | "Stale" |

These thresholds are **hardcoded** in the component — not configurable via admin.

The component tracks a `now` timestamp that refreshes every 30 seconds to keep staleness indicators accurate.

---

## 5. Data Model

### MtAccount (the EA connection)

```
MtAccount {
  id, userId, accountNumber, broker, serverName,
  platform (MT4/MT5), balance, equity, margin, freeMargin,
  currency, leverage, isActive, lastHeartbeat, apiKey,
  @@unique([accountNumber, broker])  // Global uniqueness
}
```

- A user can have **multiple** MtAccounts (across different brokers)
- `lastHeartbeat: DateTime?` tracks when the EA last pinged
- `broker: String` is free-form (e.g., "ICMarkets", "Pepperstone")

### MtTrade (raw MT trades)

```
MtTrade {
  id, mtAccountId, ticket (BigInt), symbol, direction, lots,
  openPrice, closePrice, openTime, closeTime, stopLoss, takeProfit,
  profit, commission, swap, isOpen, matchedTradeId
  @@unique([mtAccountId, ticket])
}
```

### Trade (signal/analysis card)

```
Trade {
  id, tradeCardId, userId, status (PENDING/OPEN/TP_HIT/SL_HIT/BE/CLOSED/UNVERIFIED),
  initialEntry, initialStopLoss, initialTakeProfit, initialRiskAbs,
  closePrice, finalRR, netProfit, lastEvaluatedAt, integrityStatus
}
```

---

## 6. Current Limitations

| Limitation | Impact |
|------------|--------|
| **Single key per symbol** — `price:EURUSD` is overwritten by ANY EA regardless of broker | If two brokers have different prices (e.g., 1.0845 vs 1.0847), only the last heartbeat wins |
| **No source tracking** — the cached price doesn't record which EA/broker provided it | Impossible to know if a price came from the user's broker or a different one |
| **No EA redundancy** — if the only connected EA disconnects, the price simply expires after 5 min TTL | Users see stale/missing prices with no way to recover until an EA reconnects |
| **No cross-broker awareness** — all prices are treated identically | A user on Broker A might see Broker B's price without knowing it |
| **Hardcoded staleness thresholds** — 60s/300s baked into the UI component | Not configurable per symbol type (crypto 24/7 vs forex market hours) |
| **No active EA tracking per symbol** — system doesn't know which brokers currently have live EAs providing data | Can't implement intelligent failover |

---

## 7. Price Flow Diagram

```
MT4/MT5 Terminal
    │
    ▼
EA Plugin sends heartbeat (every ~10s)
    │  POST /api/ea/heartbeat
    │  { openTrades: [{ symbol, currentPrice, ... }] }
    │
    ▼
processHeartbeat() — ea.service.ts:180
    │
    ├─► Redis: SET price:{SYMBOL} { price, ts }  (TTL: 5min or weekend)
    │         SET price:{NORMALIZED} { price, ts }
    │
    ├─► broadcastTradePnl() ──► Socket: TRADE_PNL_UPDATE
    │   (linked trades, uses heartbeat prices directly)
    │
    └─► broadcastUnlinkedTradePnl() ──► Socket: TRADE_PNL_UPDATE
        (unlinked trades, uses heartbeat prices directly)


CONSUMERS:
                                    ┌─────────────────────┐
   Watchlist (REST poll 30s) ──────►│                     │
   Channel posts (REST) ───────────►│  redis.mget(        │──► UI
   Socket join_topic ──────────────►│    price:{SYMBOL}   │
   Close-price fallback ──────────►│  )                   │
                                    └─────────────────────┘
```
