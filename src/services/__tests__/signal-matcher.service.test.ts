import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fns declared before vi.mock so hoisting works
const mockClanMemberFindMany = vi.fn();
const mockTradeFindMany = vi.fn();
const mockTradeUpdate = vi.fn();
const mockMtTradeUpdate = vi.fn();
const mockTradeEventCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    clanMember: { findMany: (...args: unknown[]) => mockClanMemberFindMany(...args) },
    trade: {
      findMany: (...args: unknown[]) => mockTradeFindMany(...args),
      update: (...args: unknown[]) => mockTradeUpdate(...args),
    },
    mtTrade: { update: (...args: unknown[]) => mockMtTradeUpdate(...args) },
    tradeEvent: { create: (...args: unknown[]) => mockTradeEventCreate(...args) },
  },
}));

const mockComputeAndSetEligibility = vi.fn();
vi.mock("@/services/integrity.service", () => ({
  computeAndSetEligibility: (...args: unknown[]) => mockComputeAndSetEligibility(...args),
}));

import {
  normalizeInstrument,
  mapDirection,
  pipDistance,
  matchTradeToSignal,
} from "@/services/signal-matcher.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMtTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "mt-1",
    mtAccountId: "acc-1",
    ticket: BigInt(100001),
    symbol: "EURUSD",
    direction: "BUY" as const,
    lots: 0.1,
    openPrice: 1.1000,
    closePrice: 1.1050,
    openTime: new Date("2026-01-15T10:02:00Z"),
    closeTime: new Date("2026-01-15T11:00:00Z"),
    stopLoss: 1.0950,
    takeProfit: 1.1100,
    profit: 50,
    commission: -0.7,
    swap: 0,
    comment: null,
    magicNumber: null,
    isOpen: false,
    matchedTradeId: null,
    ...overrides,
  };
}

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "trade-1",
    clanId: "clan-1",
    userId: "user-1",
    createdAt: new Date("2026-01-15T10:00:00Z"), // 2 min before MT opened
    tradeCard: {
      instrument: "EURUSD",
      direction: "LONG",
      entry: 1.1000,
      ...(overrides.tradeCard as Record<string, unknown> ?? {}),
    },
    ...Object.fromEntries(
      Object.entries(overrides).filter(([k]) => k !== "tradeCard")
    ),
  };
}

// ---------------------------------------------------------------------------
// normalizeInstrument
// ---------------------------------------------------------------------------

describe("normalizeInstrument", () => {
  it("returns EURUSD unchanged", () => {
    expect(normalizeInstrument("EURUSD")).toBe("EURUSD");
  });

  it("strips micro suffix (m)", () => {
    expect(normalizeInstrument("EURUSDm")).toBe("EURUSD");
  });

  it("removes slash separator", () => {
    expect(normalizeInstrument("EUR/USD")).toBe("EURUSD");
  });

  it("strips hash prefix", () => {
    expect(normalizeInstrument("#EURUSD")).toBe("EURUSD");
  });

  it("strips .pro suffix", () => {
    expect(normalizeInstrument("EURUSD.pro")).toBe("EURUSD");
  });

  it("uppercases lowercase input", () => {
    expect(normalizeInstrument("eurusd")).toBe("EURUSD");
  });

  it("keeps XAUUSD unchanged", () => {
    expect(normalizeInstrument("XAUUSD")).toBe("XAUUSD");
  });

  it("strips dot prefix", () => {
    expect(normalizeInstrument(".EURUSD")).toBe("EURUSD");
  });

  it("strips ecn suffix", () => {
    expect(normalizeInstrument("EURUSD.ecn")).toBe("EURUSD");
  });

  it("strips raw suffix", () => {
    expect(normalizeInstrument("EURUSDraw")).toBe("EURUSD");
  });

  it("strips std suffix", () => {
    expect(normalizeInstrument("EURUSDstd")).toBe("EURUSD");
  });
});

// ---------------------------------------------------------------------------
// mapDirection
// ---------------------------------------------------------------------------

