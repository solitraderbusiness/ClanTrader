import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Declare mock functions BEFORE vi.mock calls ───────────────────────

// db.mtAccount
const mockMtAccountFindUnique = vi.fn();
const mockMtAccountUpdate = vi.fn();

// db.mtTrade — upsert used internally by upsertMtTrade, findUnique, findMany, update
const mockMtTradeFindUnique = vi.fn();
const mockMtTradeFindMany = vi.fn();
const mockMtTradeUpdate = vi.fn();
const mockMtTradeUpsert = vi.fn();

// db.trade, db.clanMember, db.equitySnapshot (used by inner helpers, not main path)
const mockTradeFindMany = vi.fn();
const mockClanMemberFindMany = vi.fn();
const mockEquitySnapshotCreate = vi.fn(() => Promise.resolve({}));

// db.eaPendingAction (fetchPendingActionsForAccount)
const mockEaPendingActionFindMany = vi.fn();
const mockEaPendingActionUpdateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    mtAccount: {
      findUnique: (...args: unknown[]) => mockMtAccountFindUnique(...args),
      update: (...args: unknown[]) => mockMtAccountUpdate(...args),
    },
    mtTrade: {
      findUnique: (...args: unknown[]) => mockMtTradeFindUnique(...args),
      findMany: (...args: unknown[]) => mockMtTradeFindMany(...args),
      update: (...args: unknown[]) => mockMtTradeUpdate(...args),
      upsert: (...args: unknown[]) => mockMtTradeUpsert(...args),
    },
    trade: {
      findMany: (...args: unknown[]) => mockTradeFindMany(...args),
    },
    clanMember: {
      findMany: (...args: unknown[]) => mockClanMemberFindMany(...args),
    },
    equitySnapshot: {
      create: (...args: unknown[]) => mockEquitySnapshotCreate(...args),
    },
    eaPendingAction: {
      findMany: (...args: unknown[]) => mockEaPendingActionFindMany(...args),
      updateMany: (...args: unknown[]) => mockEaPendingActionUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: { set: vi.fn(), get: vi.fn() },
}));

vi.mock("@/lib/audit", () => ({ log: vi.fn(), audit: vi.fn() }));

vi.mock("@/lib/socket-io-global", () => ({
  getIO: vi.fn(() => null),
}));

// ─── Service mocks ─────────────────────────────────────────────────────

const mockComputeExternalFlow = vi.fn();
const mockRecordBalanceEvent = vi.fn();
const mockUpdateNavDrawdown = vi.fn();

vi.mock("@/services/balance-event.service", () => ({
  computeExternalFlow: (...args: unknown[]) => mockComputeExternalFlow(...args),
  recordBalanceEvent: (...args: unknown[]) => mockRecordBalanceEvent(...args),
  updateNavDrawdown: (...args: unknown[]) => mockUpdateNavDrawdown(...args),
}));

vi.mock("@/services/live-risk.service", () => ({
  updateEquityDrawdown: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/ea-signal.service", () => ({
  autoCreateSignalFromMtTrade: vi.fn(() => Promise.resolve()),
  syncSignalModification: vi.fn(() => Promise.resolve()),
  syncSignalClose: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/signal-matcher.service", () => ({
  matchTradeToSignal: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/services/mt-statement.service", () => ({
  generateStatementFromMtAccount: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/signal-qualification.service", () => ({
  expireUnqualifiedTrades: vi.fn(() => Promise.resolve()),
  backfillRiskMoney: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/ea-action.service", () => ({
  fetchPendingActionsForAccount: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@/services/price-pool.service", () => ({
  writeHeartbeatPrice: vi.fn(() => Promise.resolve()),
  getTradeLastPrice: vi.fn(() => Promise.resolve(null)),
  getVerifiedPrice: vi.fn(() => Promise.resolve({ price: null, scope: "none" })),
  buildSourceGroup: vi.fn(() => "broker|server|MT4"),
  normalizeSymbol: vi.fn((s: string) => s),
  updateAlertHighLow: vi.fn(),
}));

vi.mock("@/lib/risk-utils", () => ({
  calculateTargetRR: vi.fn(() => null),
  getFrozenEntry: vi.fn((trade: { officialEntryPrice?: number }, fallback: number) =>
    trade.officialEntryPrice ?? fallback
  ),
  getFrozenRiskAbs: vi.fn(() => 0),
}));

// ─── Imports (after vi.mock) ───────────────────────────────────────────

import { redis } from "@/lib/redis";
import { processHeartbeat } from "@/services/ea.service";

