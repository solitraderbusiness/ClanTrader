import { describe, it, expect } from "vitest";
import {
  computeScenarioPnl,
  computeScenario,
  computePainLevels,
  computeCurrentOpenRisk,
  computeSuggestedSL,
  buildSnapPoints,
  getScenarioInterpretation,
  type ScenarioInput,
  type ScenarioOutput,
  type PainLevel,
} from "@/lib/price-ladder-scenarios";

// ─── Factories ───

function makeInput(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    symbol: "XAUUSD",
    direction: "LONG",
    tradeCount: 1,
    totalLots: 1,
    currentPrice: 2000,
    avgEntry: 1990,
    worstEntry: 1990,
    breakeven: 1990,
    currentSL: 1970,
    firstTP: 2030,
    balance: 10000,
    equity: 9800,
    currentFloatingPnl: 1000, // already floating $1000
    currentFloatingR: 1,
    rComputable: true,
    riskPerR: 2000, // $2000 per 1R
    dollarsPerPoint: 100, // 1 lot XAUUSD-like
    unknownRiskTradeCount: 0,
    unprotectedTradeCount: 0,
    trades: [
      {
        lots: 1,
        openPrice: 1990,
        currentSL: 1970,
        currentTP: 2030,
        floatingPnl: 1000,
        rComputable: true,
        riskPerR: 2000,
      },
    ],
    ...overrides,
  };
}

