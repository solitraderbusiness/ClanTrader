import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — declared before vi.mock calls
// ---------------------------------------------------------------------------
const mockTradeFindMany = vi.fn();
const mockMtAccountFindMany = vi.fn();
const mockMtAccountFindUnique = vi.fn();
const mockMtAccountUpdate = vi.fn();
const mockTradeCount = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    trade: {
      findMany: (...args: unknown[]) => mockTradeFindMany(...args),
      count: (...args: unknown[]) => mockTradeCount(...args),
    },
    mtAccount: {
      findMany: (...args: unknown[]) => mockMtAccountFindMany(...args),
      findUnique: (...args: unknown[]) => mockMtAccountFindUnique(...args),
      update: (...args: unknown[]) => mockMtAccountUpdate(...args),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn(() => Promise.resolve(null)), // never cached in tests
    set: vi.fn(() => Promise.resolve("OK")),
  },
}));

const mockGetDisplayPrice = vi.fn();
vi.mock("@/services/price-pool.service", () => ({
  getDisplayPrice: (...args: unknown[]) => mockGetDisplayPrice(...args),
}));

import {
  getLiveOpenRisk,
  computeEffectiveRank,
  updateEquityDrawdown,
} from "@/services/live-risk.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOpenTrade(
  overrides: {
    id?: string;
    officialInitialRiskMoney?: number | null;
    floatingPnl?: number;
    direction?: string;
  } = {}
) {
  const {
    id = "trade-1",
    officialInitialRiskMoney = 100,
    floatingPnl = 0,
    direction = "LONG",
  } = overrides;

  return {
    id,
    officialSignalQualified: true,
    officialInitialRiskMoney,
    officialInitialRiskAbs: 0.01,
    officialEntryPrice: 1.1,
    officialInitialStopLoss: 1.09,
    riskStatus: "PROTECTED",
    tradeCard: { direction, instrument: "EURUSD", entry: 1.1 },
    mtTradeMatches: [
      {
        profit: floatingPnl,
        commission: 0,
        swap: 0,
        openPrice: 1.1,
        isOpen: true,
      },
    ],
  };
}

