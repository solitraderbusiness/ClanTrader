import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock declarations (must precede vi.mock calls) ----

const mockMtAccountFindMany = vi.fn();
const mockMtAccountUpdate = vi.fn();
const mockEquitySnapshotCreate = vi.fn();
const mockTradeFindMany = vi.fn();
const mockTraderStatementUpdateMany = vi.fn();

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();

const mockGetDisplayPrice = vi.fn();
const mockUpdateTrackingStatus = vi.fn();
const mockCheckRankingEligibility = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    mtAccount: {
      findMany: (...args: unknown[]) => mockMtAccountFindMany(...args),
      update: (...args: unknown[]) => mockMtAccountUpdate(...args),
    },
    equitySnapshot: {
      create: (...args: unknown[]) => mockEquitySnapshotCreate(...args),
    },
    trade: {
      findMany: (...args: unknown[]) => mockTradeFindMany(...args),
    },
    traderStatement: {
      updateMany: (...args: unknown[]) => mockTraderStatementUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
  },
}));

vi.mock("@/services/price-pool.service", () => ({
  getDisplayPrice: (...args: unknown[]) => mockGetDisplayPrice(...args),
}));

vi.mock("@/services/live-risk.service", () => ({
  updateTrackingStatus: (...args: unknown[]) => mockUpdateTrackingStatus(...args),
  checkRankingEligibility: (...args: unknown[]) => mockCheckRankingEligibility(...args),
}));

vi.mock("@/lib/socket-io-global", () => ({
  getIO: vi.fn(() => null),
}));

// chat-constants only needs TRADE_PNL_UPDATE for the broadcast path (socket is null in tests)
vi.mock("@/lib/chat-constants", () => ({
  SOCKET_EVENTS: { TRADE_PNL_UPDATE: "trade_pnl_update" },
}));

// risk-utils is used inside broadcastEstimatedPnl (socket=null path never reached here)
vi.mock("@/lib/risk-utils", () => ({
  calculateTargetRR: vi.fn(() => null),
}));

// ---- Imports (after all vi.mock calls) ----

import { runHeartbeatFallback } from "../heartbeat-fallback.service";

// ---- Factory helpers ----

/** A stale MT account with one open trade. */
function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acct-1",
    userId: "user-1",
    balance: 10000,
    equity: 9500,
    broker: "TestBroker",
    serverName: "TestServer",
    platform: "MT5",
    trades: [
      {
        id: "mt-trade-1",
        symbol: "XAUUSD",
        direction: "BUY",
        lots: 0.1,
        openPrice: 2300,
        profit: -50,
        commission: -2,
        swap: 0,
        matchedTradeId: "trade-1",
      },
    ],
    ...overrides,
  };
}

/**
 * A ResolvedPrice object representing a fresh price (ts = now).
 * Pass `tsOffsetMs` to shift the timestamp into the past.
 */
function makeResolvedPrice(
  price: number,
  tsOffsetMs = 0,
  overrides: Record<string, unknown> = {},
) {
  return {
    price,
    ts: Date.now() - tsOffsetMs,
    symbol: "XAUUSD",
    sourceGroup: "broker-1",
    accountId: null,
    scope: "display" as const,
    status: "fresh_same_source" as const,
    isEstimated: false,
    marketOpen: true,
    crossSource: false,
    ...overrides,
  };
}

// ---- Shared setup ----

beforeEach(() => {
  vi.clearAllMocks();

  // updateTrackingStatus and checkRankingEligibility resolve silently by default
  mockUpdateTrackingStatus.mockResolvedValue("STALE");
  mockCheckRankingEligibility.mockResolvedValue("RANKED");

  // Snapshot throttle key: null means no recent snapshot → allow creation
  mockRedisGet.mockResolvedValue(null);
  mockRedisSet.mockResolvedValue("OK");

  // Default db write mocks
  mockMtAccountUpdate.mockResolvedValue({});
  mockEquitySnapshotCreate.mockResolvedValue({});
  mockTraderStatementUpdateMany.mockResolvedValue({ count: 0 });
  mockTradeFindMany.mockResolvedValue([]);
});