function makeScenarioOutput(overrides: Partial<ScenarioOutput> = {}): ScenarioOutput {
  return {
    scenarioPrice: 2000,
    projectedPnl: 1000,
    projectedBalancePct: null,
    projectedEquityPct: null,
    projectedR: null,
    additionalPnlFromCurrent: 0,
    deltaFromCurrentPrice: 0,
    deltaFromCurrentPricePct: 0,
    distanceToBreakeven: 10,
    distanceToTP1: null,
    distanceToSL: null,
    riskToCurrentSL: null,
    scenarioStatus: "profit",
    suggestedActionKey: "scenario.action.monitorPosition",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  computeScenarioPnl                                                  */
/* ------------------------------------------------------------------ */

describe("computeScenarioPnl", () => {
  // The function simplifies to: priceDiff * dollarsPerPoint
  // because (priceDiff * totalLots * (dollarsPerPoint / totalLots)) = priceDiff * dollarsPerPoint

  it("LONG: returns positive P/L when scenario price is above entry", () => {
    // (2010 - 2000) * 100 = 1000
    expect(computeScenarioPnl(2010, 2000, 1, 100, "LONG")).toBeCloseTo(1000);
  });

  it("LONG: returns negative P/L when scenario price is below entry (loss)", () => {
    // (1990 - 2000) * 100 = -1000
    expect(computeScenarioPnl(1990, 2000, 1, 100, "LONG")).toBeCloseTo(-1000);
  });

  it("LONG: returns zero when scenario price equals entry", () => {
    expect(computeScenarioPnl(2000, 2000, 1, 100, "LONG")).toBe(0);
  });

  it("SHORT: returns positive P/L when scenario price is below entry", () => {
    // (2000 - 1990) * 100 = 1000
    expect(computeScenarioPnl(1990, 2000, 1, 100, "SHORT")).toBeCloseTo(1000);
  });

  it("SHORT: returns negative P/L when scenario price is above entry (loss)", () => {
    // (2000 - 2010) * 100 = -1000
    expect(computeScenarioPnl(2010, 2000, 1, 100, "SHORT")).toBeCloseTo(-1000);
  });

  it("SHORT: returns zero when scenario price equals entry", () => {
    expect(computeScenarioPnl(2000, 2000, 1, 100, "SHORT")).toBe(0);
  });

  it("scales linearly with dollarsPerPoint", () => {
    // dollarsPerPoint = 10 vs 100
    const small = computeScenarioPnl(2010, 2000, 1, 10, "LONG");
    const large = computeScenarioPnl(2010, 2000, 1, 100, "LONG");
    expect(large / small).toBeCloseTo(10);
  });

  it("handles forex-scale price differences", () => {
    // EURUSD: entry 1.0900, scenario 1.0950, dollarsPerPoint 10 (pip value)
    // (1.0950 - 1.0900) * 10 = 0.005 * 10 = 0.05
    expect(computeScenarioPnl(1.095, 1.09, 1, 10, "LONG")).toBeCloseTo(0.05);
  });
});

/* ------------------------------------------------------------------ */
/*  computeScenario                                                     */
/* ------------------------------------------------------------------ */

describe("computeScenario", () => {
  describe("projectedPnl", () => {
    it("LONG: projectedPnl = (scenarioPrice - avgEntry) * dollarsPerPoint", () => {
      const input = makeInput({
        avgEntry: 1990,
        dollarsPerPoint: 100,
        direction: "LONG",
      });
      const result = computeScenario(input, 2010);
      // (2010 - 1990) * 100 = 2000
      expect(result.projectedPnl).toBeCloseTo(2000);
    });

    it("SHORT: projectedPnl = (avgEntry - scenarioPrice) * dollarsPerPoint", () => {
      const input = makeInput({
        avgEntry: 2010,
        dollarsPerPoint: 100,
        direction: "SHORT",
        currentSL: 2030,
        firstTP: 1980,
        trades: [{
          lots: 1,
          openPrice: 2010,
          currentSL: 2030,
          currentTP: 1980,
          floatingPnl: 1000,
          rComputable: true,
          riskPerR: 2000,
        }],
      });
      const result = computeScenario(input, 1990);
      // (2010 - 1990) * 100 = 2000
      expect(result.projectedPnl).toBeCloseTo(2000);
    });

    it("returns negative projectedPnl for LONG loss scenario", () => {
      const input = makeInput({ avgEntry: 1990, dollarsPerPoint: 100 });
      const result = computeScenario(input, 1970); // below entry
      expect(result.projectedPnl).toBeLessThan(0);
    });
  });

  describe("additionalPnlFromCurrent", () => {
    it("is projectedPnl minus currentFloatingPnl", () => {
      const input = makeInput({
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 500,
      });
      const result = computeScenario(input, 2000);
      // projectedPnl = (2000 - 1990) * 100 = 1000; additional = 1000 - 500 = 500
      expect(result.additionalPnlFromCurrent).toBeCloseTo(500);
    });

    it("is negative when scenario price is worse than current", () => {
      const input = makeInput({
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentPrice: 2000,
        currentFloatingPnl: 1000,
      });
      const result = computeScenario(input, 1995);
      // projectedPnl = (1995 - 1990) * 100 = 500; additional = 500 - 1000 = -500
      expect(result.additionalPnlFromCurrent).toBeCloseTo(-500);
    });
  });

  describe("projectedBalancePct and projectedEquityPct", () => {
    it("computes balancePct as (additionalPnl / balance) * 100", () => {
      const input = makeInput({
        balance: 10000,
        equity: 10000,
        avgEntry: 1990,
        currentPrice: 2000,
        currentFloatingPnl: 1000,
        dollarsPerPoint: 100,
      });
      // projectedPnl = (2010 - 1990)*100 = 2000; additional = 2000 - 1000 = 1000
      const result = computeScenario(input, 2010);
      expect(result.projectedBalancePct).toBeCloseTo(10); // 1000/10000*100
      expect(result.projectedEquityPct).toBeCloseTo(10);
    });

    it("returns null balancePct when balance is null", () => {
      const input = makeInput({ balance: null });
      const result = computeScenario(input, 2000);
      expect(result.projectedBalancePct).toBeNull();
    });

    it("returns null balancePct when balance is 0", () => {
      const input = makeInput({ balance: 0 });
      const result = computeScenario(input, 2000);
      expect(result.projectedBalancePct).toBeNull();
    });

    it("returns null equityPct when equity is null", () => {
      const input = makeInput({ equity: null });
      const result = computeScenario(input, 2000);
      expect(result.projectedEquityPct).toBeNull();
    });
  });

  describe("projectedR", () => {
    it("computes projectedR when rComputable and riskPerR are set", () => {
      const input = makeInput({
        avgEntry: 1990,
        dollarsPerPoint: 100,
        rComputable: true,
        riskPerR: 2000,
      });
      const result = computeScenario(input, 2010);
      // projectedPnl = 2000; R = 2000 / 2000 = 1R
      expect(result.projectedR).toBeCloseTo(1);
    });

    it("returns null projectedR when rComputable is false", () => {
      const input = makeInput({ rComputable: false });
      const result = computeScenario(input, 2010);
      expect(result.projectedR).toBeNull();
    });

    it("returns null projectedR when riskPerR is null", () => {
      const input = makeInput({ riskPerR: null });
      const result = computeScenario(input, 2010);
      expect(result.projectedR).toBeNull();
    });

    it("returns null projectedR when riskPerR is 0", () => {
      const input = makeInput({ riskPerR: 0 });
      const result = computeScenario(input, 2010);
      expect(result.projectedR).toBeNull();
    });

    it("returns negative R in a loss scenario", () => {
      const input = makeInput({
        avgEntry: 1990,
        dollarsPerPoint: 100,
        rComputable: true,
        riskPerR: 2000,
      });
      const result = computeScenario(input, 1970); // below entry: loss
      // projectedPnl = (1970 - 1990) * 100 = -2000; R = -2000 / 2000 = -1
      expect(result.projectedR).toBeCloseTo(-1);
    });
  });

  describe("delta fields", () => {
    it("deltaFromCurrentPrice is scenarioPrice - currentPrice", () => {
      const input = makeInput({ currentPrice: 2000 });
      const result = computeScenario(input, 2020);
      expect(result.deltaFromCurrentPrice).toBeCloseTo(20);
    });

    it("deltaFromCurrentPricePct is percentage of currentPrice", () => {
      const input = makeInput({ currentPrice: 2000 });
      const result = computeScenario(input, 2020);
      // 20 / 2000 * 100 = 1%
      expect(result.deltaFromCurrentPricePct).toBeCloseTo(1);
    });

    it("deltaFromCurrentPricePct is 0 when currentPrice is 0 (guard)", () => {
      const input = makeInput({ currentPrice: 0 });
      const result = computeScenario(input, 100);
      expect(result.deltaFromCurrentPricePct).toBe(0);
    });
  });

  describe("distance fields", () => {
    it("distanceToBreakeven is scenarioPrice - breakeven", () => {
      const input = makeInput({ breakeven: 1990 });
      const result = computeScenario(input, 2000);
      expect(result.distanceToBreakeven).toBeCloseTo(10);
    });

    it("distanceToTP1 is scenarioPrice - firstTP when firstTP set", () => {
      const input = makeInput({ firstTP: 2030 });
      const result = computeScenario(input, 2010);
      expect(result.distanceToTP1).toBeCloseTo(-20); // below TP
    });

    it("distanceToTP1 is null when firstTP is null", () => {
      const input = makeInput({ firstTP: null });
      const result = computeScenario(input, 2010);
      expect(result.distanceToTP1).toBeNull();
    });

    it("distanceToSL is scenarioPrice - currentSL when SL is set", () => {
      const input = makeInput({ currentSL: 1970 });
      const result = computeScenario(input, 2000);
      expect(result.distanceToSL).toBeCloseTo(30);
    });

    it("distanceToSL is null when currentSL is null", () => {
      const input = makeInput({ currentSL: null });
      const result = computeScenario(input, 2000);
      expect(result.distanceToSL).toBeNull();
    });

    it("distanceToSL is null when currentSL is 0", () => {
      const input = makeInput({ currentSL: 0 });
      const result = computeScenario(input, 2000);
      expect(result.distanceToSL).toBeNull();
    });
  });

  describe("riskToCurrentSL", () => {
    it("LONG: riskToCurrentSL = (SL - avgEntry) * dollarsPerPoint", () => {
      const input = makeInput({
        direction: "LONG",
        avgEntry: 1990,
        currentSL: 1970,
        dollarsPerPoint: 100,
      });
      const result = computeScenario(input, 2000);
      // (1970 - 1990) * 100 = -2000
      expect(result.riskToCurrentSL).toBeCloseTo(-2000);
    });

    it("SHORT: riskToCurrentSL = (avgEntry - SL) * dollarsPerPoint", () => {
      const input = makeInput({
        direction: "SHORT",
        avgEntry: 2010,
        currentSL: 2030,
        dollarsPerPoint: 100,
        currentPrice: 2000,
        breakeven: 2010,
        firstTP: 1980,
        trades: [{
          lots: 1,
          openPrice: 2010,
          currentSL: 2030,
          currentTP: 1980,
          floatingPnl: 1000,
          rComputable: true,
          riskPerR: 2000,
        }],
      });
      const result = computeScenario(input, 2000);
      // (2010 - 2030) * 100 = -2000
      expect(result.riskToCurrentSL).toBeCloseTo(-2000);
    });

    it("returns null when currentSL is null", () => {
      const input = makeInput({ currentSL: null });
      const result = computeScenario(input, 2000);
      expect(result.riskToCurrentSL).toBeNull();
    });

    it("returns null when currentSL is 0", () => {
      const input = makeInput({ currentSL: 0 });
      const result = computeScenario(input, 2000);
      expect(result.riskToCurrentSL).toBeNull();
    });
  });

  describe("scenarioStatus", () => {
    it("returns deep_profit when projectedPnl > 5% of balance", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
      });
      // Need > 5% of 10000 = 500; projectedPnl = (2010 - 1990)*100 = 2000
      const result = computeScenario(input, 2010);
      expect(result.scenarioStatus).toBe("deep_profit");
    });

    it("returns profit when projectedPnl is between 0.5% and 5%", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
      });
      // projectedPnl = (1991 - 1990)*100 = 100 = 1% of 10000
      const result = computeScenario(input, 1991);
      expect(result.scenarioStatus).toBe("profit");
    });

    it("returns near_breakeven when projectedPnl is within ±0.5%", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
      });
      // projectedPnl = (1990.1 - 1990)*100 = 10 = 0.1% of 10000
      const result = computeScenario(input, 1990.1);
      expect(result.scenarioStatus).toBe("near_breakeven");
    });

    it("returns small_loss when projectedPnl is between -0.5% and -2%", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
      });
      // projectedPnl = (1989 - 1990)*100 = -100 = -1% of 10000
      const result = computeScenario(input, 1989);
      expect(result.scenarioStatus).toBe("small_loss");
    });

    it("returns moderate_loss when projectedPnl is between -2% and -5%", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
      });
      // projectedPnl = (1987 - 1990)*100 = -300 = -3% of 10000
      const result = computeScenario(input, 1987);
      expect(result.scenarioStatus).toBe("moderate_loss");
    });

    it("returns significant_loss when projectedPnl is between -5% and -10%", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
      });
      // projectedPnl = (1983 - 1990)*100 = -700 = -7% of 10000
      const result = computeScenario(input, 1983);
      expect(result.scenarioStatus).toBe("significant_loss");
    });

    it("returns severe_loss when projectedPnl is below -10%", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
      });
      // projectedPnl = (1978 - 1990)*100 = -1200 = -12% of 10000
      const result = computeScenario(input, 1978);
      expect(result.scenarioStatus).toBe("severe_loss");
    });

    it("falls back to absolute P/L when no balance or equity", () => {
      const input = makeInput({
        balance: null,
        equity: null,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
      });
      // positive pnl => "profit" (not deep_profit since no % ref)
      const result = computeScenario(input, 2000);
      expect(result.scenarioStatus).toBe("profit");
    });

    it("near_breakeven with absolute P/L when pnl between -100 and 0", () => {
      const input = makeInput({
        balance: null,
        equity: null,
        avgEntry: 1990,
        dollarsPerPoint: 1, // small dollarsPerPoint so pnl is small
        currentFloatingPnl: 0,
      });
      // projectedPnl = (1989.5 - 1990)*1 = -0.5 (between -100 and 0)
      const result = computeScenario(input, 1989.5);
      expect(result.scenarioStatus).toBe("near_breakeven");
    });
  });

  describe("suggestedActionKey", () => {
    it("returns defineProtection for loss with unprotected trades", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
        unprotectedTradeCount: 1,
        currentSL: null,
      });
      // significant_loss + unprotected
      const result = computeScenario(input, 1983);
      expect(result.suggestedActionKey).toBe("scenario.action.defineProtection");
    });

    it("returns setSL when SL is null and not in a loss with unprotected trades", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
        unprotectedTradeCount: 0,
        currentSL: null,
      });
      const result = computeScenario(input, 2010);
      expect(result.suggestedActionKey).toBe("scenario.action.setSL");
    });

    it("returns considerTakingProfit for deep_profit with SL set", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
        unprotectedTradeCount: 0,
        currentSL: 1970,
      });
      // deep_profit: > 5% of 10000 = 500
      const result = computeScenario(input, 2010);
      expect(result.suggestedActionKey).toBe("scenario.action.considerTakingProfit");
    });

    it("returns criticalDrawdown for severe_loss with SL set", () => {
      const input = makeInput({
        balance: 10000,
        avgEntry: 1990,
        dollarsPerPoint: 100,
        currentFloatingPnl: 0,
        unprotectedTradeCount: 0,
        currentSL: 1970,
      });
      // severe_loss: pnl < -10%
      const result = computeScenario(input, 1978);
      expect(result.suggestedActionKey).toBe("scenario.action.criticalDrawdown");
    });
  });
});

