/**
 * price-pool.service.ts — Source-aware pricing system
 *
 * This is a trust-critical service. It separates DISPLAY prices from
 * VERIFICATION prices to prevent cross-source contamination of trade truth.
 *
 * Key invariants:
 * - Cross-source fallback is ONLY allowed for display use cases
 * - Verification readers NEVER cross source group boundaries
 * - Close-price fallback uses strict: trade → account → group → unresolved
 */

import { redis } from "@/lib/redis";

// ── Price Status Model ──

export type PriceStatus =
  | "fresh_same_source"
  | "fresh_cross_source"
  | "stale_same_source"
  | "stale_cross_source"
  | "stale_last_known"
  | "market_closed"
  | "historical_trade_close"
  | "no_price";

export type PriceScope =
  | "trade"
  | "account"
  | "source_group"
  | "display"
  | "historical"
  | "none";

export interface ResolvedPrice {
  price: number | null;
  ts: number | null;
  symbol: string;
  sourceGroup: string | null;
  accountId?: string | null;
  scope: PriceScope;
  status: PriceStatus;
  isEstimated: boolean;
  marketOpen: boolean;
  crossSource: boolean;
}

// ── Staleness Thresholds (ms) ──

type SymbolCategory = "FOREX" | "METALS" | "CRYPTO" | "INDEX" | "DEFAULT";

const STALENESS_MS: Record<SymbolCategory, number> = {
  FOREX: 60_000,
  METALS: 60_000,
  CRYPTO: 120_000,
  INDEX: 60_000,
  DEFAULT: 60_000,
};

// ── Redis Key Prefixes ──

const KEY = {
  trade: (accountId: string, ticket: string) =>
    `price:trade:${accountId}:${ticket}`,
  account: (accountId: string, symbol: string) =>
    `price:acct:${accountId}:${symbol}`,
  group: (sourceGroup: string, symbol: string) =>
    `price:group:${sourceGroup}:${symbol}`,
  display: (symbol: string) =>
    `price:display:${symbol}`,
  activeGroups: (symbol: string) =>
    `price:active:${symbol}`,
  /** Extended display key — 4h TTL, used as last-resort fallback when normal display expires */
  displayExt: (symbol: string) =>
    `price:display-ext:${symbol}`,
} as const;

// ── Source Group Identity ──

/**
 * Build a stable, deterministic source group identity from account metadata.
 * This is the trust boundary for price grouping — NOT the raw broker string.
 */
export function buildSourceGroup(
  broker: string,
  serverName: string | null | undefined,
  platform: string
): string {
  const normBroker = (broker || "unknown").trim().toLowerCase().replace(/\s+/g, "_");
  const normServer = (serverName || "default").trim().toLowerCase().replace(/\s+/g, "_");
  const normPlatform = (platform || "mt4").trim().toLowerCase();
  return `${normBroker}|${normServer}|${normPlatform}`;
}

// ── Symbol Helpers ──

/** Strip common broker suffixes like _L, _l, .i, _m, _M etc. */
export function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[._][A-Z]$/i, "");
}

export function getSymbolCategory(symbol: string): SymbolCategory {
  const s = symbol.toUpperCase();
  if (/^(?:BTC|ETH|XRP|LTC|DOGE|SOL|ADA|DOT|BNB|AVAX|MATIC)/i.test(s)) return "CRYPTO";
  if (/XAU|XAG|GOLD|SILVER/i.test(s)) return "METALS";
  if (/SPX|SP500|NAS|US30|DJ30|DAX|FTSE|NI225|US500|US100|US2000/i.test(s)) return "INDEX";
  if (/^[A-Z]{6}$/.test(s)) return "FOREX";
  return "DEFAULT";
}

// ── Market Hours ──

export function isMarketOpen(now?: Date): boolean {
  const d = now ?? new Date();
  const day = d.getUTCDay();
  const hour = d.getUTCHours();

  return (
    (day === 0 && hour >= 22) ||
    (day >= 1 && day <= 4) ||
    (day === 5 && hour < 22)
  );
}