describe("mapDirection", () => {
  it("maps BUY to LONG", () => {
    expect(mapDirection("BUY")).toBe("LONG");
  });

  it("maps SELL to SHORT", () => {
    expect(mapDirection("SELL")).toBe("SHORT");
  });
});

// ---------------------------------------------------------------------------
// pipDistance
// ---------------------------------------------------------------------------

describe("pipDistance", () => {
  it("calculates 50 pips for forex EURUSD", () => {
    const result = pipDistance("EURUSD", 1.1000, 1.1050);
    expect(result).toBeCloseTo(50, 5);
  });

  it("calculates 50 pips for JPY pair USDJPY", () => {
    const result = pipDistance("USDJPY", 150.00, 150.50);
    expect(result).toBeCloseTo(50, 5);
  });

  it("calculates 10 pips for gold XAUUSD", () => {
    const result = pipDistance("XAUUSD", 2000.0, 2001.0);
    expect(result).toBeCloseTo(10, 5);
  });

  it("returns 0 for zero distance", () => {
    expect(pipDistance("EURUSD", 1.1000, 1.1000)).toBe(0);
  });

  it("is symmetric (order of prices does not matter)", () => {
    const a = pipDistance("EURUSD", 1.1050, 1.1000);
    const b = pipDistance("EURUSD", 1.1000, 1.1050);
    expect(a).toBe(b);
  });

  it("uses 0.001 pip size for silver XAGUSD", () => {
    const result = pipDistance("XAGUSD", 25.000, 25.010);
    expect(result).toBeCloseTo(10, 5);
  });

  it("uses 1.0 pip size for US30 index", () => {
    const result = pipDistance("US30", 35000, 35010);
    expect(result).toBeCloseTo(10, 5);
  });
});

// ---------------------------------------------------------------------------
// matchTradeToSignal
// ---------------------------------------------------------------------------