/* ------------------------------------------------------------------ */
/*  computePainLevels                                                   */
/* ------------------------------------------------------------------ */

describe("computePainLevels", () => {
  const basePainInput = {
    direction: "LONG" as const,
    dollarsPerPoint: 100,
    currentPrice: 2000,
    balance: 10000,
    equity: 9800,
    currentFloatingPnl: 500,
  };

  describe("LONG direction", () => {
    it("generates correct price for -1% level", () => {
      const levels = computePainLevels(basePainInput, [-1]);
      // targetAdditionalPnl = 10000 * (-1/100) = -100
      // priceChange = -100 / 100 = -1
      // price = 2000 + (-1) = 1999
      expect(levels).toHaveLength(1);
      expect(levels[0].price).toBeCloseTo(1999);
      expect(levels[0].percent).toBe(-1);
    });

    it("generates correct price for -2% level", () => {
      const levels = computePainLevels(basePainInput, [-2]);
      // targetAdditionalPnl = 10000 * (-2/100) = -200
      // priceChange = -200 / 100 = -2
      // price = 2000 + (-2) = 1998
      expect(levels[0].price).toBeCloseTo(1998);
    });

    it("generates correct price for +5% level (gain target)", () => {
      const levels = computePainLevels(basePainInput, [5]);
      // targetAdditionalPnl = 10000 * (5/100) = 500
      // priceChange = 500 / 100 = 5
      // price = 2000 + 5 = 2005
      expect(levels[0].price).toBeCloseTo(2005);
    });

    it("pnlAtLevel includes currentFloatingPnl", () => {
      const levels = computePainLevels(basePainInput, [-1]);
      // pnlAtLevel = 500 + (-100) = 400
      expect(levels[0].pnlAtLevel).toBeCloseTo(400);
    });

    it("generates multiple levels in one call", () => {
      const levels = computePainLevels(basePainInput, [-1, -2, -5, 1, 2]);
      expect(levels).toHaveLength(5);
      expect(levels.map((l) => l.percent)).toEqual([-1, -2, -5, 1, 2]);
    });

    it("uses default percentages when none provided", () => {
      const levels = computePainLevels(basePainInput);
      expect(levels).toHaveLength(7); // [-1, -2, -5, -10, 1, 2, 5]
    });
  });

  describe("SHORT direction", () => {
    it("generates inverted price for -1% level (price rises for SHORT loss)", () => {
      const shortInput = { ...basePainInput, direction: "SHORT" as const };
      const levels = computePainLevels(shortInput, [-1]);
      // targetAdditionalPnl = -100; priceChange = -100/100 = -1
      // price = currentPrice - priceChange = 2000 - (-1) = 2001
      expect(levels[0].price).toBeCloseTo(2001);
    });

    it("generates correct price for +5% level SHORT (price drops to gain)", () => {
      const shortInput = { ...basePainInput, direction: "SHORT" as const };
      const levels = computePainLevels(shortInput, [5]);
      // targetAdditionalPnl = 500; priceChange = 500/100 = 5
      // price = 2000 - 5 = 1995
      expect(levels[0].price).toBeCloseTo(1995);
    });
  });

  describe("returns empty when inputs are invalid", () => {
    it("returns empty array when balance is null", () => {
      expect(computePainLevels({ ...basePainInput, balance: null }, [-1])).toEqual([]);
    });

    it("returns empty array when balance is 0", () => {
      expect(computePainLevels({ ...basePainInput, balance: 0 }, [-1])).toEqual([]);
    });

    it("returns empty array when dollarsPerPoint is 0", () => {
      expect(computePainLevels({ ...basePainInput, dollarsPerPoint: 0 }, [-1])).toEqual([]);
    });

    it("returns empty array when currentPrice is 0", () => {
      expect(computePainLevels({ ...basePainInput, currentPrice: 0 }, [-1])).toEqual([]);
    });
  });

  describe("isRealistic flag", () => {
    it("marks prices within 0.2x-2.0x of currentPrice as realistic", () => {
      // currentPrice = 2000; realistic range = 400 to 4000
      const levels = computePainLevels(basePainInput, [-1, 1]);
      // -1% => 1999, +1% => 2001 — both well within 400-4000
      expect(levels[0].isRealistic).toBe(true);
      expect(levels[1].isRealistic).toBe(true);
    });

    it("marks level as unrealistic when price would be > 2x currentPrice", () => {
      // Make dollarsPerPoint very small so a large % moves price dramatically
      const input = { ...basePainInput, dollarsPerPoint: 0.001, currentPrice: 100, balance: 10000 };
      // -10%: targetAdditionalPnl = -1000; priceChange = -1000/0.001 = -1000000; price = 100 - 1000000 < 0
      const levels = computePainLevels(input, [-10]);
      expect(levels[0].isRealistic).toBe(false);
    });

    it("marks level as unrealistic when price is negative", () => {
      // Very large loss % relative to dollarsPerPoint
      const input = { ...basePainInput, dollarsPerPoint: 1, currentPrice: 100, balance: 100000 };
      // -10%: targetAdditionalPnl = -10000; priceChange = -10000/1 = -10000; price = 100 - 10000 = -9900
      const levels = computePainLevels(input, [-10]);
      expect(levels[0].isRealistic).toBe(false);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  computeCurrentOpenRisk                                              */
/* ------------------------------------------------------------------ */

describe("computeCurrentOpenRisk", () => {
  describe("all trades with SL", () => {
    it("computes knownRiskPnl as sum of (SL-openPrice)*lots*pointValue for LONG", () => {
      const input = makeInput({
        direction: "LONG",
        totalLots: 1,
        dollarsPerPoint: 100, // pointValue = 100/1 = 100
        balance: 10000,
        equity: 10000,
        unknownRiskTradeCount: 0,
        unprotectedTradeCount: 0,
        trades: [
          {
            lots: 1,
            openPrice: 1990,
            currentSL: 1970, // slDiff = 1970 - 1990 = -20
            currentTP: 2030,
            floatingPnl: 1000,
            rComputable: true,
            riskPerR: 2000,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      // slDiff = 1970 - 1990 = -20; tradeLoss = -20 * 1 * 100 = -2000
      expect(result.knownRiskPnl).toBeCloseTo(-2000);
    });

    it("computes knownRiskPnl correctly for SHORT", () => {
      const input = makeInput({
        direction: "SHORT",
        totalLots: 1,
        dollarsPerPoint: 100,
        balance: 10000,
        equity: 10000,
        unknownRiskTradeCount: 0,
        unprotectedTradeCount: 0,
        trades: [
          {
            lots: 1,
            openPrice: 2010,
            currentSL: 2030, // slDiff = 2010 - 2030 = -20
            currentTP: 1980,
            floatingPnl: 1000,
            rComputable: true,
            riskPerR: 2000,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      // slDiff = 2010 - 2030 = -20; tradeLoss = -20 * 1 * 100 = -2000
      expect(result.knownRiskPnl).toBeCloseTo(-2000);
    });

    it("computes balancePct from knownRiskPnl / balance", () => {
      const input = makeInput({
        direction: "LONG",
        totalLots: 1,
        dollarsPerPoint: 100,
        balance: 10000,
        equity: 10000,
        trades: [
          {
            lots: 1,
            openPrice: 1990,
            currentSL: 1970,
            currentTP: 2030,
            floatingPnl: 1000,
            rComputable: true,
            riskPerR: 2000,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      // -2000 / 10000 * 100 = -20%
      expect(result.knownRiskBalancePct).toBeCloseTo(-20);
    });

    it("sets isComplete to true when all trades have SL", () => {
      const input = makeInput({
        trades: [
          {
            lots: 1,
            openPrice: 1990,
            currentSL: 1970,
            currentTP: 2030,
            floatingPnl: 1000,
            rComputable: true,
            riskPerR: 2000,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      expect(result.isComplete).toBe(true);
    });

    it("aggregates knownRiskR from multiple trades", () => {
      const input = makeInput({
        direction: "LONG",
        totalLots: 2,
        dollarsPerPoint: 200, // 2 lots * 100 = 200 total; pointValue = 200/2 = 100
        balance: 10000,
        equity: 10000,
        trades: [
          {
            lots: 1,
            openPrice: 1990,
            currentSL: 1970, // loss = -20*1*100 = -2000
            currentTP: 2030,
            floatingPnl: 500,
            rComputable: true,
            riskPerR: 1000,
          },
          {
            lots: 1,
            openPrice: 1985,
            currentSL: 1975, // loss = -10*1*100 = -1000
            currentTP: 2030,
            floatingPnl: 500,
            rComputable: true,
            riskPerR: 1000,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      // R: -2000/1000 + -1000/1000 = -2 + -1 = -3
      expect(result.knownRiskR).toBeCloseTo(-3);
    });
  });

  describe("some trades without SL", () => {
    it("counts unprotected trades and excludes them from knownRiskPnl", () => {
      const input = makeInput({
        direction: "LONG",
        totalLots: 2,
        dollarsPerPoint: 200,
        trades: [
          {
            lots: 1,
            openPrice: 1990,
            currentSL: 1970, // has SL
            currentTP: 2030,
            floatingPnl: 500,
            rComputable: true,
            riskPerR: 2000,
          },
          {
            lots: 1,
            openPrice: 1985,
            currentSL: null, // NO SL
            currentTP: 2030,
            floatingPnl: 500,
            rComputable: false,
            riskPerR: null,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      expect(result.unprotectedTradeCount).toBe(1);
      expect(result.unknownRiskTradeCount).toBe(1);
      expect(result.isComplete).toBe(false);
      // Only first trade's loss counts
      // pointValue = 200/2 = 100; slDiff = 1970 - 1990 = -20; loss = -20*1*100 = -2000
      expect(result.knownRiskPnl).toBeCloseTo(-2000);
    });

    it("also counts currentSL=0 as unprotected", () => {
      const input = makeInput({
        direction: "LONG",
        totalLots: 1,
        dollarsPerPoint: 100,
        trades: [
          {
            lots: 1,
            openPrice: 1990,
            currentSL: 0, // SL = 0 treated as no SL
            currentTP: 2030,
            floatingPnl: 500,
            rComputable: false,
            riskPerR: null,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      expect(result.unprotectedTradeCount).toBe(1);
      expect(result.knownRiskPnl).toBe(0);
    });
  });

  describe("no trades with SL", () => {
    it("returns knownRiskPnl=0 and isComplete=false", () => {
      const input = makeInput({
        trades: [
          {
            lots: 1,
            openPrice: 1990,
            currentSL: null,
            currentTP: null,
            floatingPnl: 0,
            rComputable: false,
            riskPerR: null,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      expect(result.knownRiskPnl).toBe(0);
      expect(result.isComplete).toBe(false);
      expect(result.unprotectedTradeCount).toBe(1);
    });
  });

  describe("balance/equity null handling", () => {
    it("returns null knownRiskBalancePct when balance is null", () => {
      const input = makeInput({ balance: null });
      const result = computeCurrentOpenRisk(input);
      expect(result.knownRiskBalancePct).toBeNull();
    });

    it("returns null knownRiskEquityPct when equity is null", () => {
      const input = makeInput({ equity: null });
      const result = computeCurrentOpenRisk(input);
      expect(result.knownRiskEquityPct).toBeNull();
    });
  });

  describe("R honesty", () => {
    it("returns null knownRiskR when any trade lacks R data", () => {
      const input = makeInput({
        direction: "LONG",
        totalLots: 2,
        dollarsPerPoint: 200,
        trades: [
          {
            lots: 1,
            openPrice: 1990,
            currentSL: 1970,
            currentTP: 2030,
            floatingPnl: 500,
            rComputable: true,
            riskPerR: 2000,
          },
          {
            lots: 1,
            openPrice: 1985,
            currentSL: 1975,
            currentTP: 2030,
            floatingPnl: 500,
            rComputable: false, // no R
            riskPerR: null,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      expect(result.knownRiskR).toBeNull();
    });

    it("returns knownRiskR=0 for breakeven SL at open price", () => {
      const input = makeInput({
        direction: "LONG",
        totalLots: 1,
        dollarsPerPoint: 100,
        trades: [
          {
            lots: 1,
            openPrice: 1990,
            currentSL: 1990, // SL at breakeven
            currentTP: 2030,
            floatingPnl: 1000,
            rComputable: true,
            riskPerR: 2000,
          },
        ],
      });
      const result = computeCurrentOpenRisk(input);
      // slDiff = 1990 - 1990 = 0; loss = 0
      expect(result.knownRiskPnl).toBeCloseTo(0);
      expect(result.knownRiskR).toBeCloseTo(0);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  computeSuggestedSL                                                  */
/* ------------------------------------------------------------------ */

describe("computeSuggestedSL", () => {
  const baseSLInput = {
    direction: "LONG" as const,
    dollarsPerPoint: 100,
    currentPrice: 2000,
    balance: 10000,
    rComputable: true,
    riskPerR: 2000,
  };

  describe("LONG direction", () => {
    it("1%: suggestedSL = currentPrice - (balance * 0.01 / dollarsPerPoint)", () => {
      const result = computeSuggestedSL(baseSLInput, 1);
      // maxLoss = 10000 * 0.01 = 100; priceMove = 100/100 = 1; SL = 2000 - 1 = 1999
      expect(result).not.toBeNull();
      expect(result!.suggestedSLPrice).toBeCloseTo(1999);
    });

    it("2%: suggestedSL is lower than 1% SL", () => {
      const result1 = computeSuggestedSL(baseSLInput, 1);
      const result2 = computeSuggestedSL(baseSLInput, 2);
      expect(result2!.suggestedSLPrice).toBeLessThan(result1!.suggestedSLPrice);
    });

    it("5%: projectedPnlAtSL = -(balance * 0.05)", () => {
      const result = computeSuggestedSL(baseSLInput, 5);
      // maxLoss = 10000 * 0.05 = 500; projectedPnlAtSL = -500
      expect(result!.projectedPnlAtSL).toBeCloseTo(-500);
    });

    it("projectedBalancePctAtSL = -targetRiskPct", () => {
      const result = computeSuggestedSL(baseSLInput, 2);
      expect(result!.projectedBalancePctAtSL).toBe(-2);
    });

    it("projectedRAtSL is computable from riskPerR", () => {
      const result = computeSuggestedSL(baseSLInput, 1);
      // projectedPnlAtSL = -100; R = -100 / 2000 = -0.05
      expect(result!.projectedRAtSL).toBeCloseTo(-0.05);
    });

    it("projectedRAtSL is null when rComputable is false", () => {
      const result = computeSuggestedSL({ ...baseSLInput, rComputable: false }, 1);
      expect(result!.projectedRAtSL).toBeNull();
    });

    it("isRealistic is true for reasonable SL within price range", () => {
      const result = computeSuggestedSL(baseSLInput, 1);
      expect(result!.isRealistic).toBe(true);
    });
  });

  describe("SHORT direction", () => {
    it("suggestedSL = currentPrice + priceMove for SHORT", () => {
      const result = computeSuggestedSL({ ...baseSLInput, direction: "SHORT" }, 1);
      // maxLoss = 100; priceMove = 1; SL = 2000 + 1 = 2001
      expect(result!.suggestedSLPrice).toBeCloseTo(2001);
    });
  });

  describe("null/invalid inputs return null", () => {
    it("returns null when balance is null", () => {
      expect(computeSuggestedSL({ ...baseSLInput, balance: null }, 1)).toBeNull();
    });

    it("returns null when balance is 0", () => {
      expect(computeSuggestedSL({ ...baseSLInput, balance: 0 }, 1)).toBeNull();
    });

    it("returns null when dollarsPerPoint is 0", () => {
      expect(computeSuggestedSL({ ...baseSLInput, dollarsPerPoint: 0 }, 1)).toBeNull();
    });

    it("returns null when currentPrice is 0", () => {
      expect(computeSuggestedSL({ ...baseSLInput, currentPrice: 0 }, 1)).toBeNull();
    });

    it("returns null when suggested SL would be <= 0 (absurdly tight balance)", () => {
      // LONG, balance=1, dollarsPerPoint=0.001, currentPrice=1
      // maxLoss = 1 * 100/100 = 1; priceMove = 1/0.001 = 1000; SL = 1 - 1000 = -999
      const result = computeSuggestedSL({
        ...baseSLInput,
        balance: 1,
        dollarsPerPoint: 0.001,
        currentPrice: 1,
      }, 100);
      expect(result).toBeNull();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  buildSnapPoints                                                      */
/* ------------------------------------------------------------------ */

describe("buildSnapPoints", () => {
  const basePainLevels: PainLevel[] = [
    { percent: -1, price: 1999, pnlAtLevel: -100, isRealistic: true },
    { percent: -5, price: 1950, pnlAtLevel: -500, isRealistic: false }, // unrealistic
    { percent: 2, price: 2020, pnlAtLevel: 200, isRealistic: true },
  ];

  it("always includes current price snap point", () => {
    const input = makeInput({ currentPrice: 2000 });
    const points = buildSnapPoints(input, []);
    const current = points.find((p) => p.labelKey === "scenario.snap.current");
    expect(current).toBeDefined();
    expect(current!.price).toBe(2000);
  });

  it("includes breakeven when it differs from currentPrice by > 0.1%", () => {
    // currentPrice = 2000, breakeven = 1990 — difference is 10 (0.5%)
    const input = makeInput({ currentPrice: 2000, breakeven: 1990 });
    const points = buildSnapPoints(input, []);
    const be = points.find((p) => p.labelKey === "scenario.snap.breakeven");
    expect(be).toBeDefined();
    expect(be!.price).toBe(1990);
  });

  it("omits breakeven when it is very close to currentPrice (< 0.1%)", () => {
    // currentPrice = 2000, breakeven = 2000.1 — difference is 0.1 = 0.005%
    const input = makeInput({ currentPrice: 2000, breakeven: 2000.1 });
    const points = buildSnapPoints(input, []);
    const be = points.find((p) => p.labelKey === "scenario.snap.breakeven");
    expect(be).toBeUndefined();
  });

  it("includes TP1 snap point when firstTP is set", () => {
    const input = makeInput({ firstTP: 2030 });
    const points = buildSnapPoints(input, []);
    const tp = points.find((p) => p.labelKey === "scenario.snap.tp1");
    expect(tp).toBeDefined();
    expect(tp!.price).toBe(2030);
  });

  it("omits TP1 when firstTP is null", () => {
    const input = makeInput({ firstTP: null });
    const points = buildSnapPoints(input, []);
    const tp = points.find((p) => p.labelKey === "scenario.snap.tp1");
    expect(tp).toBeUndefined();
  });

  it("omits TP1 when firstTP is 0", () => {
    const input = makeInput({ firstTP: 0 });
    const points = buildSnapPoints(input, []);
    const tp = points.find((p) => p.labelKey === "scenario.snap.tp1");
    expect(tp).toBeUndefined();
  });

  it("includes SL snap point when currentSL is set", () => {
    const input = makeInput({ currentSL: 1970 });
    const points = buildSnapPoints(input, []);
    const sl = points.find((p) => p.labelKey === "scenario.snap.sl");
    expect(sl).toBeDefined();
    expect(sl!.price).toBe(1970);
  });

  it("omits SL snap point when currentSL is null", () => {
    const input = makeInput({ currentSL: null });
    const points = buildSnapPoints(input, []);
    const sl = points.find((p) => p.labelKey === "scenario.snap.sl");
    expect(sl).toBeUndefined();
  });

  it("includes only realistic pain levels", () => {
    const input = makeInput();
    const points = buildSnapPoints(input, basePainLevels);
    // -1% and +2% are realistic; -5% is not
    const pain1 = points.find((p) => p.labelKey === "scenario.snap.pain_-1");
    const pain5 = points.find((p) => p.labelKey === "scenario.snap.pain_-5");
    const pain2 = points.find((p) => p.labelKey === "scenario.snap.pain_2");
    expect(pain1).toBeDefined();
    expect(pain5).toBeUndefined();
    expect(pain2).toBeDefined();
  });

  it("labels pain levels with sign prefix for positive percents", () => {
    const input = makeInput();
    const points = buildSnapPoints(input, basePainLevels);
    const pain2 = points.find((p) => p.labelKey === "scenario.snap.pain_2");
    expect(pain2!.label).toBe("+2%");
  });

  it("labels pain levels without sign prefix for negative percents", () => {
    const input = makeInput();
    const points = buildSnapPoints(input, basePainLevels);
    const pain1 = points.find((p) => p.labelKey === "scenario.snap.pain_-1");
    expect(pain1!.label).toBe("-1%");
  });

  it("returns only current price when all optional fields are absent", () => {
    const input = makeInput({
      firstTP: null,
      currentSL: null,
      breakeven: 2000, // same as currentPrice so omitted
      currentPrice: 2000,
    });
    const points = buildSnapPoints(input, []);
    expect(points).toHaveLength(1);
    expect(points[0].labelKey).toBe("scenario.snap.current");
  });
});

/* ------------------------------------------------------------------ */
/*  getScenarioInterpretation                                           */
/* ------------------------------------------------------------------ */

describe("getScenarioInterpretation", () => {
  function makeScenario(
    status: ScenarioOutput["scenarioStatus"],
    projectedPnl = 100,
    distanceToBreakeven = 10,
  ): ScenarioOutput {
    return makeScenarioOutput({ scenarioStatus: status, projectedPnl, distanceToBreakeven });
  }

  it("returns noSLDefineProtection when unprotected and in loss", () => {
    const scenario = makeScenario("moderate_loss", -300);
    expect(getScenarioInterpretation(scenario, 1)).toBe(
      "scenario.interpret.noSLDefineProtection",
    );
  });

  it("does NOT return noSLDefineProtection when unprotected but in profit", () => {
    const scenario = makeScenario("profit", 200);
    const key = getScenarioInterpretation(scenario, 1);
    expect(key).not.toBe("scenario.interpret.noSLDefineProtection");
  });

  it("returns severeLoss for severe_loss status", () => {
    expect(getScenarioInterpretation(makeScenario("severe_loss", -1200), 0)).toBe(
      "scenario.interpret.severeLoss",
    );
  });

  it("returns significantLoss for significant_loss status", () => {
    expect(getScenarioInterpretation(makeScenario("significant_loss", -700), 0)).toBe(
      "scenario.interpret.significantLoss",
    );
  });

  it("returns moderateLoss for moderate_loss status", () => {
    expect(getScenarioInterpretation(makeScenario("moderate_loss", -300), 0)).toBe(
      "scenario.interpret.moderateLoss",
    );
  });

  it("returns smallLoss for small_loss status", () => {
    expect(getScenarioInterpretation(makeScenario("small_loss", -100), 0)).toBe(
      "scenario.interpret.smallLoss",
    );
  });

  it("returns atBreakeven when near_breakeven and distance is essentially zero", () => {
    const scenario = makeScenario("near_breakeven", 0, 0.0001); // < 0.001
    expect(getScenarioInterpretation(scenario, 0)).toBe(
      "scenario.interpret.atBreakeven",
    );
  });

  it("returns nearBreakeven when near_breakeven but distance is non-zero", () => {
    const scenario = makeScenario("near_breakeven", 10, 5);
    expect(getScenarioInterpretation(scenario, 0)).toBe(
      "scenario.interpret.nearBreakeven",
    );
  });

  it("returns inProfit for profit status", () => {
    expect(getScenarioInterpretation(makeScenario("profit", 200), 0)).toBe(
      "scenario.interpret.inProfit",
    );
  });

  it("returns deepProfit for deep_profit status", () => {
    expect(getScenarioInterpretation(makeScenario("deep_profit", 2000), 0)).toBe(
      "scenario.interpret.deepProfit",
    );
  });

  it("unprotectedCount=0 does not trigger noSLDefineProtection even in loss", () => {
    const scenario = makeScenario("severe_loss", -1500);
    expect(getScenarioInterpretation(scenario, 0)).toBe(
      "scenario.interpret.severeLoss",
    );
  });
});