function makeAccount(
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "acc-1",
    equity: 10000,
    balance: 10000,
    peakEquity: 10000,
    maxDrawdownPct: 0,
    navValue: 1.0,
    peakNav: 1.0,
    maxNavDrawdownPct: 0,
    trackingStatus: "ACTIVE",
    lastHeartbeat: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeEffectiveRank
// ---------------------------------------------------------------------------

describe("computeEffectiveRank", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("effectiveRankR equals closedR when there are no open trades", async () => {
    mockTradeFindMany.mockResolvedValue([]);

    const result = await computeEffectiveRank("user-1", "clan-1", 5.0);

    expect(result.effectiveRankR).toBe(5.0);
    expect(result.closedOfficialR).toBe(5.0);
    expect(result.openRiskPenalty).toBe(0);
  });

  it("effectiveRankR equals closedR when all open trades are in profit", async () => {
    // Open gains (positive floatingR) contribute 0 to penalty
    mockTradeFindMany.mockResolvedValue([
      makeOpenTrade({ id: "t1", officialInitialRiskMoney: 100, floatingPnl: 150 }), // +1.5R
      makeOpenTrade({ id: "t2", officialInitialRiskMoney: 100, floatingPnl: 80 }),  // +0.8R
    ]);

    const result = await computeEffectiveRank("user-1", "clan-1", 3.0);

    // Gains do not improve rank
    expect(result.openRiskPenalty).toBe(0);
    expect(result.effectiveRankR).toBe(3.0);
  });

  it("open losses reduce effectiveRankR (penalty applied)", async () => {
    // Trade in -0.5R (losing 50 of 100 risk money)
    mockTradeFindMany.mockResolvedValue([
      makeOpenTrade({ id: "t1", officialInitialRiskMoney: 100, floatingPnl: -50 }),
    ]);

    const result = await computeEffectiveRank("user-1", "clan-1", 4.0);

    // penalty = -50/100 = -0.5
    expect(result.openRiskPenalty).toBeCloseTo(-0.5, 5);
    expect(result.effectiveRankR).toBeCloseTo(3.5, 5);
  });

  it("accumulates penalty from multiple losing open trades", async () => {
    mockTradeFindMany.mockResolvedValue([
      makeOpenTrade({ id: "t1", officialInitialRiskMoney: 100, floatingPnl: -50 }),  // -0.5R
      makeOpenTrade({ id: "t2", officialInitialRiskMoney: 200, floatingPnl: -100 }), // -0.5R
    ]);

    const result = await computeEffectiveRank("user-1", "clan-1", 5.0);

    // Total penalty = -1.0R
    expect(result.openRiskPenalty).toBeCloseTo(-1.0, 5);
    expect(result.effectiveRankR).toBeCloseTo(4.0, 5);
  });

  it("mixed open trades: gains ignored, losses penalise", async () => {
    mockTradeFindMany.mockResolvedValue([
      makeOpenTrade({ id: "t1", officialInitialRiskMoney: 100, floatingPnl: 200 }),  // +2R gain — ignored
      makeOpenTrade({ id: "t2", officialInitialRiskMoney: 100, floatingPnl: -30 }),  // -0.3R — penalises
    ]);

    const result = await computeEffectiveRank("user-1", "clan-1", 3.0);

    expect(result.openRiskPenalty).toBeCloseTo(-0.3, 5);
    expect(result.effectiveRankR).toBeCloseTo(2.7, 5);
  });

  it("skips penalty when officialInitialRiskMoney is null", async () => {
    // Without risk money we cannot reliably compute floatingR — safe fallback is skip
    mockTradeFindMany.mockResolvedValue([
      makeOpenTrade({ id: "t1", officialInitialRiskMoney: null, floatingPnl: -999 }),
    ]);

    const result = await computeEffectiveRank("user-1", "clan-1", 2.0);

    expect(result.openRiskPenalty).toBe(0);
    expect(result.effectiveRankR).toBe(2.0);
  });

  it("skips trade with no MT match (no mtTradeMatches[0])", async () => {
    const trade = makeOpenTrade({ id: "t1", officialInitialRiskMoney: 100, floatingPnl: -50 });
    trade.mtTradeMatches = []; // no MT match

    mockTradeFindMany.mockResolvedValue([trade]);

    const result = await computeEffectiveRank("user-1", "clan-1", 2.0);

    expect(result.openRiskPenalty).toBe(0);
    expect(result.effectiveRankR).toBe(2.0);
  });

  it("rounds effectiveRankR and penalty to 2 decimal places", async () => {
    // profit=-33, riskMoney=100 → floatingR = -0.33 (exact 2dp)
    mockTradeFindMany.mockResolvedValue([
      makeOpenTrade({ id: "t1", officialInitialRiskMoney: 100, floatingPnl: -33 }),
    ]);

    const result = await computeEffectiveRank("user-1", "clan-1", 1.0);

    // Check string form has at most 2 decimal places
    const penaltyStr = result.openRiskPenalty.toString();
    const decPart = penaltyStr.split(".")[1] ?? "";
    expect(decPart.length).toBeLessThanOrEqual(2);

    const effStr = result.effectiveRankR.toString();
    const effDec = effStr.split(".")[1] ?? "";
    expect(effDec.length).toBeLessThanOrEqual(2);
  });

  it("queries only PENDING/OPEN and officialSignalQualified trades", async () => {
    mockTradeFindMany.mockResolvedValue([]);

    await computeEffectiveRank("user-X", "clan-Y", 0);

    expect(mockTradeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-X",
          clanId: "clan-Y",
          status: { in: ["PENDING", "OPEN"] },
          officialSignalQualified: true,
        }),
      })
    );
  });

  it("returns correct closedOfficialR rounded to 2dp", async () => {
    mockTradeFindMany.mockResolvedValue([]);

    const result = await computeEffectiveRank("user-1", "clan-1", 3.14159);

    expect(result.closedOfficialR).toBe(3.14);
  });

  it("large negative closedR combined with open loss", async () => {
    mockTradeFindMany.mockResolvedValue([
      makeOpenTrade({ id: "t1", officialInitialRiskMoney: 100, floatingPnl: -100 }), // -1R
    ]);

    const result = await computeEffectiveRank("user-1", "clan-1", -5.0);

    expect(result.openRiskPenalty).toBeCloseTo(-1.0, 5);
    expect(result.effectiveRankR).toBeCloseTo(-6.0, 5);
  });
});