// ============================================================
// Test suite: fresh fallback
// ============================================================

describe("runHeartbeatFallback — FALLBACK_FRESH quality", () => {
  it("creates an equity snapshot with correct fields when all prices are fresh", async () => {
    // First findMany: stale accounts with open trades
    // Second findMany (updateAllTrackingStatuses): just IDs
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    // Price is 30 seconds old — well within the 90s freshness threshold
    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));

    const result = await runHeartbeatFallback();

    expect(result.accountsProcessed).toBe(1);
    expect(result.snapshotsCreated).toBe(1);
    expect(result.errors).toBe(0);

    expect(mockEquitySnapshotCreate).toHaveBeenCalledOnce();
    expect(mockEquitySnapshotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mtAccountId: "acct-1",
          isEstimated: true,
          snapshotSource: "FALLBACK",
          estimateQuality: "FALLBACK_FRESH",
          chartEligible: true,
        }),
      }),
    );
  });

  it("updates MtAccount.equity when prices are fresh", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));

    await runHeartbeatFallback();

    expect(mockMtAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "acct-1" },
        data: expect.objectContaining({ equity: expect.any(Number) }),
      }),
    );
  });

  it("throttles snapshot creation — skips create when redis key already set", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));
    // Throttle key is set → last snapshot was recent
    mockRedisGet.mockResolvedValue("1");

    const result = await runHeartbeatFallback();

    expect(result.snapshotsCreated).toBe(0);
    expect(mockEquitySnapshotCreate).not.toHaveBeenCalled();
    // Equity update still happens (it's outside the throttle block)
    expect(mockMtAccountUpdate).toHaveBeenCalled();
  });

  it("sets the snapshot throttle key in redis after creating a snapshot", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));

    await runHeartbeatFallback();

    expect(mockRedisSet).toHaveBeenCalledWith(
      "eq-snap-est:acct-1",
      "1",
      "EX",
      300,
    );
  });

  it("calls updateTrackingStatus for each active account", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));

    await runHeartbeatFallback();

    expect(mockUpdateTrackingStatus).toHaveBeenCalledWith("acct-1");
  });

  it("returns zero pnlBroadcasts when getIO returns null", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));

    const result = await runHeartbeatFallback();

    // Socket is null in tests → no broadcasts even with fresh prices
    expect(result.pnlBroadcasts).toBe(0);
  });
});

// ============================================================
// Test suite: stale fallback
// ============================================================

describe("runHeartbeatFallback — FALLBACK_STALE quality", () => {
  it("skips snapshot creation when price is older than 90s", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    // 91 seconds old — just past the freshness threshold
    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 91_000));

    const result = await runHeartbeatFallback();

    expect(result.snapshotsCreated).toBe(0);
    expect(mockEquitySnapshotCreate).not.toHaveBeenCalled();
  });

  it("does NOT update MtAccount.equity when price is stale", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 91_000));

    await runHeartbeatFallback();

    expect(mockMtAccountUpdate).not.toHaveBeenCalled();
  });

  it("still counts the account as processed when price is stale", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 91_000));

    const result = await runHeartbeatFallback();

    expect(result.accountsProcessed).toBe(1);
  });

  it("still runs tracking status updates even when quality is FALLBACK_STALE", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 91_000));

    await runHeartbeatFallback();

    expect(mockUpdateTrackingStatus).toHaveBeenCalledWith("acct-1");
  });
});

// ============================================================
// Test suite: no-price fallback
// ============================================================

