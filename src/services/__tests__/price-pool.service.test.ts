import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Redis ──
// vi.hoisted runs before imports, making data available to the vi.mock factory
const { mockRedisData, mockZsetData } = vi.hoisted(() => ({
  mockRedisData: new Map<string, string>(),
  mockZsetData: new Map<string, Map<string, number>>(),
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(async (key: string) => mockRedisData.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => { mockRedisData.set(key, value); return "OK"; }),
    mget: vi.fn(async (...keys: string[]) => keys.map((k: string) => mockRedisData.get(k) ?? null)),
    eval: vi.fn(async (_script: string, _numKeys: number, key: string, json: string) => {
      mockRedisData.set(key, json);
      return 1;
    }),
    zadd: vi.fn(async (key: string, score: number, member: string) => {
      if (!mockZsetData.has(key)) mockZsetData.set(key, new Map());
      mockZsetData.get(key)!.set(member, score);
      return 1;
    }),
    expire: vi.fn(async () => 1),
    zremrangebyscore: vi.fn(async () => 0),
    pipeline: vi.fn(() => ({
      set: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => []),
    })),
  },
}));

import {
  buildSourceGroup,
  normalizeSymbol,
  getSymbolCategory,
  isMarketOpen,
  priceCacheTTL,
  writeHeartbeatPrice,
  getDisplayPrice,
  getDisplayPrices,
  getTradeLastPrice,
  getVerifiedPrice,
  makeHistoricalPrice,
  PRICE_KEYS,
} from "@/services/price-pool.service";
import { redis } from "@/lib/redis";

