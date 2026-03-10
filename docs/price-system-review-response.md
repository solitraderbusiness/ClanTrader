> **Status:** HISTORICAL
> **Last reviewed:** 2026-03-10
> **Authority:** SOURCE_OF_TRUTH.md
> **Notes:** Improvement proposals from this doc are now implemented in code (5-layer Redis cache, source groups, getVerifiedPrice vs getDisplayPrice, PriceStatus enum). Historical reference only.

# Response to Price System Review

## My Honest Assessment

This review is excellent and catches real architectural weaknesses. Let me break down what I agree with, what I'd adjust, and what I think is the right path for ClanTrader's stage.

---

## Where the Review Is Absolutely Right

### 1. "Broker" is not a safe identity — Source Group is better

This is the strongest point in the review. The `broker` field is free-form and two accounts saying "ICMarkets" can have different servers, platforms, and prices. The source group concept (`broker + serverName + platform`) is clearly more correct.

**My recommendation:** Adopt source groups. The cost is minimal — it's just a normalization function. The safety gain is real.

### 2. Close-price fallback is the biggest loophole

The reviewer nailed this. Using a global `price:EURUSD` from any random EA to close a trade is dangerous. If a user on Pepperstone has a trade close, and the last cached price came from ICMarkets with a 2-pip spread difference, that's a real money discrepancy.

**My recommendation:** Implement per-trade and per-account price caching for reconciliation. This is the single highest-value change.

### 3. Display vs. Verification separation

This is architecturally sound. Cross-source prices are fine for "show something on screen" but must never decide trade outcomes, final R:R, integrity status, or leaderboard math.

**My recommendation:** Hard separation in the API. Two different function families. No exceptions.

### 4. DB fallback (historical close) should not masquerade as live price

The watchlist currently falls back to `MtTrade.closePrice` from the database when Redis has no cached price. That's a historical trade close, not a market quote. Showing it as if it's current is misleading.

**My recommendation:** Return an explicit `status` field so the UI can distinguish "live quote" from "last known close from 3 days ago."

### 5. Price provenance/status should be richer than a boolean

`stale: true/false` doesn't capture enough. The `PriceStatus` enum the reviewer proposes is the right model.

---

## Where I'd Adjust the Approach for Pragmatism

### 1. Five Redis layers is over-engineered for our current scale

The reviewer proposes:
```
price:src:{sourceGroup}:{accountId}:{symbol}
price:acct:{accountId}:{symbol}
price:trade:{accountId}:{ticket}
price:group:{sourceGroup}:{symbol}
price:display:{symbol}
```
Plus two sorted sets per symbol.

That's 5 keys + 2 zsets **per symbol per heartbeat**. With 50 symbols × 10 accounts = 3,500+ Redis writes per heartbeat cycle. For a system that currently does ~100 writes, that's a 35x increase in Redis traffic.

**My recommendation:** Start with 3 layers:
- `price:trade:{accountId}:{ticket}` — per-trade last-known (for safe reconciliation)
- `price:group:{sourceGroup}:{symbol}` — per source group (for same-group lookups)
- `price:display:{symbol}` — global display (for UI, enriched with provenance)

Skip `price:src` and `price:acct` for now. The per-trade key gives us safe reconciliation. The group key gives us redundancy. The display key gives us fast UI reads. We can add the other layers later if we need anomaly detection or per-account debugging.

### 2. The anomaly detection / quarantine system is future work

The reviewer suggests:
- Reject absurd price jumps
- Compare against group median
- Quarantine bad sources temporarily

This is valuable but complex. It requires maintaining price history, computing medians, and building a quarantine mechanism. For our current user base (small number of EAs), a single bad EA is noticeable and manually fixable.

**My recommendation:** Log anomalies (price jumps > X%) but don't auto-quarantine yet. Add it when we have 50+ concurrent EAs.

### 3. Bid/Ask is a real limitation but not actionable yet

The EA currently sends only `currentPrice` (which is typically the bid for sell positions and ask for buy positions, depending on MT behavior). Adding proper bid/ask would require EA changes.

**My recommendation:** Design the `ResolvedPrice` interface to support `bid`/`ask`/`mid` as optional fields. Don't block the current work on it.

### 4. Symbol normalization "needs a controlled mapping system"

A full symbol mapping system (alias table, asset-class-aware normalizer) is significant work. The current regex works for the common cases (suffix stripping). Edge cases like `.cash` variants are real but rare in our user base.

**My recommendation:** Keep the regex normalizer for now but add a `symbolAliases` config map for known edge cases. Build a full mapping system when we onboard brokers with exotic naming.

### 5. Weekend "stale red" UX concern