/**
 * Market-aware TTL for cached prices.
 * During market hours: 300s. Outside: persists until next Sunday 22:00 UTC.
 */
export function priceCacheTTL(now?: Date): number {
  const d = now ?? new Date();
  const day = d.getUTCDay();
  const hour = d.getUTCHours();

  const open =
    (day === 0 && hour >= 22) ||
    (day >= 1 && day <= 4) ||
    (day === 5 && hour < 22);

  if (open) return 300;

  // Compute seconds until Sunday 22:00 UTC
  const nextOpen = new Date(d);
  // Advance to next Sunday
  while (nextOpen.getUTCDay() !== 0 || nextOpen <= d) {
    nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
  }
  nextOpen.setUTCHours(22, 0, 0, 0);

  const seconds = Math.ceil((nextOpen.getTime() - d.getTime()) / 1000);
  return Math.max(300, Math.min(seconds, 259200));
}

// ── Freshness Check ──

function isFresh(ts: number, symbol: string, now: number): boolean {
  const category = getSymbolCategory(symbol);
  // Crypto is 24/7 — always apply staleness
  if (category === "CRYPTO") {
    return (now - ts) < STALENESS_MS.CRYPTO;
  }
  // For non-crypto, if market is closed, last known price is not stale
  if (!isMarketOpen()) return true;
  return (now - ts) < (STALENESS_MS[category] ?? STALENESS_MS.DEFAULT);
}

// ── Lua Script: Atomic Update-If-Newer ──

const UPDATE_IF_NEWER_LUA = `
local current = redis.call('GET', KEYS[1])
if current then
  local parsed = cjson.decode(current)
  if parsed.ts and tonumber(parsed.ts) >= tonumber(ARGV[2]) then
    return 0
  end
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[3]))
return 1
`;

async function setIfNewer(key: string, json: string, ts: number, ttl: number): Promise<boolean> {
  try {
    const result = await redis.eval(UPDATE_IF_NEWER_LUA, 1, key, json, String(ts), String(ttl));
    return result === 1;
  } catch {
    // Fallback: plain SET if Lua fails (e.g., cluster mode)
    await redis.set(key, json, "EX", ttl);
    return true;
  }
}

// ── Write API ──

export interface WriteHeartbeatPriceInput {
  symbol: string;
  currentPrice: number;
  accountId: string;
  ticket: string;
  broker: string;
  serverName: string | null | undefined;
  platform: string;
}

/**
 * Write price data from a heartbeat trade into all cache layers.
 * Called once per open trade in each heartbeat.
 *
 * Writes:
 * 1. price:trade:{accountId}:{ticket} — exact trade price (for reconciliation)
 * 2. price:acct:{accountId}:{symbol} — account-level symbol price
 * 3. price:group:{sourceGroup}:{symbol} — source group price (atomic if-newer)
 * 4. price:display:{symbol} — global display price (atomic if-newer)
 * 5. price:active:{symbol} — ZSET tracking active source groups
 *
 * Also writes normalized symbol variants for layers 2-5 if different.
 */