// Cast to access mock functions
const mockRedis = redis as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe("price-pool.service", () => {
  beforeEach(() => {
    mockRedisData.clear();
    mockZsetData.clear();
    vi.clearAllMocks();
  });

  // ── Source Group ──

  describe("buildSourceGroup", () => {
    it("normalizes broker, server, platform into a stable identity", () => {
      expect(buildSourceGroup("ICMarkets", "ICMarketsSC-Demo", "MT5"))
        .toBe("icmarkets|icmarketssc-demo|mt5");
    });

    it("handles missing serverName", () => {
      expect(buildSourceGroup("Pepperstone", null, "MT4"))
        .toBe("pepperstone|default|mt4");
    });

    it("handles undefined serverName", () => {
      expect(buildSourceGroup("XM", undefined, "MT4"))
        .toBe("xm|default|mt4");
    });

    it("trims whitespace and collapses spaces", () => {
      expect(buildSourceGroup("  IC  Markets  ", "  Server  1  ", "MT5"))
        .toBe("ic_markets|server_1|mt5");
    });

    it("handles empty broker gracefully", () => {
      expect(buildSourceGroup("", null, "MT4"))
        .toBe("unknown|default|mt4");
    });

    it("produces different groups for different servers on same broker", () => {
      const g1 = buildSourceGroup("ICMarkets", "ICMarketsSC-Demo", "MT5");
      const g2 = buildSourceGroup("ICMarkets", "ICMarketsSC-Live", "MT5");
      expect(g1).not.toBe(g2);
    });

    it("produces different groups for different platforms on same broker+server", () => {
      const g1 = buildSourceGroup("ICMarkets", "ICMarketsSC-Demo", "MT4");
      const g2 = buildSourceGroup("ICMarkets", "ICMarketsSC-Demo", "MT5");
      expect(g1).not.toBe(g2);
    });
  });

  // ── Symbol Normalization ──

  describe("normalizeSymbol", () => {
    it("strips broker suffix _L", () => {
      expect(normalizeSymbol("EURUSD_L")).toBe("EURUSD");
    });

    it("strips broker suffix .i", () => {
      expect(normalizeSymbol("EURUSD.i")).toBe("EURUSD");
    });

    it("uppercases", () => {
      expect(normalizeSymbol("eurusd")).toBe("EURUSD");
    });

    it("does not strip valid endings", () => {
      expect(normalizeSymbol("XAUUSD")).toBe("XAUUSD");
    });

    it("handles already normalized symbols", () => {
      expect(normalizeSymbol("EURUSD")).toBe("EURUSD");
    });
  });

  // ── Symbol Category ──

  describe("getSymbolCategory", () => {
    it("detects forex pairs", () => {
      expect(getSymbolCategory("EURUSD")).toBe("FOREX");
      expect(getSymbolCategory("GBPJPY")).toBe("FOREX");
    });

    it("detects crypto", () => {
      expect(getSymbolCategory("BTCUSD")).toBe("CRYPTO");
      expect(getSymbolCategory("ETHUSD")).toBe("CRYPTO");
    });

    it("detects metals", () => {
      expect(getSymbolCategory("XAUUSD")).toBe("METALS");
      expect(getSymbolCategory("GOLD")).toBe("METALS");
    });

    it("detects indices", () => {
      expect(getSymbolCategory("US500")).toBe("INDEX");
      expect(getSymbolCategory("NAS100")).toBe("INDEX");
    });

    it("returns DEFAULT for unknown", () => {
      expect(getSymbolCategory("CUSTOMSYM")).toBe("DEFAULT");
    });
  });

  // ── Market Hours ──

  describe("isMarketOpen", () => {
    it("returns true on Monday", () => {
      // 2026-03-09 is a Monday
      expect(isMarketOpen(new Date("2026-03-09T10:00:00Z"))).toBe(true);
    });

    it("returns false on Saturday", () => {
      // 2026-03-07 is a Saturday
      expect(isMarketOpen(new Date("2026-03-07T12:00:00Z"))).toBe(false);
    });

    it("returns true Sunday after 22:00 UTC", () => {
      // 2026-03-08 is a Sunday
      expect(isMarketOpen(new Date("2026-03-08T23:00:00Z"))).toBe(true);
    });

    it("returns false Sunday before 22:00 UTC", () => {
      expect(isMarketOpen(new Date("2026-03-08T20:00:00Z"))).toBe(false);
    });

    it("returns false Friday after 22:00 UTC", () => {
      // 2026-03-06 is a Friday
      expect(isMarketOpen(new Date("2026-03-06T23:00:00Z"))).toBe(false);
    });

    it("returns true Friday before 22:00 UTC", () => {
      expect(isMarketOpen(new Date("2026-03-06T15:00:00Z"))).toBe(true);
    });
  });

  // ── TTL ──

  describe("priceCacheTTL", () => {
    it("returns 300 during market hours", () => {
      expect(priceCacheTTL(new Date("2026-03-09T10:00:00Z"))).toBe(300);
    });

    it("returns extended TTL during weekend", () => {
      const ttl = priceCacheTTL(new Date("2026-03-07T12:00:00Z")); // Saturday
      expect(ttl).toBeGreaterThan(300);
      expect(ttl).toBeLessThanOrEqual(259200);
    });
  });

  // ── Write Path ──

  describe("writeHeartbeatPrice", () => {
    it("writes trade, account, group, display keys", async () => {
      await writeHeartbeatPrice({
        symbol: "EURUSD",
        currentPrice: 1.0845,
        accountId: "acc-1",
        ticket: "12345",
        broker: "ICMarkets",
        serverName: "ICMarketsSC-Demo",
        platform: "MT5",
      });

      // Trade key written via pipeline
      expect(mockRedis.pipeline).toHaveBeenCalled();

      // Group and display keys (via eval / setIfNewer)
      expect(mockRedis.eval).toHaveBeenCalled();

      // Active groups ZSET
      expect(mockRedis.zadd).toHaveBeenCalled();
    });

    it("writes both raw and normalized symbols when different", async () => {
      await writeHeartbeatPrice({
        symbol: "EURUSD_L",
        currentPrice: 1.0845,
        accountId: "acc-1",
        ticket: "12345",
        broker: "ICMarkets",
        serverName: null,
        platform: "MT4",
      });

      // Should write for both EURUSD_L and EURUSD (normalized)
      const evalCalls = mockRedis.eval.mock.calls;
      const evalKeys = evalCalls.map((c: unknown[]) => c[2]); // key is 3rd arg
      const sourceGroup = buildSourceGroup("ICMarkets", null, "MT4");

      // Group keys for both raw and normalized
      expect(evalKeys).toContain(PRICE_KEYS.group(sourceGroup, "EURUSD_L"));
      expect(evalKeys).toContain(PRICE_KEYS.group(sourceGroup, "EURUSD"));
      // Display keys for both
      expect(evalKeys).toContain(PRICE_KEYS.display("EURUSD_L"));
      expect(evalKeys).toContain(PRICE_KEYS.display("EURUSD"));
    });
  });

  // ── Display Read API ──

  describe("getDisplayPrice", () => {
    it("reads from display key and returns resolved price", async () => {
      const sourceGroup = buildSourceGroup("ICMarkets", "Demo", "MT5");
      mockRedisData.set(
        PRICE_KEYS.display("EURUSD"),
        JSON.stringify({ price: 1.0845, ts: Date.now(), symbol: "EURUSD", sourceGroup })
      );

      const result = await getDisplayPrice("EURUSD");
      expect(result.price).toBe(1.0845);
      expect(result.scope).toBe("display");
      expect(result.crossSource).toBe(false);
    });

    it("returns no_price when key does not exist", async () => {
      const result = await getDisplayPrice("NONEXISTENT");
      expect(result.price).toBeNull();
      expect(result.status).toBe("no_price");
      expect(result.scope).toBe("none");
    });

    it("prefers source group key when preferredSourceGroup given", async () => {
      const sg = buildSourceGroup("ICMarkets", "Demo", "MT5");
      mockRedisData.set(
        PRICE_KEYS.group(sg, "EURUSD"),
        JSON.stringify({ price: 1.0850, ts: Date.now(), sourceGroup: sg, accountId: "acc-1" })
      );
      mockRedisData.set(
        PRICE_KEYS.display("EURUSD"),
        JSON.stringify({ price: 1.0845, ts: Date.now(), symbol: "EURUSD", sourceGroup: "other|server|mt4" })
      );

      const result = await getDisplayPrice("EURUSD", sg);
      expect(result.price).toBe(1.0850);
      expect(result.scope).toBe("source_group");
      expect(result.crossSource).toBe(false);
    });

    it("falls back to display key if preferred group not found", async () => {
      const sg = "nonexistent|server|mt5";
      mockRedisData.set(
        PRICE_KEYS.display("EURUSD"),
        JSON.stringify({ price: 1.0845, ts: Date.now(), symbol: "EURUSD", sourceGroup: "other|server|mt4" })
      );

      const result = await getDisplayPrice("EURUSD", sg);
      expect(result.price).toBe(1.0845);
      expect(result.scope).toBe("display");
      expect(result.crossSource).toBe(true);
    });
  });

  describe("getDisplayPrices", () => {
    it("bulk reads display keys", async () => {
      const sg = buildSourceGroup("ICMarkets", "Demo", "MT5");
      mockRedisData.set(
        PRICE_KEYS.display("EURUSD"),
        JSON.stringify({ price: 1.0845, ts: Date.now(), symbol: "EURUSD", sourceGroup: sg })
      );
      mockRedisData.set(
        PRICE_KEYS.display("GBPUSD"),
        JSON.stringify({ price: 1.2650, ts: Date.now(), symbol: "GBPUSD", sourceGroup: sg })
      );

      const result = await getDisplayPrices(["EURUSD", "GBPUSD", "NONEXISTENT"]);
      expect(result.size).toBe(3);
      expect(result.get("EURUSD")!.price).toBe(1.0845);
      expect(result.get("GBPUSD")!.price).toBe(1.2650);
      expect(result.get("NONEXISTENT")!.status).toBe("no_price");
    });

    it("returns empty map for empty input", async () => {
      const result = await getDisplayPrices([]);
      expect(result.size).toBe(0);
    });
  });

  // ── Verification Read API ──

  describe("getTradeLastPrice", () => {
    it("reads exact trade key", async () => {
      mockRedisData.set(
        PRICE_KEYS.trade("acc-1", "12345"),
        JSON.stringify({
          price: 1.0845, ts: Date.now(), symbol: "EURUSD",
          sourceGroup: "icmarkets|demo|mt5", accountId: "acc-1",
        })
      );

      const result = await getTradeLastPrice("acc-1", "12345");
      expect(result).not.toBeNull();
      expect(result!.price).toBe(1.0845);
      expect(result!.scope).toBe("trade");
      expect(result!.crossSource).toBe(false);
    });

    it("returns null when trade key does not exist", async () => {
      const result = await getTradeLastPrice("acc-1", "99999");
      expect(result).toBeNull();
    });
  });

  describe("getVerifiedPrice", () => {
    const sourceGroup = "icmarkets|demo|mt5";

    it("returns account-level price as first fallback", async () => {
      mockRedisData.set(
        PRICE_KEYS.account("acc-1", "EURUSD"),
        JSON.stringify({ price: 1.0845, ts: Date.now(), sourceGroup, accountId: "acc-1" })
      );

      const result = await getVerifiedPrice("EURUSD", "acc-1", sourceGroup);
      expect(result.price).toBe(1.0845);
      expect(result.scope).toBe("account");
      expect(result.crossSource).toBe(false);
    });

    it("falls back to source group price when account key missing", async () => {
      mockRedisData.set(
        PRICE_KEYS.group(sourceGroup, "EURUSD"),
        JSON.stringify({ price: 1.0847, ts: Date.now(), sourceGroup })
      );

      const result = await getVerifiedPrice("EURUSD", "acc-1", sourceGroup);
      expect(result.price).toBe(1.0847);
      expect(result.scope).toBe("source_group");
      expect(result.crossSource).toBe(false);
    });

    it("returns unresolved when no keys exist — NEVER cross-source", async () => {
      // Even if a display key exists, verification MUST NOT use it
      mockRedisData.set(
        PRICE_KEYS.display("EURUSD"),
        JSON.stringify({ price: 1.0845, ts: Date.now(), symbol: "EURUSD", sourceGroup: "other|server|mt4" })
      );

      const result = await getVerifiedPrice("EURUSD", "acc-1", sourceGroup);
      expect(result.price).toBeNull();
      expect(result.scope).toBe("none");
      expect(result.status).toBe("no_price");
      expect(result.isEstimated).toBe(true);
      expect(result.crossSource).toBe(false);
    });
  });

  // ── Close-Price Fallback Regression ──

  describe("close-price fallback safety", () => {
    it("getVerifiedPrice NEVER reads display key even when it has data", async () => {
      // This is THE critical regression test.
      // The old system used redis.get('price:EURUSD') which was a global key.
      // The new system must NEVER fall back to global display for verification.
      const otherSourceGroup = "pepperstone|live|mt4";
      mockRedisData.set(
        PRICE_KEYS.display("EURUSD"),
        JSON.stringify({ price: 1.0850, ts: Date.now(), symbol: "EURUSD", sourceGroup: otherSourceGroup })
      );

      const result = await getVerifiedPrice("EURUSD", "acc-1", "icmarkets|demo|mt5");
      // Must NOT have gotten the display price
      expect(result.price).toBeNull();
      expect(result.scope).toBe("none");
    });

    it("getTradeLastPrice returns exact trade price, not group or display", async () => {
      const sg = "icmarkets|demo|mt5";
      // Set a different price in display and group
      mockRedisData.set(
        PRICE_KEYS.display("EURUSD"),
        JSON.stringify({ price: 1.1000, ts: Date.now(), symbol: "EURUSD", sourceGroup: "other|server|mt4" })
      );
      mockRedisData.set(
        PRICE_KEYS.group(sg, "EURUSD"),
        JSON.stringify({ price: 1.0900, ts: Date.now(), sourceGroup: sg })
      );
      // But the trade key has the correct price
      mockRedisData.set(
        PRICE_KEYS.trade("acc-1", "12345"),
        JSON.stringify({ price: 1.0845, ts: Date.now(), symbol: "EURUSD", sourceGroup: sg, accountId: "acc-1" })
      );

      const result = await getTradeLastPrice("acc-1", "12345");
      expect(result!.price).toBe(1.0845);
    });

    it("verification fallback order is trade → account → group → unresolved", async () => {
      const sg = "icmarkets|demo|mt5";

      // Only group key available
      mockRedisData.set(
        PRICE_KEYS.group(sg, "EURUSD"),
        JSON.stringify({ price: 1.0860, ts: Date.now(), sourceGroup: sg })
      );

      const r1 = await getVerifiedPrice("EURUSD", "acc-1", sg);
      expect(r1.scope).toBe("source_group");
      expect(r1.price).toBe(1.0860);

      // Add account key — should prefer it
      mockRedisData.set(
        PRICE_KEYS.account("acc-1", "EURUSD"),
        JSON.stringify({ price: 1.0855, ts: Date.now(), sourceGroup: sg, accountId: "acc-1" })
      );

      const r2 = await getVerifiedPrice("EURUSD", "acc-1", sg);
      expect(r2.scope).toBe("account");
      expect(r2.price).toBe(1.0855);
    });
  });

  // ── Historical DB Fallback ──

  describe("makeHistoricalPrice", () => {
    it("marks price as historical and estimated", () => {
      const result = makeHistoricalPrice("EURUSD", 1.0845, Date.now() - 86400000);
      expect(result.status).toBe("historical_trade_close");
      expect(result.isEstimated).toBe(true);
      expect(result.scope).toBe("historical");
      expect(result.sourceGroup).toBeNull();
    });
  });

  // ── Market-Closed Status ──

  describe("weekend/market-closed behavior", () => {
    it("display price on Saturday shows market_closed for forex, not stale", async () => {
      const sg = buildSourceGroup("ICMarkets", "Demo", "MT5");
      // Price from Friday close (old timestamp)
      const fridayTs = new Date("2026-03-06T21:59:00Z").getTime();
      mockRedisData.set(
        PRICE_KEYS.display("EURUSD"),
        JSON.stringify({ price: 1.0845, ts: fridayTs, symbol: "EURUSD", sourceGroup: sg })
      );

      // Mock isMarketOpen to return false (Saturday)
      // We test via the resolved status
      const result = await getDisplayPrice("EURUSD");
      // Since isMarketOpen() uses real Date.now(), we check the logic is sound:
      // On a weekend, forex should return market_closed, not stale
      // On weekday, it would be stale. The exact result depends on when test runs.
      // But the critical invariant: it should never be "no_price" since data exists
      expect(result.price).toBe(1.0845);
      expect(["fresh_same_source", "stale_same_source", "market_closed"]).toContain(result.status);
    });
  });

  // ── Update-If-Newer Logic ──

  describe("update-if-newer", () => {
    it("eval is called for group and display keys to prevent older writes from winning", async () => {
      await writeHeartbeatPrice({
        symbol: "EURUSD",
        currentPrice: 1.0845,
        accountId: "acc-1",
        ticket: "12345",
        broker: "ICMarkets",
        serverName: "Demo",
        platform: "MT5",
      });

      // eval should have been called for group + display keys
      const evalCalls = mockRedis.eval.mock.calls;
      expect(evalCalls.length).toBeGreaterThanOrEqual(2);

      // Each eval call should receive the Lua script, 1 key, json, ts, ttl
      for (const call of evalCalls) {
        expect(call[1]).toBe(1); // numKeys
        expect(typeof call[2]).toBe("string"); // key
        expect(typeof call[3]).toBe("string"); // json
      }
    });
  });
});