describe("runHeartbeatFallback — NO_PRICE quality", () => {
  it("skips snapshot creation when getDisplayPrice returns no_price status", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    // price-pool resolved nothing for this symbol
    mockGetDisplayPrice.mockResolvedValue({
      price: null,
      ts: null,
      symbol: "XAUUSD",
      sourceGroup: null,
      accountId: null,
      scope: "none",
      status: "no_price",
      isEstimated: false,
      marketOpen: false,
      crossSource: false,
    });

    const result = await runHeartbeatFallback();

    expect(result.snapshotsCreated).toBe(0);
    expect(mockEquitySnapshotCreate).not.toHaveBeenCalled();
  });

  it("does NOT update MtAccount.equity when price is missing", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue({
      price: null,
      ts: null,
      symbol: "XAUUSD",
      sourceGroup: null,
      accountId: null,
      scope: "none",
      status: "no_price",
      isEstimated: false,
      marketOpen: false,
      crossSource: false,
    });

    await runHeartbeatFallback();

    expect(mockMtAccountUpdate).not.toHaveBeenCalled();
  });

  it("skips snapshot when getDisplayPrice throws (no price available)", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockRejectedValue(new Error("Redis unavailable"));

    const result = await runHeartbeatFallback();

    expect(result.snapshotsCreated).toBe(0);
    expect(mockEquitySnapshotCreate).not.toHaveBeenCalled();
    expect(mockMtAccountUpdate).not.toHaveBeenCalled();
  });
});

// ============================================================
// Test suite: mixed fresh + stale (worst wins)
// ============================================================

describe("runHeartbeatFallback — mixed price freshness (worst wins)", () => {
  it("classifies quality as FALLBACK_STALE when one trade has fresh price and another has stale price", async () => {
    const accountWithTwoTrades = makeAccount({
      trades: [
        {
          id: "mt-trade-1",
          symbol: "XAUUSD",
          direction: "BUY",
          lots: 0.1,
          openPrice: 2300,
          profit: -50,
          commission: -2,
          swap: 0,
          matchedTradeId: "trade-1",
        },
        {
          id: "mt-trade-2",
          symbol: "EURUSD",
          direction: "SELL",
          lots: 0.5,
          openPrice: 1.09,
          profit: 30,
          commission: -1,
          swap: 0,
          matchedTradeId: "trade-2",
        },
      ],
    });

    mockMtAccountFindMany
      .mockResolvedValueOnce([accountWithTwoTrades])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    // XAUUSD: fresh (20s old)
    // EURUSD: stale (120s old) — worst wins → overall quality = FALLBACK_STALE
    mockGetDisplayPrice.mockImplementation((symbol: string) => {
      if (symbol === "XAUUSD") {
        return Promise.resolve(
          makeResolvedPrice(2320, 20_000, { symbol: "XAUUSD" }),
        );
      }
      return Promise.resolve({
        price: 1.092,
        ts: Date.now() - 120_000,
        symbol: "EURUSD",
        sourceGroup: "broker-1",
        accountId: null,
        scope: "display",
        status: "stale_cross_source",
        isEstimated: false,
        marketOpen: true,
        crossSource: true,
      });
    });

    const result = await runHeartbeatFallback();

    // Quality is FALLBACK_STALE → no snapshot, no equity update
    expect(result.snapshotsCreated).toBe(0);
    expect(mockEquitySnapshotCreate).not.toHaveBeenCalled();
    expect(mockMtAccountUpdate).not.toHaveBeenCalled();
  });

  it("reports pricesResolved for both symbols even when overall quality is stale", async () => {
    const accountWithTwoTrades = makeAccount({
      trades: [
        {
          id: "mt-trade-1",
          symbol: "XAUUSD",
          direction: "BUY",
          lots: 0.1,
          openPrice: 2300,
          profit: -50,
          commission: -2,
          swap: 0,
          matchedTradeId: "trade-1",
        },
        {
          id: "mt-trade-2",
          symbol: "EURUSD",
          direction: "SELL",
          lots: 0.5,
          openPrice: 1.09,
          profit: 30,
          commission: -1,
          swap: 0,
          matchedTradeId: "trade-2",
        },
      ],
    });

    mockMtAccountFindMany
      .mockResolvedValueOnce([accountWithTwoTrades])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockImplementation((symbol: string) => {
      if (symbol === "XAUUSD") {
        return Promise.resolve(
          makeResolvedPrice(2320, 20_000, { symbol: "XAUUSD" }),
        );
      }
      return Promise.resolve({
        price: 1.092,
        ts: Date.now() - 120_000,
        symbol: "EURUSD",
        sourceGroup: "broker-1",
        accountId: null,
        scope: "display",
        status: "stale_cross_source",
        isEstimated: false,
        marketOpen: true,
        crossSource: true,
      });
    });

    const result = await runHeartbeatFallback();

    expect(result.pricesResolved).toBe(2);
  });
});