export async function writeHeartbeatPrice(input: WriteHeartbeatPriceInput): Promise<void> {
  const { currentPrice, accountId, ticket, broker, serverName, platform } = input;
  const sym = input.symbol.toUpperCase();
  const norm = normalizeSymbol(sym);
  const sourceGroup = buildSourceGroup(broker, serverName, platform);
  const now = Date.now();
  const ttl = priceCacheTTL();
  const tradeTTL = 43200; // 12 hours for per-trade keys

  // Build JSON payloads
  const tradeJson = JSON.stringify({
    price: currentPrice, ts: now, symbol: sym,
    normalizedSymbol: norm, sourceGroup, accountId, ticket: String(ticket),
  });
  const acctJson = JSON.stringify({
    price: currentPrice, ts: now, symbol: sym, sourceGroup, accountId,
  });
  const groupJson = JSON.stringify({
    price: currentPrice, ts: now, symbol: sym, sourceGroup, accountId,
  });
  const displayJson = JSON.stringify({
    price: currentPrice, ts: now, symbol: sym, sourceGroup,
  });

  // Pipeline: trade + account keys (unconditional SET, always overwrite for same trade/account)
  const pipe = redis.pipeline();
  pipe.set(KEY.trade(accountId, String(ticket)), tradeJson, "EX", tradeTTL);
  pipe.set(KEY.account(accountId, sym), acctJson, "EX", ttl);
  if (norm !== sym) {
    pipe.set(KEY.account(accountId, norm), acctJson, "EX", ttl);
  }
  await pipe.exec();

  // Atomic if-newer for group + display keys (prevents older heartbeats from winning)
  const symbols = [sym];
  if (norm !== sym) symbols.push(norm);

  const EXT_TTL = 14400; // 4 hours — last-resort fallback for heartbeat loss

  for (const s of symbols) {
    await setIfNewer(KEY.group(sourceGroup, s), groupJson, now, ttl);
    await setIfNewer(KEY.display(s), displayJson, now, ttl);
    // Extended display key — longer TTL for fallback when all other prices expire
    await setIfNewer(KEY.displayExt(s), displayJson, now, EXT_TTL);

    // Track active source group
    await redis.zadd(KEY.activeGroups(s), now, sourceGroup);
    await redis.expire(KEY.activeGroups(s), ttl + 60);
  }

  // Cleanup stale entries from active groups ZSET (older than 2x TTL)
  const cutoff = now - (ttl * 2 * 1000);
  for (const s of symbols) {
    redis.zremrangebyscore(KEY.activeGroups(s), 0, cutoff).catch(() => {});
  }
}

// ── DISPLAY Read API (cross-source OK) ──

/**
 * Read a single display-grade price. Cross-source fallback is allowed.
 * Use for: watchlist, channel posts, socket initial PnL, general UI.
 *
 * If preferredSourceGroup is given, tries group key first, then display key.
 */
export async function getDisplayPrice(
  symbol: string,
  preferredSourceGroup?: string | null
): Promise<ResolvedPrice> {
  const now = Date.now();
  const marketOpen = isMarketOpen();

  // Try preferred source group first
  if (preferredSourceGroup) {
    const groupRaw = await redis.get(KEY.group(preferredSourceGroup, symbol));
    if (groupRaw) {
      try {
        const parsed = JSON.parse(groupRaw) as { price: number; ts: number; sourceGroup: string; accountId?: string };
        const fresh = isFresh(parsed.ts, symbol, now);
        return {
          price: parsed.price,
          ts: parsed.ts,
          symbol,
          sourceGroup: parsed.sourceGroup,
          accountId: parsed.accountId ?? null,
          scope: "source_group",
          status: !marketOpen && !isCryptoSymbol(symbol)
            ? "market_closed"
            : fresh ? "fresh_same_source" : "stale_same_source",
          isEstimated: false,
          marketOpen,
          crossSource: false,
        };
      } catch { /* fall through */ }
    }
  }

  // Read global display key
  const raw = await redis.get(KEY.display(symbol));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { price: number; ts: number; sourceGroup: string };
      const fresh = isFresh(parsed.ts, symbol, now);
      const crossSource = !!preferredSourceGroup && parsed.sourceGroup !== preferredSourceGroup;
      return {
        price: parsed.price,
        ts: parsed.ts,
        symbol,
        sourceGroup: parsed.sourceGroup,
        scope: "display",
        status: !marketOpen && !isCryptoSymbol(symbol)
          ? "market_closed"
          : crossSource
            ? (fresh ? "fresh_cross_source" : "stale_cross_source")
            : (fresh ? "fresh_same_source" : "stale_same_source"),
        isEstimated: false,
        marketOpen,
        crossSource,
      };
    } catch { /* fall through */ }
  }

  // Last resort: extended display key (4h TTL — survives heartbeat loss)
  const extRaw = await redis.get(KEY.displayExt(symbol));
  if (extRaw) {
    try {
      const parsed = JSON.parse(extRaw) as { price: number; ts: number; sourceGroup: string };
      return {
        price: parsed.price,
        ts: parsed.ts,
        symbol,
        sourceGroup: parsed.sourceGroup,
        scope: "display",
        status: "stale_last_known",
        isEstimated: true,
        marketOpen,
        crossSource: !!preferredSourceGroup && parsed.sourceGroup !== preferredSourceGroup,
      };
    } catch { /* fall through */ }
  }

  // Also try normalized symbol variant in extended key
  const norm = normalizeSymbol(symbol);
  if (norm !== symbol.toUpperCase()) {
    const extNormRaw = await redis.get(KEY.displayExt(norm));
    if (extNormRaw) {
      try {
        const parsed = JSON.parse(extNormRaw) as { price: number; ts: number; sourceGroup: string };
        return {
          price: parsed.price,
          ts: parsed.ts,
          symbol,
          sourceGroup: parsed.sourceGroup,
          scope: "display",
          status: "stale_last_known",
          isEstimated: true,
          marketOpen,
          crossSource: !!preferredSourceGroup && parsed.sourceGroup !== preferredSourceGroup,
        };
      } catch { /* fall through */ }
    }
  }

  return noPrice(symbol, marketOpen);
}

