import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before the import of the module under test
// ---------------------------------------------------------------------------
const mockFindMany = vi.fn();
const mockUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    trade: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    traderStatement: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
    },
    traderStatementSnapshot: {
      create: vi.fn(() => Promise.resolve({ id: "snap-1" })),
    },
    clanMember: {
      findMany: vi.fn(),
    },
  },
}));

import {
  getEligibleTrades,
  calculateStatement,
} from "@/services/statement-calc.service";

// ---------------------------------------------------------------------------
// Helper — builds a trade object matching the shape returned by the service
// ---------------------------------------------------------------------------
function makeTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "trade-1",
    status: "CLOSED",
    finalRR: null,
    initialRiskAbs: 5,
    tradeCard: {
      instrument: "EURUSD",
      direction: "LONG",
      entry: 1.1,
      stopLoss: 1.095,
      targets: [1.11],
      tags: ["signal"],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockImplementation(({ create }: { create: unknown }) =>
    Promise.resolve(create)
  );
});

// ---------------------------------------------------------------------------
// getEligibleTrades
// ---------------------------------------------------------------------------
describe("getEligibleTrades", () => {
  it("passes correct filter criteria to db.trade.findMany", async () => {
    mockFindMany.mockResolvedValue([]);

    await getEligibleTrades("user-1", "clan-1");

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const query = mockFindMany.mock.calls[0][0];

    expect(query.where).toMatchObject({
      userId: "user-1",
      clanId: "clan-1",
      status: { in: ["TP_HIT", "SL_HIT", "BE", "CLOSED"] },
      integrityStatus: "VERIFIED",
      statementEligible: true,
      cardType: "SIGNAL",
      tradeCard: { tags: { hasSome: ["signal"] } },
    });
  });

  it("includes date filters when from and to are provided", async () => {
    mockFindMany.mockResolvedValue([]);

    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-01-31T23:59:59Z");

    await getEligibleTrades("user-1", "clan-1", from, to);

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.createdAt).toEqual({ gte: from, lte: to });
  });

  it("omits createdAt filter when no dates are supplied", async () => {
    mockFindMany.mockResolvedValue([]);

    await getEligibleTrades("user-1", "clan-1");

    const query = mockFindMany.mock.calls[0][0];
    expect(query.where.createdAt).toBeUndefined();
  });

  it("includes tradeCard select fields", async () => {
    mockFindMany.mockResolvedValue([]);

    await getEligibleTrades("user-1", "clan-1");

    const query = mockFindMany.mock.calls[0][0];
    expect(query.include.tradeCard.select).toEqual({
      instrument: true,
      direction: true,
      entry: true,
      stopLoss: true,
      targets: true,
      tags: true,
    });
  });
});