// ============================================================
// Test suite: no open trades / empty state
// ============================================================

describe("runHeartbeatFallback — no open trades", () => {
  it("returns zero counts when no stale accounts have open trades", async () => {
    // All stale accounts have empty trades arrays
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount({ trades: [] })])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    const result = await runHeartbeatFallback();

    expect(result.accountsProcessed).toBe(0);
    expect(result.snapshotsCreated).toBe(0);
    expect(result.pricesResolved).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("still runs updateAllTrackingStatuses when no stale accounts have open trades", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount({ trades: [] })])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    await runHeartbeatFallback();

    // updateAllTrackingStatuses calls findMany a second time and calls updateTrackingStatus
    expect(mockUpdateTrackingStatus).toHaveBeenCalledWith("acct-1");
  });

  it("returns zero counts when no stale accounts exist at all", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await runHeartbeatFallback();

    expect(result.accountsProcessed).toBe(0);
    expect(result.snapshotsCreated).toBe(0);
    expect(result.errors).toBe(0);
  });
});

// ============================================================
// Test suite: ranking updates
// ============================================================

describe("runHeartbeatFallback — ranking updates", () => {
  it("updates traderStatement when user is PROVISIONAL", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));
    mockCheckRankingEligibility.mockResolvedValue("PROVISIONAL");

    await runHeartbeatFallback();

    expect(mockTraderStatementUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        data: { rankingStatus: "PROVISIONAL" },
      }),
    );
  });

  it("updates traderStatement when user is UNRANKED", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));
    mockCheckRankingEligibility.mockResolvedValue("UNRANKED");

    const result = await runHeartbeatFallback();

    expect(result.rankingUpdates).toBe(1);
    expect(mockTraderStatementUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        data: { rankingStatus: "UNRANKED" },
      }),
    );
  });

  it("skips traderStatement update when user is RANKED", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));
    mockCheckRankingEligibility.mockResolvedValue("RANKED");

    const result = await runHeartbeatFallback();

    expect(result.rankingUpdates).toBe(0);
    expect(mockTraderStatementUpdateMany).not.toHaveBeenCalled();
  });
});

// ============================================================
// Test suite: multiple accounts
// ============================================================