/**
 * Bulk read display-grade prices. Cross-source fallback is allowed.
 * Uses redis.mget on display keys for efficiency.
 */
export async function getDisplayPrices(
  symbols: string[]
): Promise<Map<string, ResolvedPrice>> {
  const result = new Map<string, ResolvedPrice>();
  if (symbols.length === 0) return result;

  const now = Date.now();
  const marketOpen = isMarketOpen();
  const keys = symbols.map((s) => KEY.display(s));
  const values = await redis.mget(...keys);

  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i];
    const raw = values[i];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { price: number; ts: number; sourceGroup: string };
        const fresh = isFresh(parsed.ts, sym, now);
        result.set(sym, {
          price: parsed.price,
          ts: parsed.ts,
          symbol: sym,
          sourceGroup: parsed.sourceGroup,
          scope: "display",
          status: !marketOpen && !isCryptoSymbol(sym)
            ? "market_closed"
            : fresh ? "fresh_same_source" : "stale_same_source",
          isEstimated: false,
          marketOpen,
          crossSource: false, // no preferred group in bulk reads
        });
      } catch {
        result.set(sym, noPrice(sym, marketOpen));
      }
    } else {
      result.set(sym, noPrice(sym, marketOpen));
    }
  }

  // Second pass: try extended keys for any symbols that got no_price
  const missingSymbols = symbols.filter((s) => result.get(s)?.status === "no_price");
  if (missingSymbols.length > 0) {
    const extKeys = missingSymbols.map((s) => KEY.displayExt(s));
    // Also try normalized variants
    const normMap = new Map<string, string>();
    for (const s of missingSymbols) {
      const norm = normalizeSymbol(s);
      if (norm !== s.toUpperCase()) normMap.set(s, norm);
    }
    const normKeys = [...normMap.values()].map((n) => KEY.displayExt(n));
    const allExtKeys = [...extKeys, ...normKeys];
    const extValues = await redis.mget(...allExtKeys);

    for (let i = 0; i < missingSymbols.length; i++) {
      const sym = missingSymbols[i];
      const raw = extValues[i]; // direct symbol match
      const normSym = normMap.get(sym);
      const normRaw = normSym ? extValues[extKeys.length + [...normMap.values()].indexOf(normSym)] : null;
      const chosen = raw || normRaw;

      if (chosen) {
        try {
          const parsed = JSON.parse(chosen) as { price: number; ts: number; sourceGroup: string };
          result.set(sym, {
            price: parsed.price,
            ts: parsed.ts,
            symbol: sym,
            sourceGroup: parsed.sourceGroup,
            scope: "display",
            status: "stale_last_known",
            isEstimated: true,
            marketOpen,
            crossSource: false,
          });
        } catch { /* keep no_price */ }
      }
    }
  }

  return result;
}

// ── VERIFICATION Read API (NEVER cross-source) ──

/**
 * Get the last known price for an exact trade.
 * VERIFICATION-GRADE: This is the safest fallback for trade reconciliation.
 * NEVER crosses source group boundaries.
 */