describe("matchTradeToSignal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTradeUpdate.mockResolvedValue({});
    mockMtTradeUpdate.mockResolvedValue({});
    mockTradeEventCreate.mockResolvedValue({});
    mockComputeAndSetEligibility.mockResolvedValue(true);
  });

  it("returns false for an open trade", async () => {
    const mt = makeMtTrade({ isOpen: true });
    const result = await matchTradeToSignal(mt as never, "user-1");
    expect(result).toBe(false);
    expect(mockClanMemberFindMany).not.toHaveBeenCalled();
  });

  it("returns false when user has no clan memberships", async () => {
    mockClanMemberFindMany.mockResolvedValue([]);

    const mt = makeMtTrade();
    const result = await matchTradeToSignal(mt as never, "user-1");

    expect(result).toBe(false);
    expect(mockTradeFindMany).not.toHaveBeenCalled();
  });

  it("returns false when no instrument matches", async () => {
    mockClanMemberFindMany.mockResolvedValue([{ clanId: "clan-1" }]);
    // Candidates have a different instrument
    mockTradeFindMany.mockResolvedValue([
      makeCandidate({ tradeCard: { instrument: "GBPUSD", direction: "LONG", entry: 1.2500 } }),
    ]);

    const mt = makeMtTrade();
    const result = await matchTradeToSignal(mt as never, "user-1");

    expect(result).toBe(false);
  });

  it("returns true and links trade when match is within tolerance", async () => {
    mockClanMemberFindMany.mockResolvedValue([{ clanId: "clan-1" }]);
    mockTradeFindMany.mockResolvedValue([makeCandidate()]);

    const mt = makeMtTrade();
    const result = await matchTradeToSignal(mt as never, "user-1");

    expect(result).toBe(true);

    // Trade.update called with EA_VERIFIED
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trade-1" },
        data: expect.objectContaining({
          resolutionSource: "EA_VERIFIED",
          mtLinked: true,
        }),
      })
    );

    // MtTrade.update links to matched trade
    expect(mockMtTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "mt-1" },
        data: { matchedTradeId: "trade-1" },
      })
    );

    // TradeEvent created
    expect(mockTradeEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tradeId: "trade-1",
          actionType: "INTEGRITY_FLAG",
          newValue: "EA_VERIFIED",
        }),
      })
    );

    // Eligibility computed
    expect(mockComputeAndSetEligibility).toHaveBeenCalledWith("trade-1");
  });

  it("picks highest-scored match when multiple candidates exist", async () => {
    mockClanMemberFindMany.mockResolvedValue([{ clanId: "clan-1" }]);

    // Two candidates: one closer in time, one closer in price
    const candidateA = makeCandidate({
      id: "trade-A",
      // 4 min before MT opened → timeScore = 1 - 4/5 = 0.2
      createdAt: new Date("2026-01-15T09:58:00Z"),
      tradeCard: { instrument: "EURUSD", direction: "LONG", entry: 1.1000 },
    });

    const candidateB = makeCandidate({
      id: "trade-B",
      // 1 min before MT opened → timeScore = 1 - 1/5 = 0.8
      createdAt: new Date("2026-01-15T10:01:00Z"),
      tradeCard: { instrument: "EURUSD", direction: "LONG", entry: 1.1002 },
    });

    mockTradeFindMany.mockResolvedValue([candidateA, candidateB]);

    const mt = makeMtTrade();
    const result = await matchTradeToSignal(mt as never, "user-1");

    expect(result).toBe(true);

    // candidateB should win:
    //   timeScore = 0.8, priceScore = 1 - (2/5) = 0.6 → score = 0.8*0.6 + 0.6*0.4 = 0.72
    // candidateA:
    //   timeScore = 0.2, priceScore = 1 - (0/5) = 1.0 → score = 0.2*0.6 + 1.0*0.4 = 0.52
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trade-B" },
      })
    );
  });

  it("rejects if card was created after trade opened (time filter)", async () => {
    mockClanMemberFindMany.mockResolvedValue([{ clanId: "clan-1" }]);

    // Card created 1 minute AFTER the MT trade opened
    const candidate = makeCandidate({
      createdAt: new Date("2026-01-15T10:03:00Z"),
    });
    mockTradeFindMany.mockResolvedValue([candidate]);

    const mt = makeMtTrade({ openTime: new Date("2026-01-15T10:02:00Z") });
    const result = await matchTradeToSignal(mt as never, "user-1");

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  it("rejects if price difference exceeds 5 pips", async () => {
    mockClanMemberFindMany.mockResolvedValue([{ clanId: "clan-1" }]);

    // Entry 10 pips away from MT open price
    const candidate = makeCandidate({
      tradeCard: { instrument: "EURUSD", direction: "LONG", entry: 1.1010 },
    });
    mockTradeFindMany.mockResolvedValue([candidate]);

    const mt = makeMtTrade({ openPrice: 1.1000 });
    const result = await matchTradeToSignal(mt as never, "user-1");

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  it("rejects if time difference exceeds 5-minute window", async () => {
    mockClanMemberFindMany.mockResolvedValue([{ clanId: "clan-1" }]);

    // Card created 6 minutes before MT trade → outside 5-min window
    const candidate = makeCandidate({
      createdAt: new Date("2026-01-15T09:56:00Z"),
    });
    mockTradeFindMany.mockResolvedValue([candidate]);

    const mt = makeMtTrade({ openTime: new Date("2026-01-15T10:02:00Z") });
    const result = await matchTradeToSignal(mt as never, "user-1");

    expect(result).toBe(false);
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  it("matches with normalized instrument (broker suffix stripped)", async () => {
    mockClanMemberFindMany.mockResolvedValue([{ clanId: "clan-1" }]);
    mockTradeFindMany.mockResolvedValue([makeCandidate()]);

    // MT trade has broker suffix; candidate has plain EURUSD
    const mt = makeMtTrade({ symbol: "EURUSDm" });
    const result = await matchTradeToSignal(mt as never, "user-1");

    expect(result).toBe(true);
  });
});