describe("runHeartbeatFallback — multiple accounts", () => {
  it("processes each account independently", async () => {
    const acct1 = makeAccount({ id: "acct-1", userId: "user-1" });
    const acct2 = makeAccount({
      id: "acct-2",
      userId: "user-2",
      trades: [
        {
          id: "mt-trade-2",
          symbol: "XAUUSD",
          direction: "SELL",
          lots: 0.2,
          openPrice: 2350,
          profit: 100,
          commission: -3,
          swap: 0,
          matchedTradeId: "trade-2",
        },
      ],
    });

    mockMtAccountFindMany
      .mockResolvedValueOnce([acct1, acct2])
      .mockResolvedValueOnce([{ id: "acct-1" }, { id: "acct-2" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));

    const result = await runHeartbeatFallback();

    expect(result.accountsProcessed).toBe(2);
    expect(result.snapshotsCreated).toBe(2);
    expect(mockMtAccountUpdate).toHaveBeenCalledTimes(2);
  });

  it("deduplicates price fetches across accounts sharing the same symbol", async () => {
    const acct1 = makeAccount({ id: "acct-1", userId: "user-1" });
    const acct2 = makeAccount({
      id: "acct-2",
      userId: "user-2",
      // also has XAUUSD — should not cause a second getDisplayPrice call per account loop
      trades: [
        {
          id: "mt-trade-2",
          symbol: "XAUUSD",
          direction: "SELL",
          lots: 0.1,
          openPrice: 2350,
          profit: 50,
          commission: -1,
          swap: 0,
          matchedTradeId: "trade-2",
        },
      ],
    });

    mockMtAccountFindMany
      .mockResolvedValueOnce([acct1, acct2])
      .mockResolvedValueOnce([{ id: "acct-1" }, { id: "acct-2" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));

    await runHeartbeatFallback();

    // Symbol set deduplication: XAUUSD appears in both accounts but is fetched once
    expect(mockGetDisplayPrice).toHaveBeenCalledTimes(1);
    expect(mockGetDisplayPrice).toHaveBeenCalledWith("XAUUSD");
  });
});

// ============================================================
// Test suite: error resilience
// ============================================================

describe("runHeartbeatFallback — error resilience", () => {
  it("increments error count when equitySnapshot.create throws", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));
    mockEquitySnapshotCreate.mockRejectedValue(new Error("DB write failed"));

    const result = await runHeartbeatFallback();

    expect(result.errors).toBeGreaterThan(0);
  });

  it("continues processing remaining accounts after one throws", async () => {
    const acct1 = makeAccount({ id: "acct-1", userId: "user-1", balance: -1 }); // invalid balance → skipped via continue
    const acct2 = makeAccount({ id: "acct-2", userId: "user-2" });

    mockMtAccountFindMany
      .mockResolvedValueOnce([acct1, acct2])
      .mockResolvedValueOnce([{ id: "acct-1" }, { id: "acct-2" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 30_000));

    const result = await runHeartbeatFallback();

    // acct-1 skipped (balance <= 0), acct-2 processed
    expect(result.accountsProcessed).toBe(1);
    expect(result.snapshotsCreated).toBe(1);
    expect(result.errors).toBe(0);
  });

  it("returns result with errors:1 when top-level db.mtAccount.findMany throws", async () => {
    mockMtAccountFindMany.mockRejectedValue(new Error("DB connection lost"));

    const result = await runHeartbeatFallback();

    expect(result.errors).toBe(1);
    expect(result.accountsProcessed).toBe(0);
    expect(result.snapshotsCreated).toBe(0);
  });
});

// ============================================================
// Regression: boundary — price exactly at 90s threshold
// ============================================================

describe("runHeartbeatFallback — freshness boundary at 90s", () => {
  it("treats a price exactly 90000ms old as FALLBACK_FRESH (boundary is exclusive)", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    // Exactly at the threshold — maxPriceAgeMs === FALLBACK_FRESH_THRESHOLD_MS (90_000)
    // Condition is: maxPriceAgeMs > FALLBACK_FRESH_THRESHOLD_MS → false → still FRESH
    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 90_000));

    const result = await runHeartbeatFallback();

    expect(result.snapshotsCreated).toBe(1);
    expect(mockEquitySnapshotCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estimateQuality: "FALLBACK_FRESH",
          chartEligible: true,
        }),
      }),
    );
  });

  it("treats a price 90001ms old as FALLBACK_STALE (one ms past threshold)", async () => {
    mockMtAccountFindMany
      .mockResolvedValueOnce([makeAccount()])
      .mockResolvedValueOnce([{ id: "acct-1" }]);

    mockGetDisplayPrice.mockResolvedValue(makeResolvedPrice(2320, 90_001));

    const result = await runHeartbeatFallback();

    expect(result.snapshotsCreated).toBe(0);
    expect(mockEquitySnapshotCreate).not.toHaveBeenCalled();
    expect(mockMtAccountUpdate).not.toHaveBeenCalled();
  });
});