export async function getTradeLastPrice(
  accountId: string,
  ticket: string
): Promise<ResolvedPrice | null> {
  const raw = await redis.get(KEY.trade(accountId, ticket));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      price: number; ts: number; symbol: string; sourceGroup: string; accountId: string;
    };
    const now = Date.now();
    const fresh = isFresh(parsed.ts, parsed.symbol, now);
    return {
      price: parsed.price,
      ts: parsed.ts,
      symbol: parsed.symbol,
      sourceGroup: parsed.sourceGroup,
      accountId: parsed.accountId,
      scope: "trade",
      status: fresh ? "fresh_same_source" : "stale_same_source",
      isEstimated: false,
      marketOpen: isMarketOpen(),
      crossSource: false,
    };
  } catch {
    return null;
  }
}

/**
 * Get a verification-grade price for a symbol within a specific account or source group.
 * Fallback order: account → source group → null (NEVER cross-source).
 *
 * This is for close-price reconciliation and other trust-sensitive logic.
 */
export async function getVerifiedPrice(
  symbol: string,
  accountId: string,
  sourceGroup: string
): Promise<ResolvedPrice> {
  const now = Date.now();
  const marketOpen = isMarketOpen();

  // 1. Same account + same symbol
  const acctRaw = await redis.get(KEY.account(accountId, symbol));
  if (acctRaw) {
    try {
      const parsed = JSON.parse(acctRaw) as { price: number; ts: number; sourceGroup: string; accountId: string };
      const fresh = isFresh(parsed.ts, symbol, now);
      return {
        price: parsed.price,
        ts: parsed.ts,
        symbol,
        sourceGroup: parsed.sourceGroup,
        accountId: parsed.accountId,
        scope: "account",
        status: !marketOpen && !isCryptoSymbol(symbol) ? "market_closed" : fresh ? "fresh_same_source" : "stale_same_source",
        isEstimated: false,
        marketOpen,
        crossSource: false,
      };
    } catch { /* fall through */ }
  }

  // 2. Same source group + same symbol
  const groupRaw = await redis.get(KEY.group(sourceGroup, symbol));
  if (groupRaw) {
    try {
      const parsed = JSON.parse(groupRaw) as { price: number; ts: number; sourceGroup: string };
      const fresh = isFresh(parsed.ts, symbol, now);
      return {
        price: parsed.price,
        ts: parsed.ts,
        symbol,
        sourceGroup: parsed.sourceGroup,
        scope: "source_group",
        status: !marketOpen && !isCryptoSymbol(symbol) ? "market_closed" : fresh ? "fresh_same_source" : "stale_same_source",
        isEstimated: false,
        marketOpen,
        crossSource: false,
      };
    } catch { /* fall through */ }
  }

  // 3. UNRESOLVED — do NOT fall back to display/cross-source
  return {
    price: null,
    ts: null,
    symbol,
    sourceGroup,
    accountId,
    scope: "none",
    status: "no_price",
    isEstimated: true,
    marketOpen,
    crossSource: false,
  };
}

// ── Historical DB Price Helper ──

/**
 * Create a ResolvedPrice from a historical DB trade close.
 * This is explicitly marked as estimated/historical and must NEVER
 * be treated as a live price or used for verification.
 */
export function makeHistoricalPrice(
  symbol: string,
  price: number,
  ts: number
): ResolvedPrice {
  return {
    price,
    ts,
    symbol,
    sourceGroup: null,
    scope: "historical",
    status: "historical_trade_close",
    isEstimated: true,
    marketOpen: isMarketOpen(),
    crossSource: false,
  };
}

// ── Internal Helpers ──

function isCryptoSymbol(symbol: string): boolean {
  return getSymbolCategory(symbol) === "CRYPTO";
}

function noPrice(symbol: string, marketOpen: boolean): ResolvedPrice {
  return {
    price: null,
    ts: null,
    symbol,
    sourceGroup: null,
    scope: "none",
    status: "no_price",
    isEstimated: false,
    marketOpen,
    crossSource: false,
  };
}

// Re-export KEY for testing
export { KEY as PRICE_KEYS };