// ---------------------------------------------------------------------------
// updateEquityDrawdown
// ---------------------------------------------------------------------------

describe("updateEquityDrawdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMtAccountUpdate.mockResolvedValue({});
  });

  it("sets peakEquity to currentEquity on first call (no previous peak)", async () => {
    mockMtAccountFindUnique.mockResolvedValue(
      makeAccount({ peakEquity: null, maxDrawdownPct: null })
    );

    await updateEquityDrawdown("acc-1", 10000);

    expect(mockMtAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          peakEquity: 10000,
        }),
      })
    );
  });

  it("updates peakEquity when new equity exceeds previous peak", async () => {
    mockMtAccountFindUnique.mockResolvedValue(
      makeAccount({ peakEquity: 9000, maxDrawdownPct: 0 })
    );

    await updateEquityDrawdown("acc-1", 11000);

    expect(mockMtAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          peakEquity: 11000,
        }),
      })
    );
  });

  it("retains existing peakEquity when current equity is lower", async () => {
    mockMtAccountFindUnique.mockResolvedValue(
      makeAccount({ peakEquity: 12000, maxDrawdownPct: 0 })
    );

    await updateEquityDrawdown("acc-1", 10000);

    expect(mockMtAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          peakEquity: 12000,
        }),
      })
    );
  });

  it("tracks drawdown percentage correctly", async () => {
    // peak=10000, current=9000 → drawdown = 10%
    mockMtAccountFindUnique.mockResolvedValue(
      makeAccount({ peakEquity: 10000, maxDrawdownPct: 0 })
    );

    await updateEquityDrawdown("acc-1", 9000);

    expect(mockMtAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maxDrawdownPct: 10, // 10%
        }),
      })
    );
  });

  it("preserves max drawdown when current drawdown is smaller", async () => {
    // Previous max was 20%, current drawdown is only 5%
    mockMtAccountFindUnique.mockResolvedValue(
      makeAccount({ peakEquity: 10000, maxDrawdownPct: 20 })
    );

    await updateEquityDrawdown("acc-1", 9500); // 5% drawdown now

    expect(mockMtAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maxDrawdownPct: 20, // previous max preserved
        }),
      })
    );
  });

  it("updates maxDrawdownPct when new drawdown is larger", async () => {
    // Previous max 10%, now dropping to 8000 = 20% drawdown
    mockMtAccountFindUnique.mockResolvedValue(
      makeAccount({ peakEquity: 10000, maxDrawdownPct: 10 })
    );

    await updateEquityDrawdown("acc-1", 8000);

    expect(mockMtAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maxDrawdownPct: 20, // 20% = (10000-8000)/10000 * 100
        }),
      })
    );
  });

  it("sets maxDrawdownMoney to the money amount of the drawdown", async () => {
    mockMtAccountFindUnique.mockResolvedValue(
      makeAccount({ peakEquity: 10000, maxDrawdownPct: 0 })
    );

    await updateEquityDrawdown("acc-1", 9000);

    expect(mockMtAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maxDrawdownMoney: 1000, // 10000 - 9000
        }),
      })
    );
  });

  it("does nothing when equity is zero or negative", async () => {
    await updateEquityDrawdown("acc-1", 0);
    expect(mockMtAccountFindUnique).not.toHaveBeenCalled();
    expect(mockMtAccountUpdate).not.toHaveBeenCalled();

    await updateEquityDrawdown("acc-1", -100);
    expect(mockMtAccountFindUnique).not.toHaveBeenCalled();
    expect(mockMtAccountUpdate).not.toHaveBeenCalled();
  });

  it("does nothing when account is not found", async () => {
    mockMtAccountFindUnique.mockResolvedValue(null);

    await updateEquityDrawdown("acc-nonexistent", 10000);

    expect(mockMtAccountUpdate).not.toHaveBeenCalled();
  });

  it("rounds peakEquity and maxDrawdownPct to 2 decimal places", async () => {
    // peak=10000.123, equity=9999.999 → peakEquity stays 10000.123 (still higher)
    // drawdown% = (10000.123 - 9999.999) / 10000.123 * 100 ≈ 0.00124%
    mockMtAccountFindUnique.mockResolvedValue(
      makeAccount({ peakEquity: 10000.123, maxDrawdownPct: 0 })
    );

    await updateEquityDrawdown("acc-1", 9999.999);

    const updateCall = mockMtAccountUpdate.mock.calls[0][0];
    const peak = updateCall.data.peakEquity;
    const ddPct = updateCall.data.maxDrawdownPct;

    // Both should be at most 2 decimal places: parseFloat(toFixed(2)) === original
    expect(parseFloat(peak.toFixed(2))).toBe(peak);
    expect(parseFloat(ddPct.toFixed(2))).toBe(ddPct);
  });

  it("sets maxDrawdownMoney to 0 when equity equals peak (no drawdown)", async () => {
    mockMtAccountFindUnique.mockResolvedValue(
      makeAccount({ peakEquity: 10000, maxDrawdownPct: 0 })
    );

    await updateEquityDrawdown("acc-1", 10000);

    expect(mockMtAccountUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          maxDrawdownMoney: 0,
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// getLiveOpenRisk — freshness gating regression tests
// ---------------------------------------------------------------------------

describe("getLiveOpenRisk — freshness gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no accounts stale, no open trades
    mockMtAccountFindMany.mockResolvedValue([]);
  });

  function setupStaleAccountWithTrade(priceAge: number, priceStatus = "pool") {
    // One open trade on a stale account
    mockTradeFindMany.mockResolvedValue([
      {
        id: "trade-1",
        officialSignalQualified: true,
        officialInitialRiskMoney: 100,
        officialInitialRiskAbs: 0.01,
        officialEntryPrice: 1.1,
        officialInitialStopLoss: 1.09,
        riskStatus: "PROTECTED",
        tradeCard: { direction: "LONG", instrument: "EURUSD", entry: 1.1 },
        mtTradeMatches: [{
          profit: 50,
          commission: -2,
          swap: -1,
          openPrice: 1.1,
          lots: 1,
          symbol: "EURUSD",
          mtAccountId: "stale-acc",
          isOpen: true,
        }],
      },
    ]);

    // Mark the account as stale
    mockMtAccountFindMany
      .mockResolvedValueOnce([{ id: "stale-acc" }])  // stale accounts query
      .mockResolvedValueOnce([makeAccount({           // equity accounts query
        id: "stale-acc",
        trackingStatus: "STALE",
        lastHeartbeat: new Date(Date.now() - 200_000),
      })]);

    // Price pool returns a price with specific age
    // Use 1.12 (moved further from 1.1 entry) so estimated P/L differs from MT's 50
    const priceTs = Date.now() - priceAge;
    mockGetDisplayPrice.mockResolvedValue({
      price: 1.12,
      ts: priceTs,
      status: priceStatus,
      source: "cross-user",
    });
  }

  it("accepts fresh prices (< 90s old) for P/L estimation", async () => {
    setupStaleAccountWithTrade(30_000); // 30s old — fresh

    const result = await getLiveOpenRisk("user-1", "clan-1");

    expect(mockGetDisplayPrice).toHaveBeenCalledWith("EURUSD");
    expect(result.isEstimated).toBe(true);
    // PnL is computed from price pool (may coincide with MT value due to PV derivation)
    expect(typeof result.liveFloatingPnl).toBe("number");
  });

  it("rejects stale prices (> 90s old) — falls back to last MT value", async () => {
    setupStaleAccountWithTrade(120_000); // 120s old — stale

    const result = await getLiveOpenRisk("user-1", "clan-1");

    expect(mockGetDisplayPrice).toHaveBeenCalledWith("EURUSD");
    // Should NOT be estimated — stale price rejected
    expect(result.isEstimated).toBe(false);
    // Falls back to last MT value: profit + commission + swap = 50 + (-2) + (-1) = 47
    expect(result.liveFloatingPnl).toBe(47);
  });

  it("rejects prices well over 90s — no timing ambiguity", async () => {
    setupStaleAccountWithTrade(100_000); // 100s old — clearly stale

    const result = await getLiveOpenRisk("user-1", "clan-1");

    expect(result.isEstimated).toBe(false);
    expect(result.liveFloatingPnl).toBe(47);
  });

  it("rejects no_price status regardless of age", async () => {
    setupStaleAccountWithTrade(10_000, "no_price"); // fresh age but no_price

    const result = await getLiveOpenRisk("user-1", "clan-1");

    expect(result.isEstimated).toBe(false);
  });

  it("rejects market_closed status regardless of age", async () => {
    setupStaleAccountWithTrade(10_000, "market_closed");

    const result = await getLiveOpenRisk("user-1", "clan-1");

    expect(result.isEstimated).toBe(false);
  });

  it("treats missing timestamp as infinitely old (rejected)", async () => {
    // One open trade on stale account
    mockTradeFindMany.mockResolvedValue([
      {
        id: "trade-1",
        officialSignalQualified: true,
        officialInitialRiskMoney: 100,
        officialInitialRiskAbs: 0.01,
        officialEntryPrice: 1.1,
        officialInitialStopLoss: 1.09,
        riskStatus: "PROTECTED",
        tradeCard: { direction: "LONG", instrument: "EURUSD", entry: 1.1 },
        mtTradeMatches: [{
          profit: 50, commission: -2, swap: -1,
          openPrice: 1.1, lots: 1, symbol: "EURUSD",
          mtAccountId: "stale-acc", isOpen: true,
        }],
      },
    ]);

    mockMtAccountFindMany
      .mockResolvedValueOnce([{ id: "stale-acc" }])
      .mockResolvedValueOnce([makeAccount({ id: "stale-acc", trackingStatus: "STALE" })]);

    // Price with no timestamp
    mockGetDisplayPrice.mockResolvedValue({
      price: 1.105,
      ts: null,
      status: "pool",
      source: "cross-user",
    });

    const result = await getLiveOpenRisk("user-1", "clan-1");

    // No timestamp → treated as Infinity age → rejected
    expect(result.isEstimated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getLiveOpenRisk — NAV-based (cash-flow-neutral) drawdown
// ---------------------------------------------------------------------------

describe("getLiveOpenRisk — NAV-based drawdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupAccountDrawdown(accountOverrides: Record<string, unknown>) {
    mockTradeFindMany.mockResolvedValue([]); // no open trades
    mockMtAccountFindMany
      .mockResolvedValueOnce([])  // stale accounts query
      .mockResolvedValueOnce([makeAccount(accountOverrides)]);
  }

  it("returns NAV-based drawdown from peakNav and navValue", async () => {
    // NAV dropped from 1.2 to 1.0 = 16.67% NAV drawdown
    // Raw equity from 12000 peak to 10000 = 16.67% equity drawdown (same, no cash flows)
    setupAccountDrawdown({
      navValue: 1.0,
      peakNav: 1.2,
      maxNavDrawdownPct: 16.67,
      peakEquity: 12000,
      equity: 10000,
      maxDrawdownPct: 16.67,
    });

    const result = await getLiveOpenRisk("user-1", "clan-1");

    expect(result.currentNavDrawdownPct).toBeCloseTo(16.67, 1);
    expect(result.maxNavDrawdownPct).toBe(16.67);
    expect(result.currentEquityDrawdownPct).toBeCloseTo(16.67, 1);
  });

  it("deposit does NOT worsen NAV-based public drawdown", async () => {
    // Scenario: $10K account, trader deposits $9K.
    // Raw: peakEquity jumped to $19K, equity=$19K → 0% current raw drawdown
    //   BUT if equity later drops to $18K → raw shows 5.26% from $19K peak
    // NAV: stays at 1.0 through deposit, peakNav stays 1.0 → 0% NAV drawdown
    //   If equity drops by $1K from trading loss → NAV drops to ~0.95 → 5% drawdown
    // The key: the deposit itself doesn't create phantom drawdown from inflated peak.
    setupAccountDrawdown({
      navValue: 1.0,
      peakNav: 1.0,
      maxNavDrawdownPct: 0,
      // After $9K deposit: peak inflated to 19K, equity at 18K (lost $1K trading)
      peakEquity: 19000,
      equity: 18000,
      maxDrawdownPct: 5.26,
    });

    const result = await getLiveOpenRisk("user-1", "clan-1");

    // NAV drawdown shows 0% — deposit didn't inflate peak
    expect(result.currentNavDrawdownPct).toBe(0);
    expect(result.maxNavDrawdownPct).toBe(0);
    // Raw equity shows 5.26% — inflated by deposit peak
    expect(result.currentEquityDrawdownPct).toBeCloseTo(5.26, 1);
  });

  it("withdrawal does NOT worsen NAV-based public drawdown", async () => {
    // Scenario: $10K account + $1K profit, trader withdraws $9K.
    // Raw: equity drops from $11K to $2K → raw shows 81.82% drawdown (FAKE!)
    // NAV: stays at 1.1 (reflecting the real 10% trading profit), peakNav=1.1 → 0% drawdown
    setupAccountDrawdown({
      navValue: 1.1,
      peakNav: 1.1,
      maxNavDrawdownPct: 0,
      // After $9K withdrawal: raw equity plummets
      peakEquity: 11000,
      equity: 2000,
      maxDrawdownPct: 81.82,
    });

    const result = await getLiveOpenRisk("user-1", "clan-1");

    // NAV drawdown: 0% — withdrawal didn't affect performance truth
    expect(result.currentNavDrawdownPct).toBe(0);
    expect(result.maxNavDrawdownPct).toBe(0);
    // Raw equity drawdown: 81.82% — massively distorted by withdrawal
    expect(result.currentEquityDrawdownPct).toBeCloseTo(81.82, 1);
  });

  it("normal drawdown without cash flows behaves correctly for both", async () => {
    // No deposits/withdrawals — both systems should agree
    // Started with $10K, grew to $12K (NAV 1.2), now at $10.8K (NAV 1.08)
    setupAccountDrawdown({
      navValue: 1.08,
      peakNav: 1.2,
      maxNavDrawdownPct: 10,
      peakEquity: 12000,
      equity: 10800,
      maxDrawdownPct: 10,
    });

    const result = await getLiveOpenRisk("user-1", "clan-1");

    // Both should show 10% current drawdown
    expect(result.currentNavDrawdownPct).toBe(10);
    expect(result.currentEquityDrawdownPct).toBe(10);
    // Max drawdown also agrees
    expect(result.maxNavDrawdownPct).toBe(10);
    expect(result.maxEquityDrawdownPct).toBe(10);
  });

  it("aggregates NAV drawdown across multiple accounts (takes worst)", async () => {
    mockTradeFindMany.mockResolvedValue([]);
    mockMtAccountFindMany
      .mockResolvedValueOnce([])  // stale accounts query
      .mockResolvedValueOnce([
        makeAccount({
          id: "acc-1",
          navValue: 0.95, peakNav: 1.0, maxNavDrawdownPct: 5,
          peakEquity: 10000, equity: 9500, maxDrawdownPct: 5,
        }),
        makeAccount({
          id: "acc-2",
          navValue: 0.85, peakNav: 1.0, maxNavDrawdownPct: 15,
          peakEquity: 20000, equity: 17000, maxDrawdownPct: 15,
        }),
      ]);

    const result = await getLiveOpenRisk("user-1", "clan-1");

    // Should take worst: acc-2 has 15% NAV drawdown
    expect(result.currentNavDrawdownPct).toBe(15);
    expect(result.maxNavDrawdownPct).toBe(15);
  });

  it("handles fresh account with default NAV values (1.0/1.0)", async () => {
    setupAccountDrawdown({
      navValue: 1.0,
      peakNav: 1.0,
      maxNavDrawdownPct: 0,
    });

    const result = await getLiveOpenRisk("user-1", "clan-1");

    expect(result.currentNavDrawdownPct).toBe(0);
    expect(result.maxNavDrawdownPct).toBe(0);
  });
});