// ---------------------------------------------------------------------------
// calculateStatement — metrics
// ---------------------------------------------------------------------------
describe("calculateStatement", () => {
  // Case 1: Empty trades
  describe("when there are no eligible trades", () => {
    it("returns zeroed-out metrics", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.signalCount).toBe(0);
      expect(metrics.wins).toBe(0);
      expect(metrics.losses).toBe(0);
      expect(metrics.breakEven).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.avgRMultiple).toBe(0);
      expect(metrics.bestRMultiple).toBe(0);
      expect(metrics.worstRMultiple).toBe(0);
      expect(metrics.totalRMultiple).toBe(0);
      expect(metrics.instrumentDistribution).toEqual({});
      expect(metrics.directionDistribution).toEqual({});
      expect(metrics.tagDistribution).toEqual({});
    });
  });

  // Case 2: Mix of outcomes with finalRR values (Integrity Contract)
  describe("outcome-based counting with finalRR", () => {
    it("classifies wins/losses/breakeven by R value, not status label", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-a",
          status: "CLOSED",
          finalRR: 1.5,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 1.1,
            stopLoss: 1.095,
            targets: [1.11],
            tags: ["signal"],
          },
        }),
        makeTrade({
          id: "trade-b",
          status: "TP_HIT",
          finalRR: -0.3,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 1.1,
            stopLoss: 1.095,
            targets: [1.11],
            tags: ["signal"],
          },
        }),
        makeTrade({
          id: "trade-c",
          status: "SL_HIT",
          finalRR: 0.2,
          tradeCard: {
            instrument: "XAUUSD",
            direction: "SHORT",
            entry: 2000,
            stopLoss: 2010,
            targets: [1990],
            tags: ["signal"],
          },
        }),
        makeTrade({
          id: "trade-d",
          status: "BE",
          finalRR: 0,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 1.1,
            stopLoss: 1.095,
            targets: [1.11],
            tags: ["signal"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.signalCount).toBe(4);
      expect(metrics.wins).toBe(2);
      expect(metrics.losses).toBe(1);
      expect(metrics.breakEven).toBe(1);
      expect(metrics.winRate).toBe(0.5);
      expect(metrics.totalRMultiple).toBeCloseTo(1.4);
      expect(metrics.avgRMultiple).toBeCloseTo(0.35);
    });
  });

  // Case 3: Fallback R calculation when finalRR is null
  describe("fallback R calculation without finalRR", () => {
    it("computes TP_HIT R from |target - entry| / risk", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-tp",
          status: "TP_HIT",
          finalRR: null,
          initialRiskAbs: null,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 100,
            stopLoss: 95,
            targets: [110],
            tags: ["signal"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      // |110 - 100| / |100 - 95| = 10 / 5 = 2.0
      expect(metrics.totalRMultiple).toBeCloseTo(2.0);
      expect(metrics.wins).toBe(1);
    });

    it("uses initialRiskAbs when available for risk denominator", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-tp2",
          status: "TP_HIT",
          finalRR: null,
          initialRiskAbs: 10,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 100,
            stopLoss: 95,
            targets: [110],
            tags: ["signal"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      // |110 - 100| / 10 = 10 / 10 = 1.0
      expect(metrics.totalRMultiple).toBeCloseTo(1.0);
    });

    it("returns -1 for SL_HIT without finalRR", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-sl",
          status: "SL_HIT",
          finalRR: null,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 100,
            stopLoss: 95,
            targets: [110],
            tags: ["signal"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.totalRMultiple).toBe(-1);
      expect(metrics.losses).toBe(1);
    });

    it("returns 0 for BE without finalRR", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-be",
          status: "BE",
          finalRR: null,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 100,
            stopLoss: 95,
            targets: [110],
            tags: ["signal"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.totalRMultiple).toBe(0);
      expect(metrics.breakEven).toBe(1);
    });

    it("returns 0 for CLOSED without finalRR", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-closed",
          status: "CLOSED",
          finalRR: null,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 100,
            stopLoss: 95,
            targets: [110],
            tags: ["signal"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.totalRMultiple).toBe(0);
      expect(metrics.breakEven).toBe(1);
    });

    it("handles zero risk gracefully (entry === stopLoss)", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-zero-risk",
          status: "TP_HIT",
          finalRR: null,
          initialRiskAbs: 0,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 100,
            stopLoss: 100,
            targets: [110],
            tags: ["signal"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      // risk = 0 → R = 0
      expect(metrics.totalRMultiple).toBe(0);
    });

    it("combines TP_HIT and SL_HIT fallback in one statement", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-tp",
          status: "TP_HIT",
          finalRR: null,
          initialRiskAbs: null,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 100,
            stopLoss: 95,
            targets: [110],
            tags: ["signal"],
          },
        }),
        makeTrade({
          id: "trade-sl",
          status: "SL_HIT",
          finalRR: null,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 100,
            stopLoss: 95,
            targets: [110],
            tags: ["signal"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      // TP_HIT R = 2.0, SL_HIT R = -1, total = 1.0
      expect(metrics.totalRMultiple).toBeCloseTo(1.0);
      expect(metrics.wins).toBe(1);
      expect(metrics.losses).toBe(1);
      expect(metrics.winRate).toBe(0.5);
      expect(metrics.avgRMultiple).toBeCloseTo(0.5);
    });
  });

  // Case 4: Distribution tracking
  describe("distribution tracking", () => {
    it("counts instrument and direction distributions correctly", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-1",
          status: "TP_HIT",
          finalRR: 1.0,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 1.1,
            stopLoss: 1.095,
            targets: [1.11],
            tags: ["signal"],
          },
        }),
        makeTrade({
          id: "trade-2",
          status: "SL_HIT",
          finalRR: -1.0,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 1.1,
            stopLoss: 1.095,
            targets: [1.11],
            tags: ["signal"],
          },
        }),
        makeTrade({
          id: "trade-3",
          status: "CLOSED",
          finalRR: 0.5,
          tradeCard: {
            instrument: "XAUUSD",
            direction: "SHORT",
            entry: 2000,
            stopLoss: 2010,
            targets: [1990],
            tags: ["signal"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.instrumentDistribution).toEqual({
        EURUSD: 2,
        XAUUSD: 1,
      });
      expect(metrics.directionDistribution).toEqual({
        LONG: 2,
        SHORT: 1,
      });
    });

    it("counts tag distributions across all trades", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({
          id: "trade-1",
          finalRR: 1.0,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 1.1,
            stopLoss: 1.095,
            targets: [1.11],
            tags: ["signal", "scalp"],
          },
        }),
        makeTrade({
          id: "trade-2",
          finalRR: -0.5,
          tradeCard: {
            instrument: "EURUSD",
            direction: "LONG",
            entry: 1.1,
            stopLoss: 1.095,
            targets: [1.11],
            tags: ["signal", "swing"],
          },
        }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.tagDistribution).toEqual({
        signal: 2,
        scalp: 1,
        swing: 1,
      });
    });
  });

  // Case 5: Best/worst R multiple tracking
  describe("best and worst R multiple tracking", () => {
    it("tracks best and worst R multiples across trades", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({ id: "t1", finalRR: 3.5 }),
        makeTrade({ id: "t2", finalRR: -1.2 }),
        makeTrade({ id: "t3", finalRR: 0.8 }),
        makeTrade({ id: "t4", finalRR: -0.5 }),
        makeTrade({ id: "t5", finalRR: 2.0 }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.bestRMultiple).toBe(3.5);
      expect(metrics.worstRMultiple).toBe(-1.2);
    });

    it("handles single trade as both best and worst", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({ id: "t1", finalRR: 1.5 }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.bestRMultiple).toBe(1.5);
      expect(metrics.worstRMultiple).toBe(1.5);
    });

    it("resets best/worst to 0 when there are no trades", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.bestRMultiple).toBe(0);
      expect(metrics.worstRMultiple).toBe(0);
    });

    it("tracks best/worst when all R multiples are negative", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({ id: "t1", finalRR: -0.3 }),
        makeTrade({ id: "t2", finalRR: -1.0 }),
        makeTrade({ id: "t3", finalRR: -0.7 }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.bestRMultiple).toBe(-0.3);
      expect(metrics.worstRMultiple).toBe(-1.0);
    });
  });

  // Case 6: Upsert creates correct statement structure
  describe("upsert statement structure", () => {
    it("upserts with correct where clause and period data", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({ id: "t1", finalRR: 1.0 }),
      ]);

      await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-02"
      );

      expect(mockUpsert).toHaveBeenCalledTimes(1);
      const upsertArg = mockUpsert.mock.calls[0][0];

      expect(upsertArg.where).toEqual({
        userId_clanId_periodType_periodKey: {
          userId: "user-1",
          clanId: "clan-1",
          periodType: "MONTHLY",
          periodKey: "2026-02",
        },
      });

      expect(upsertArg.create).toMatchObject({
        userId: "user-1",
        clanId: "clan-1",
        periodType: "MONTHLY",
        periodKey: "2026-02",
        tradeCount: 1,
      });

      expect(upsertArg.update).toMatchObject({
        tradeCount: 1,
      });
      expect(upsertArg.update.calculatedAt).toBeInstanceOf(Date);
    });

    it("passes seasonId when provided", async () => {
      mockFindMany.mockResolvedValue([]);

      await calculateStatement(
        "user-1",
        "clan-1",
        "SEASONAL",
        "season-abc",
        undefined,
        undefined,
        "abc"
      );

      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg.create.seasonId).toBe("abc");
    });

    it("sets seasonId to null when not provided", async () => {
      mockFindMany.mockResolvedValue([]);

      await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg.create.seasonId).toBeNull();
    });

    it("includes correct tradeCount matching the number of eligible trades", async () => {
      const trades = [
        makeTrade({ id: "t1", finalRR: 1.0 }),
        makeTrade({ id: "t2", finalRR: -0.5 }),
        makeTrade({ id: "t3", finalRR: 0 }),
      ];
      mockFindMany.mockResolvedValue(trades);

      await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const upsertArg = mockUpsert.mock.calls[0][0];
      expect(upsertArg.create.tradeCount).toBe(3);
      expect(upsertArg.update.tradeCount).toBe(3);
    });
  });

  // Closed status counter
  describe("closed status counter", () => {
    it("counts CLOSED trades in the closed metric", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({ id: "t1", status: "CLOSED", finalRR: 1.0 }),
        makeTrade({ id: "t2", status: "CLOSED", finalRR: -0.5 }),
        makeTrade({ id: "t3", status: "TP_HIT", finalRR: 2.0 }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.closed).toBe(2);
    });
  });

  // Win rate precision
  describe("win rate calculation", () => {
    it("computes win rate as wins / resolved (wins + losses + breakEven)", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({ id: "t1", finalRR: 1.0 }),
        makeTrade({ id: "t2", finalRR: 2.0 }),
        makeTrade({ id: "t3", finalRR: -1.0 }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      // 2 wins / 3 resolved = 0.6666...
      expect(metrics.winRate).toBeCloseTo(2 / 3);
    });

    it("returns 0 win rate when all trades are breakeven", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({ id: "t1", finalRR: 0 }),
        makeTrade({ id: "t2", finalRR: 0 }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.winRate).toBe(0);
      expect(metrics.breakEven).toBe(2);
    });

    it("returns 1 win rate when all trades are wins", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({ id: "t1", finalRR: 0.5 }),
        makeTrade({ id: "t2", finalRR: 1.5 }),
        makeTrade({ id: "t3", finalRR: 3.0 }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      expect(metrics.winRate).toBe(1);
    });
  });

  // Average R multiple
  describe("average R multiple", () => {
    it("computes average as totalRMultiple / count of resolved trades", async () => {
      mockFindMany.mockResolvedValue([
        makeTrade({ id: "t1", finalRR: 3.0 }),
        makeTrade({ id: "t2", finalRR: -1.0 }),
        makeTrade({ id: "t3", finalRR: 2.0 }),
      ]);

      const result = await calculateStatement(
        "user-1",
        "clan-1",
        "MONTHLY",
        "2026-01"
      );

      const metrics = result.metrics;
      // (3.0 + -1.0 + 2.0) / 3 = 4.0 / 3 = 1.333...
      expect(metrics.avgRMultiple).toBeCloseTo(4 / 3);
      expect(metrics.totalRMultiple).toBeCloseTo(4.0);
    });
  });
});