Good catch. Showing a red stale indicator on Saturday morning for EURUSD is misleading — the market is closed, the price IS the last known price. Only crypto should show stale during weekends.

**My recommendation:** Already in the plan — the `PriceStatus` enum should include `market_closed_last_known` and the UI should show it distinctly (e.g., grey with "Market closed" tooltip, not red "Stale").

---

## The Watchlist "Not Really Live" Problem

The reviewer makes an important product point:

> Your prices only enter the system from `openTrades` in heartbeat. If no connected account has BTCUSD open, you don't have a live BTCUSD feed.

This is 100% correct. Our watchlist is "live-where-available," not a true market data feed.

**Options for the future:**
1. **EA sends subscribed quotes** — modify the EA to also send prices for a configurable symbol list, even without open trades. This is the most realistic path.
2. **Dedicated quote collector EA** — a "market data" MT account that subscribes to all symbols. Simple but requires maintaining a dedicated MT terminal.
3. **External feed** — violates "Iranian-first, no external API deps" rule. Not an option.

**My recommendation:** For now, be honest in the UI. If a price is historical (from DB fallback), show it as such. In a future iteration, add EA-side "quote subscription" so it sends prices for starred watchlist symbols.

---

## Revised Implementation Plan

Based on this review, here's what I think we should actually build:

### Core Changes to the Original Plan

| Original Plan | Revised |
|---------------|---------|
| Key by `broker` | Key by `sourceGroup` (broker + serverName + platform) |
| 2 Redis layers (broker + canonical) | 3 layers (trade + group + display) |
| Single `getPrice()` / `getPrices()` API | Split into `getDisplayPrice()` and `getVerifiedPrice()` |
| `stale: boolean` | `PriceStatus` enum with 6+ states |
| `ResolvedPrice` with basic fields | Full provenance: `sourceGroup`, `scope`, `status`, `isEstimated` |

### What Stays the Same

- Extract `price-pool.service.ts` as dedicated service
- Move `priceCacheTTL()`, `normalizeSymbol()`, `isMarketOpen()` out of ea.service
- UI indicators (green/yellow/red/grey dots) with richer semantics
- Zero-downtime migration via dual-write
- Market-hours-aware TTL
- i18n keys for all price states

### Redis Key Structure (Revised)

```
# Per-trade last-known price (for safe reconciliation)
price:trade:{accountId}:{ticket} → { price, ts, symbol, sourceGroup }
TTL: 1 hour (only needed briefly after trade closes)

# Per source-group best price
price:group:{sourceGroup}:{symbol} → { price, ts, accountId }
TTL: priceCacheTTL()

# Global display price (enriched with provenance)
price:display:{symbol} → { price, ts, sourceGroup, status }
TTL: priceCacheTTL()

# Active source groups per symbol
price:active:{symbol} → ZSET { member: sourceGroup, score: ts }
TTL: priceCacheTTL() + 60s
```

### API Split

```typescript
// === Display family (cross-source OK) ===
getDisplayPrice(symbol, preferredSourceGroup?): ResolvedPrice | null
getDisplayPrices(symbols, preferredSourceGroup?): Map<string, ResolvedPrice>

// === Verification family (same-source only, NEVER cross-source) ===
getTradeLastPrice(accountId, ticket): ResolvedPrice | null
getVerifiedPrice(symbol, sourceGroup): ResolvedPrice | null
```

### PriceStatus Enum

```typescript
type PriceStatus =
  | "fresh_same_source"      // Green — best case
  | "fresh_cross_source"     // Yellow — display OK, not for verification
  | "stale_same_source"      // Orange — getting old
  | "stale_cross_source"     // Red — old AND from different source
  | "market_closed"          // Grey — expected, not alarming
  | "historical_trade_close" // Grey italic — DB fallback, not live
  | "no_price";              // Empty — nothing available
```

### ResolvedPrice Interface

```typescript
interface ResolvedPrice {
  price: number;
  ts: number;
  symbol: string;
  sourceGroup: string | null;
  accountId?: string | null;
  scope: "trade" | "account" | "source_group" | "cross_source" | "historical";
  status: PriceStatus;
  isEstimated: boolean;
  marketOpen: boolean;
}
```

---

## Summary

The review is right on the big things:
1. Source group > broker string (adopt)
2. Per-trade fallback for reconciliation (adopt)
3. Display vs. verification split (adopt)
4. Richer price status (adopt)
5. DB fallback should be explicit (adopt)

The review is ambitious on implementation details:
1. 5 Redis layers → start with 3 (trade/group/display)
2. Anomaly detection → log only, no auto-quarantine yet
3. Bid/ask → design for it, don't require it yet
4. Symbol mapping system → config map, not full system yet

This gives us a **solid, trustworthy price system** without over-engineering for our current scale.
