import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before vi.mock calls
// ---------------------------------------------------------------------------
const mockTradeFindUnique = vi.fn();
const mockTradeFindMany = vi.fn();
const mockTradeUpdate = vi.fn();
const mockTradeEventCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    trade: {
      findUnique: (...args: unknown[]) => mockTradeFindUnique(...args),
      findMany: (...args: unknown[]) => mockTradeFindMany(...args),
      update: (...args: unknown[]) => mockTradeUpdate(...args),
    },
    tradeEvent: {
      create: (...args: unknown[]) => mockTradeEventCreate(...args),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ log: vi.fn() }));

// integrity.service is called by qualifyTrade — stub it out to isolate the
// signal-qualification service under test.
vi.mock("@/services/integrity.service", () => ({
  computeAndSetEligibility: vi.fn(() => Promise.resolve(true)),
}));

import {
  computeQualificationDeadline,
  qualifyTrade,
  computeRiskMoney,
  expireUnqualifiedTrades,
} from "@/services/signal-qualification.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "trade-1",
    officialSignalQualified: false,
    qualificationDeadline: new Date(Date.now() + 60_000), // 1 min in future
    openedAt: new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  };
}

function makeExpiredTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "trade-exp-1",
    cardType: "SIGNAL",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeQualificationDeadline
// ---------------------------------------------------------------------------