// ─── Helpers ───────────────────────────────────────────────────────────

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc-1",
    userId: "user-1",
    apiKey: "test-api-key",
    isActive: true,
    broker: "ICMarkets",
    serverName: "ICMarketsSC-Demo01",
    platform: "MT4",
    balance: 10000,
    equity: 10050,
    initialBalance: 10000,
    margin: 0,
    freeMargin: 10050,
    floatingProfit: 50,
    ...overrides,
  };
}

function makeDbOpenTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "mt-trade-1",
    mtAccountId: "acc-1",
    ticket: BigInt(12345),
    symbol: "EURUSD",
    direction: "BUY",
    isOpen: true,
    profit: 300,
    commission: -5,
    swap: -2,
    closePrice: null,
    closeTime: null,
    matchedTradeId: null,
    ...overrides,
  };
}

/**
 * Build a minimal EaHeartbeatInput payload.
 * openTrades defaults to empty — the regression case.
 */
function makeHeartbeatInput(openTrades: unknown[] = [], balance = 10300, equity = 10300) {
  return {
    balance,
    equity,
    margin: 0,
    freeMargin: balance,
    floatingProfit: 0,
    openTrades,
    marketPrices: [],
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────

describe("processHeartbeat — regression: all-trades-close-at-once", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: not rate-limited
    vi.mocked(redis.get).mockResolvedValue(null as never);
    vi.mocked(redis.set).mockResolvedValue("OK" as never);

    // Account lookup succeeds
    mockMtAccountFindUnique.mockResolvedValue(makeAccount());
    mockMtAccountUpdate.mockResolvedValue({});

    // No open MT trades by default — overridden per test
    mockMtTradeFindMany.mockResolvedValue([]);

    // Pending actions none
    mockEaPendingActionFindMany.mockResolvedValue([]);
    mockEaPendingActionUpdateMany.mockResolvedValue({ count: 0 });

    // watch-symbols cache: no cached data, no open trades globally
    // mockMtTradeFindMany is used for both dbOpenTrades and getWatchSymbols;
    // we handle this via call-order in individual tests where needed.

    // balance-event helpers default to no-op
    mockComputeExternalFlow.mockReturnValue(null);
    mockRecordBalanceEvent.mockResolvedValue(undefined);
    mockUpdateNavDrawdown.mockResolvedValue(undefined);
  });

  // ─── Regression test ───────────────────────────────────────────────

  it("REGRESSION: detects closed trades and accumulates PnL when openTrades is empty", async () => {
    // Setup: one trade is open in DB (profit=300, commission=-5, swap=-2 → net=293)
    const dbTrade = makeDbOpenTrade();

    // First findMany call: db open trades for closure detection → returns our open trade
    // Second findMany call: getWatchSymbols distinct symbol query → empty (no global open trades)
    mockMtTradeFindMany
      .mockResolvedValueOnce([dbTrade])  // dbOpenTrades (close detection)
      .mockResolvedValueOnce([]);        // getWatchSymbols (global open trades)

    // After the closure update, heartbeat re-fetches the trade for syncSignalClose / matchTradeToSignal
    mockMtTradeFindUnique.mockResolvedValue({ ...dbTrade, isOpen: false });
    mockMtTradeUpdate.mockResolvedValue({});

    // Account had balance=10000 before; now heartbeat reports 10293 (exactly the closed PnL)
    const heartbeat = makeHeartbeatInput([], 10293, 10293);
    const account = makeAccount({ balance: 10000 });
    mockMtAccountFindUnique.mockResolvedValue(account);

    await processHeartbeat("test-api-key", heartbeat as never);

    // The closure block must have called update to mark the trade closed
    expect(mockMtTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: dbTrade.id },
        data: expect.objectContaining({ isOpen: false }),
      })
    );

    // computeExternalFlow must have been called with the correct closedTradesPnL (293)
    // so the realized profit is NOT misidentified as a deposit
    expect(mockComputeExternalFlow).toHaveBeenCalledWith(
      10000,   // prevBalance (from account before heartbeat)
      10293,   // newBalance (from heartbeat data)
      293,     // closedTradesPnL = 300 + (-5) + (-2)
    );
  });

  it("REGRESSION: does NOT flag realized profit as deposit when all trades close simultaneously", async () => {
    // Before the fix, openTrades=[] skipped closure detection → closedTradesPnL stayed 0
    // → computeExternalFlow(10000, 10293, 0) would return a false $293 deposit
    const dbTrade = makeDbOpenTrade({ profit: 300, commission: -5, swap: -2 });

    mockMtTradeFindMany
      .mockResolvedValueOnce([dbTrade])  // closure detection
      .mockResolvedValueOnce([]);        // getWatchSymbols

    mockMtTradeFindUnique.mockResolvedValue({ ...dbTrade, isOpen: false });
    mockMtTradeUpdate.mockResolvedValue({});

    // computeExternalFlow returns null (no external flow detected) when PnL is accounted for
    mockComputeExternalFlow.mockReturnValue(null);

    const heartbeat = makeHeartbeatInput([], 10293, 10293);
    const account = makeAccount({ balance: 10000 });
    mockMtAccountFindUnique.mockResolvedValue(account);

    await processHeartbeat("test-api-key", heartbeat as never);

    // recordBalanceEvent must NOT have been called — no external flow was detected
    expect(mockRecordBalanceEvent).not.toHaveBeenCalled();

    // And crucially, computeExternalFlow was called with the correct non-zero closedTradesPnL,
    // NOT with 0 (which is what the buggy path would produce)
    const [, , closedPnLArg] = mockComputeExternalFlow.mock.calls[0];
    expect(closedPnLArg).toBe(293); // 300 - 5 - 2
  });

  it("accumulates PnL across multiple simultaneously closing trades", async () => {
    // Three trades close at once
    const trade1 = makeDbOpenTrade({ id: "mt-1", ticket: BigInt(1001), profit: 200, commission: -3, swap: 0 });
    const trade2 = makeDbOpenTrade({ id: "mt-2", ticket: BigInt(1002), profit: 100, commission: -2, swap: -1 });
    const trade3 = makeDbOpenTrade({ id: "mt-3", ticket: BigInt(1003), profit: -50, commission: -1, swap: 0 });
    // Expected combined PnL: (200-3+0) + (100-2-1) + (-50-1+0) = 197 + 97 + (-51) = 243

    mockMtTradeFindMany
      .mockResolvedValueOnce([trade1, trade2, trade3])  // closure detection
      .mockResolvedValueOnce([]);                        // getWatchSymbols

    mockMtTradeFindUnique
      .mockResolvedValueOnce({ ...trade1, isOpen: false })
      .mockResolvedValueOnce({ ...trade2, isOpen: false })
      .mockResolvedValueOnce({ ...trade3, isOpen: false });
    mockMtTradeUpdate.mockResolvedValue({});

    const heartbeat = makeHeartbeatInput([], 10243, 10243);
    const account = makeAccount({ balance: 10000 });
    mockMtAccountFindUnique.mockResolvedValue(account);

    await processHeartbeat("test-api-key", heartbeat as never);

    expect(mockComputeExternalFlow).toHaveBeenCalledWith(10000, 10243, 243);
  });

  it("marks all DB-open trades as closed when heartbeat reports empty openTrades", async () => {
    const trade1 = makeDbOpenTrade({ id: "mt-1", ticket: BigInt(2001) });
    const trade2 = makeDbOpenTrade({ id: "mt-2", ticket: BigInt(2002) });

    mockMtTradeFindMany
      .mockResolvedValueOnce([trade1, trade2])
      .mockResolvedValueOnce([]);

    mockMtTradeFindUnique
      .mockResolvedValueOnce({ ...trade1, isOpen: false })
      .mockResolvedValueOnce({ ...trade2, isOpen: false });
    mockMtTradeUpdate.mockResolvedValue({});

    const heartbeat = makeHeartbeatInput([], 10000, 10000);
    mockMtAccountFindUnique.mockResolvedValue(makeAccount({ balance: 10000 }));

    await processHeartbeat("test-api-key", heartbeat as never);

    // Both trades should have been marked closed
    expect(mockMtTradeUpdate).toHaveBeenCalledTimes(2);
    expect(mockMtTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mt-1" }, data: expect.objectContaining({ isOpen: false }) })
    );
    expect(mockMtTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mt-2" }, data: expect.objectContaining({ isOpen: false }) })
    );
  });

  it("closure detection still runs when openTrades has some (but not all) trades — partial close", async () => {
    // Two trades open in DB; heartbeat only reports ticket 3001 (3002 closed)
    const trade1 = makeDbOpenTrade({ id: "mt-1", ticket: BigInt(3001), profit: 0 });
    const trade2 = makeDbOpenTrade({ id: "mt-2", ticket: BigInt(3002), profit: 150, commission: -3, swap: 0 });

    mockMtTradeFindMany
      .mockResolvedValueOnce([trade1, trade2])  // closure detection
      .mockResolvedValueOnce([]);               // getWatchSymbols

    mockMtTradeFindUnique.mockResolvedValue({ ...trade2, isOpen: false });
    // upsert for the still-open trade
    mockMtTradeUpsert.mockResolvedValue({ ...trade1, matchedTradeId: null });
    mockMtTradeFindUnique.mockResolvedValue({ ...trade2, isOpen: false });
    mockMtTradeUpdate.mockResolvedValue({});

    const stillOpenTrade = {
      ticket: 3001,
      symbol: "EURUSD",
      direction: "BUY",
      lots: 0.1,
      openPrice: 1.1,
      openTime: new Date().toISOString(),
      isOpen: true,
      profit: 0,
      currentPrice: 1.105,
    };

    const heartbeat = makeHeartbeatInput([stillOpenTrade], 10147, 10147);
    // prevBalance was 10000, trade2 PnL = 147, balance diff = 147 → no external flow
    mockMtAccountFindUnique.mockResolvedValue(makeAccount({ balance: 10000 }));

    await processHeartbeat("test-api-key", heartbeat as never);

    // Only trade2 (ticket 3002) should be closed
    expect(mockMtTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "mt-2" }, data: expect.objectContaining({ isOpen: false }) })
    );

    // computeExternalFlow called with trade2's PnL only (147)
    expect(mockComputeExternalFlow).toHaveBeenCalledWith(10000, 10147, 147);
  });

  it("computes zero closedTradesPnL when no DB-open trades exist (fresh account)", async () => {
    // No trades open in DB at all
    mockMtTradeFindMany
      .mockResolvedValueOnce([])  // closure detection: nothing open
      .mockResolvedValueOnce([]); // getWatchSymbols

    const heartbeat = makeHeartbeatInput([], 10000, 10000);
    mockMtAccountFindUnique.mockResolvedValue(makeAccount({ balance: 10000 }));

    await processHeartbeat("test-api-key", heartbeat as never);

    // closedTradesPnL should be 0 and no closure update calls made
    expect(mockMtTradeUpdate).not.toHaveBeenCalled();
    expect(mockComputeExternalFlow).toHaveBeenCalledWith(10000, 10000, 0);
  });

  // ─── Error / edge cases ────────────────────────────────────────────

  it("throws when API key is invalid", async () => {
    mockMtAccountFindUnique.mockResolvedValue(null);

    await expect(
      processHeartbeat("bad-key", makeHeartbeatInput() as never)
    ).rejects.toThrow("Invalid API key");
  });

  it("throws when account is inactive", async () => {
    mockMtAccountFindUnique.mockResolvedValue(makeAccount({ isActive: false }));

    await expect(
      processHeartbeat("test-api-key", makeHeartbeatInput() as never)
    ).rejects.toThrow("Invalid API key");
  });

  it("throws when rate-limited", async () => {
    // Rate limit key is already set in Redis
    vi.mocked(redis.get).mockResolvedValue("1" as never);

    await expect(
      processHeartbeat("test-api-key", makeHeartbeatInput() as never)
    ).rejects.toThrow("Rate limited");
  });

  it("does not call recordBalanceEvent when prevBalance is 0 (first heartbeat)", async () => {
    // Account has no previous balance
    mockMtAccountFindUnique.mockResolvedValue(makeAccount({ balance: 0 }));

    mockMtTradeFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const heartbeat = makeHeartbeatInput([], 5000, 5000);
    await processHeartbeat("test-api-key", heartbeat as never);

    // computeExternalFlow is gated on prevBalance > 0
    expect(mockComputeExternalFlow).not.toHaveBeenCalled();
    expect(mockRecordBalanceEvent).not.toHaveBeenCalled();
  });

  it("records a balance event when a genuine deposit is detected alongside trade closes", async () => {
    // Trade closes AND a deposit happens simultaneously
    const dbTrade = makeDbOpenTrade({ profit: 100, commission: -2, swap: 0 }); // PnL = 98

    mockMtTradeFindMany
      .mockResolvedValueOnce([dbTrade])
      .mockResolvedValueOnce([]);

    mockMtTradeFindUnique.mockResolvedValue({ ...dbTrade, isOpen: false });
    mockMtTradeUpdate.mockResolvedValue({});

    // prevBalance=10000, newBalance=20098, closedPnL=98 → externalFlow=10000 (deposit)
    mockComputeExternalFlow.mockReturnValue({ signedAmount: 10000, absAmount: 10000 });
    mockRecordBalanceEvent.mockResolvedValue(undefined);

    const heartbeat = makeHeartbeatInput([], 20098, 20098);
    mockMtAccountFindUnique.mockResolvedValue(makeAccount({ balance: 10000 }));

    await processHeartbeat("test-api-key", heartbeat as never);

    expect(mockComputeExternalFlow).toHaveBeenCalledWith(10000, 20098, 98);
    expect(mockRecordBalanceEvent).toHaveBeenCalledWith(
      "acc-1",
      10000,   // signedAmount
      10000,   // prevBalance
      20098,   // newBalance
      98,      // closedTradesPnL
    );
  });
});