describe("computeQualificationDeadline", () => {
  it("returns openTime + 20 seconds", () => {
    const openTime = new Date("2026-01-15T10:00:00.000Z");
    const result = computeQualificationDeadline(openTime);
    const expected = new Date("2026-01-15T10:00:20.000Z");
    expect(result.getTime()).toBe(expected.getTime());
  });

  it("preserves millisecond precision", () => {
    const openTime = new Date("2026-01-15T10:00:00.500Z");
    const result = computeQualificationDeadline(openTime);
    expect(result.getTime()).toBe(openTime.getTime() + 20_000);
  });

  it("returns a Date instance", () => {
    const result = computeQualificationDeadline(new Date());
    expect(result).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// qualifyTrade
// ---------------------------------------------------------------------------

describe("qualifyTrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTradeUpdate.mockResolvedValue({});
    mockTradeEventCreate.mockResolvedValue({});
  });

  // --- happy path: AT_OPEN ---

  it("qualifies AT_OPEN when SL and TP are valid", async () => {
    mockTradeFindUnique.mockResolvedValue(makeTrade());

    const result = await qualifyTrade(
      "trade-1",
      1.09, // sl
      1.11, // tp
      1.1,  // entry
      "AT_OPEN"
    );

    expect(result).toBe(true);
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trade-1" },
        data: expect.objectContaining({
          officialSignalQualified: true,
          officialSignalOriginType: "AT_OPEN",
          officialEntryPrice: 1.1,
          officialInitialStopLoss: 1.09,
          officialInitialTargets: [1.11],
        }),
      })
    );
  });

  it("freezes correct officialInitialRiskAbs on AT_OPEN qualification", async () => {
    mockTradeFindUnique.mockResolvedValue(makeTrade());

    await qualifyTrade("trade-1", 1.09, 1.11, 1.1, "AT_OPEN");

    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          // |entry - sl| = |1.1 - 1.09| = 0.01
          officialInitialRiskAbs: expect.closeTo(0.01, 8),
        }),
      })
    );
  });

  // --- happy path: WITHIN_WINDOW before deadline ---

  it("qualifies WITHIN_WINDOW when current time is before deadline", async () => {
    mockTradeFindUnique.mockResolvedValue(
      makeTrade({
        qualificationDeadline: new Date(Date.now() + 30_000), // 30 s remaining
      })
    );

    const result = await qualifyTrade(
      "trade-1",
      1.09,
      1.11,
      1.1,
      "WITHIN_WINDOW"
    );

    expect(result).toBe(true);
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          officialSignalQualified: true,
          officialSignalOriginType: "WITHIN_WINDOW",
        }),
      })
    );
  });

  // --- rejection: WITHIN_WINDOW past deadline ---

  it("rejects WITHIN_WINDOW when past qualification deadline", async () => {
    mockTradeFindUnique.mockResolvedValue(
      makeTrade({
        qualificationDeadline: new Date(Date.now() - 5_000), // 5 s ago
      })
    );

    const result = await qualifyTrade(
      "trade-1",
      1.09,
      1.11,
      1.1,
      "WITHIN_WINDOW"
    );

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  // --- rejection: invalid SL ---

  it("rejects when SL is zero", async () => {
    mockTradeFindUnique.mockResolvedValue(makeTrade());

    const result = await qualifyTrade("trade-1", 0, 1.11, 1.1, "AT_OPEN");

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  it("rejects when SL is negative", async () => {
    mockTradeFindUnique.mockResolvedValue(makeTrade());

    const result = await qualifyTrade("trade-1", -0.5, 1.11, 1.1, "AT_OPEN");

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  // --- rejection: invalid TP ---

  it("rejects when TP is zero", async () => {
    mockTradeFindUnique.mockResolvedValue(makeTrade());

    const result = await qualifyTrade("trade-1", 1.09, 0, 1.1, "AT_OPEN");

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  it("rejects when TP is negative", async () => {
    mockTradeFindUnique.mockResolvedValue(makeTrade());

    const result = await qualifyTrade("trade-1", 1.09, -1.0, 1.1, "AT_OPEN");

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  // --- no-op when already qualified ---

  it("returns true immediately without writing when already qualified", async () => {
    mockTradeFindUnique.mockResolvedValue(
      makeTrade({ officialSignalQualified: true })
    );

    const result = await qualifyTrade("trade-1", 1.09, 1.11, 1.1, "AT_OPEN");

    expect(result).toBe(true);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  // --- not found ---

  it("returns false when trade does not exist", async () => {
    mockTradeFindUnique.mockResolvedValue(null);

    const result = await qualifyTrade(
      "nonexistent",
      1.09,
      1.11,
      1.1,
      "AT_OPEN"
    );

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  // --- risk money wired through ---

  it("passes officialInitialRiskMoney when mtTradeData is provided and price moved", async () => {
    mockTradeFindUnique.mockResolvedValue(makeTrade());

    await qualifyTrade("trade-1", 1.09, 1.11, 1.1, "AT_OPEN", {
      lots: 0.1,
      currentPrice: 1.102, // moved 20 pips
      profit: 20,
      direction: "BUY",
    });

    const updateCall = mockTradeUpdate.mock.calls[0][0];
    expect(updateCall.data.officialInitialRiskMoney).not.toBeNull();
    expect(typeof updateCall.data.officialInitialRiskMoney).toBe("number");
  });

  it("stores null officialInitialRiskMoney when price has not moved", async () => {
    mockTradeFindUnique.mockResolvedValue(makeTrade());

    await qualifyTrade("trade-1", 1.09, 1.11, 1.1, "AT_OPEN", {
      lots: 0.1,
      currentPrice: 1.1, // same as entry — no movement
      profit: 0,
      direction: "BUY",
    });

    const updateCall = mockTradeUpdate.mock.calls[0][0];
    expect(updateCall.data.officialInitialRiskMoney).toBeNull();
  });

  // --- AT_OPEN ignores deadline even when past ---

  it("AT_OPEN bypasses deadline check even when deadline is in the past", async () => {
    mockTradeFindUnique.mockResolvedValue(
      makeTrade({
        qualificationDeadline: new Date(Date.now() - 60_000), // 1 min ago
      })
    );

    const result = await qualifyTrade(
      "trade-1",
      1.09,
      1.11,
      1.1,
      "AT_OPEN" // AT_OPEN skips deadline gate
    );

    expect(result).toBe(true);
  });

  // --- entry === sl edge case (zero risk) ---

  it("rejects when entry equals SL (zero risk abs)", async () => {
    mockTradeFindUnique.mockResolvedValue(makeTrade());

    // entry == sl → riskAbs == 0 → rejected
    const result = await qualifyTrade("trade-1", 1.1, 1.12, 1.1, "AT_OPEN");

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// computeRiskMoney
// ---------------------------------------------------------------------------

describe("computeRiskMoney", () => {
  it("returns correct risk money value when price has moved", () => {
    // dollarPerPoint = |profit / priceMove| = |100 / 0.01| = 10000
    // riskMoney = 10000 * 0.005 = 50
    const result = computeRiskMoney(
      0.1,    // lots
      1.11,   // currentPrice
      1.1,    // entryPrice  → priceMove = 0.01
      100,    // floatingProfit
      "BUY",
      0.005   // riskAbs (50 pips on 5-decimal instrument)
    );
    expect(result).toBe(50);
  });

  it("rounds result to 2 decimal places", () => {
    // dollarPerPoint = |33.33 / 0.01| = 3333
    // riskMoney = 3333 * 0.005 = 16.665 → rounds to 16.67
    const result = computeRiskMoney(
      0.1,
      1.11,
      1.1,
      33.33,
      "BUY",
      0.005
    );
    expect(result).not.toBeNull();
    // Verify it is rounded to at most 2 decimal places
    // parseFloat(toFixed(2)) === result confirms no more than 2 dp
    expect(parseFloat(result!.toFixed(2))).toBe(result);
  });

  it("returns null when price has not moved (priceMove < 0.000001)", () => {
    const result = computeRiskMoney(
      0.1,
      1.1,      // currentPrice == entryPrice
      1.1,
      0,
      "BUY",
      0.005
    );
    expect(result).toBeNull();
  });

  it("returns null for SELL trade with trivially small price movement", () => {
    const result = computeRiskMoney(
      0.1,
      1.1 + 0.0000001, // effectively no movement
      1.1,
      0.00001,
      "SELL",
      0.005
    );
    // priceMove < 0.000001 threshold → null
    expect(result).toBeNull();
  });

  it("returns null when riskMoney would be unreasonably large (> 1,000,000)", () => {
    // dollarPerPoint = 1e9 / 0.000001 → enormous
    const result = computeRiskMoney(
      1000,
      1.1 + 0.000001, // just over threshold
      1.1,
      1e9,
      "BUY",
      1000
    );
    expect(result).toBeNull();
  });

  it("returns null when floatingProfit is zero (dollarPerPoint = 0)", () => {
    const result = computeRiskMoney(
      0.1,
      1.11,
      1.1,
      0,   // no profit yet
      "BUY",
      0.005
    );
    expect(result).toBeNull();
  });

  it("handles SELL direction the same as BUY (uses abs values)", () => {
    const buy = computeRiskMoney(0.1, 1.11, 1.1, 100, "BUY", 0.005);
    const sell = computeRiskMoney(0.1, 1.09, 1.1, 100, "SELL", 0.005);
    // priceMove is the same magnitude; profit magnitude is the same
    expect(buy).toBe(sell);
  });

  it("returns positive value for a short trade in profit", () => {
    // SELL: price dropped from 1.1 → 1.09, profit positive
    const result = computeRiskMoney(
      0.1,
      1.09,
      1.1,
      100,
      "SELL",
      0.005
    );
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// expireUnqualifiedTrades
// ---------------------------------------------------------------------------

describe("expireUnqualifiedTrades", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTradeUpdate.mockResolvedValue({});
    mockTradeEventCreate.mockResolvedValue({});
  });

  it("returns 0 and writes nothing when no expired trades found", async () => {
    mockTradeFindMany.mockResolvedValue([]);

    const count = await expireUnqualifiedTrades("user-1");

    expect(count).toBe(0);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
    expect(mockTradeEventCreate).not.toHaveBeenCalled();
  });

  it("marks expired SIGNAL trades as ANALYSIS", async () => {
    mockTradeFindMany.mockResolvedValue([
      makeExpiredTrade({ id: "trade-exp-1", cardType: "SIGNAL" }),
    ]);

    const count = await expireUnqualifiedTrades("user-1");

    expect(count).toBe(1);
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trade-exp-1" },
        data: { cardType: "ANALYSIS" },
      })
    );
  });

  it("creates a tradeEvent with QUALIFICATION_EXPIRED reason", async () => {
    mockTradeFindMany.mockResolvedValue([
      makeExpiredTrade({ id: "trade-exp-1", cardType: "SIGNAL" }),
    ]);

    await expireUnqualifiedTrades("user-1");

    expect(mockTradeEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tradeId: "trade-exp-1",
          actionType: "INTEGRITY_FLAG",
          actorId: "user-1",
          newValue: expect.stringContaining("QUALIFICATION_EXPIRED"),
          source: "SYSTEM",
        }),
      })
    );
  });

  it("skips update for trades already marked as ANALYSIS", async () => {
    mockTradeFindMany.mockResolvedValue([
      makeExpiredTrade({ id: "trade-exp-1", cardType: "ANALYSIS" }), // already ANALYSIS
    ]);

    const count = await expireUnqualifiedTrades("user-1");

    expect(count).toBe(1); // still counts as expired
    expect(mockTradeUpdate).not.toHaveBeenCalled();
    expect(mockTradeEventCreate).not.toHaveBeenCalled();
  });

  it("processes multiple expired trades in one call", async () => {
    mockTradeFindMany.mockResolvedValue([
      makeExpiredTrade({ id: "trade-exp-1", cardType: "SIGNAL" }),
      makeExpiredTrade({ id: "trade-exp-2", cardType: "SIGNAL" }),
      makeExpiredTrade({ id: "trade-exp-3", cardType: "SIGNAL" }),
    ]);

    const count = await expireUnqualifiedTrades("user-1");

    expect(count).toBe(3);
    expect(mockTradeUpdate).toHaveBeenCalledTimes(3);
    expect(mockTradeEventCreate).toHaveBeenCalledTimes(3);
  });

  it("queries with correct user and deadline filters", async () => {
    mockTradeFindMany.mockResolvedValue([]);

    await expireUnqualifiedTrades("user-42");

    expect(mockTradeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-42",
          officialSignalQualified: false,
          mtLinked: true,
          status: { in: ["PENDING", "OPEN"] },
        }),
      })
    );
  });

  it("stores old and new cardType in tradeEvent values", async () => {
    mockTradeFindMany.mockResolvedValue([
      makeExpiredTrade({ id: "trade-exp-1", cardType: "SIGNAL" }),
    ]);

    await expireUnqualifiedTrades("user-1");

    const eventCall = mockTradeEventCreate.mock.calls[0][0];
    const oldValue = JSON.parse(eventCall.data.oldValue);
    const newValue = JSON.parse(eventCall.data.newValue);

    expect(oldValue.cardType).toBe("SIGNAL");
    expect(newValue.cardType).toBe("ANALYSIS");
  });
});
