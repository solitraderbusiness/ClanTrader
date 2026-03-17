import { describe, it, expect } from "vitest";
import {
  deriveRiskStatus,
  calculateLiveRR,
  calculatePricePnl,
  calculateTargetRR,
  getFrozenEntry,
  getFrozenRiskAbs,
  getFrozenTP,
  getPlannedRRRatio,
  formatPlannedRR,
} from "../risk-utils";

/* ------------------------------------------------------------------ */
/*  deriveRiskStatus                                                   */
/* ------------------------------------------------------------------ */

describe("deriveRiskStatus", () => {
  describe("LONG direction", () => {
    it("returns PROTECTED when SL is below entry", () => {
      expect(deriveRiskStatus("LONG", 100, 95)).toBe("PROTECTED");
    });

    it("returns LOCKED_PROFIT when SL is above entry", () => {
      expect(deriveRiskStatus("LONG", 100, 105)).toBe("LOCKED_PROFIT");
    });

    it("returns BREAKEVEN when SL equals entry exactly", () => {
      expect(deriveRiskStatus("LONG", 100, 100)).toBe("BREAKEVEN");
    });

    it("returns BREAKEVEN when SL is within 0.01% epsilon of entry", () => {
      // entry = 100, epsilon = 0.01 => SL in [99.99, 100.01] is BE
      expect(deriveRiskStatus("LONG", 100, 100.005)).toBe("BREAKEVEN");
      expect(deriveRiskStatus("LONG", 100, 99.995)).toBe("BREAKEVEN");
    });

    it("returns UNPROTECTED when SL is 0", () => {
      expect(deriveRiskStatus("LONG", 100, 0)).toBe("UNPROTECTED");
    });

    it("returns UNPROTECTED when SL is negative", () => {
      expect(deriveRiskStatus("LONG", 100, -5)).toBe("UNPROTECTED");
    });
  });

  describe("SHORT direction", () => {
    it("returns PROTECTED when SL is above entry", () => {
      expect(deriveRiskStatus("SHORT", 100, 105)).toBe("PROTECTED");
    });

    it("returns LOCKED_PROFIT when SL is below entry", () => {
      expect(deriveRiskStatus("SHORT", 100, 95)).toBe("LOCKED_PROFIT");
    });

    it("returns BREAKEVEN when SL equals entry exactly", () => {
      expect(deriveRiskStatus("SHORT", 100, 100)).toBe("BREAKEVEN");
    });

    it("returns BREAKEVEN when SL is within 0.01% epsilon of entry", () => {
      expect(deriveRiskStatus("SHORT", 100, 100.005)).toBe("BREAKEVEN");
      expect(deriveRiskStatus("SHORT", 100, 99.995)).toBe("BREAKEVEN");
    });

    it("returns UNPROTECTED when SL is 0", () => {
      expect(deriveRiskStatus("SHORT", 100, 0)).toBe("UNPROTECTED");
    });

    it("returns UNPROTECTED when SL is negative", () => {
      expect(deriveRiskStatus("SHORT", 100, -10)).toBe("UNPROTECTED");
    });
  });

  describe("edge cases", () => {
    it("handles high-value entries with correct epsilon scaling", () => {
      // entry = 2000, epsilon = 0.2 => SL in [1999.8, 2000.2] is BE
      expect(deriveRiskStatus("LONG", 2000, 2000.1)).toBe("BREAKEVEN");
      expect(deriveRiskStatus("LONG", 2000, 1999.9)).toBe("BREAKEVEN");
      // Just outside epsilon
      expect(deriveRiskStatus("LONG", 2000, 2000.3)).toBe("LOCKED_PROFIT");
      expect(deriveRiskStatus("LONG", 2000, 1999.7)).toBe("PROTECTED");
    });

    it("handles fractional forex-like prices", () => {
      // EURUSD-style: entry = 1.0950, SL = 1.0900
      expect(deriveRiskStatus("LONG", 1.095, 1.09)).toBe("PROTECTED");
      expect(deriveRiskStatus("SHORT", 1.095, 1.1)).toBe("PROTECTED");
    });
  });
});

/* ------------------------------------------------------------------ */
/*  calculateLiveRR                                                    */
/* ------------------------------------------------------------------ */

describe("calculateLiveRR", () => {
  describe("LONG trades", () => {
    it("returns positive R:R when price is above entry (in profit)", () => {
      // entry=100, risk=5, price=110 => (110-100)/5 = 2.0R
      expect(calculateLiveRR("LONG", 110, 100, 5)).toBe(2);
    });

    it("returns negative R:R when price is below entry (in loss)", () => {
      // entry=100, risk=5, price=97 => (97-100)/5 = -0.6R
      expect(calculateLiveRR("LONG", 97, 100, 5)).toBeCloseTo(-0.6);
    });

    it("returns 0 when price equals entry", () => {
      expect(calculateLiveRR("LONG", 100, 100, 5)).toBe(0);
    });
  });

  describe("SHORT trades", () => {
    it("returns positive R:R when price is below entry (in profit)", () => {
      // entry=100, risk=5, price=90 => -1 * (90-100)/5 = 2.0R
      expect(calculateLiveRR("SHORT", 90, 100, 5)).toBe(2);
    });

    it("returns negative R:R when price is above entry (in loss)", () => {
      // entry=100, risk=5, price=103 => -1 * (103-100)/5 = -0.6R
      expect(calculateLiveRR("SHORT", 103, 100, 5)).toBeCloseTo(-0.6);
    });

    it("returns 0 when price equals entry", () => {
      // -1 * (100 - 100) / 5 = -0 in IEEE 754; numerically equal to 0
      expect(calculateLiveRR("SHORT", 100, 100, 5)).toBeCloseTo(0);
    });
  });

  describe("invalid risk distance", () => {
    it("returns 0 when initialRiskAbs is 0", () => {
      expect(calculateLiveRR("LONG", 110, 100, 0)).toBe(0);
    });

    it("returns 0 when initialRiskAbs is negative", () => {
      expect(calculateLiveRR("LONG", 110, 100, -5)).toBe(0);
    });
  });

  describe("precision", () => {
    it("handles fractional R:R values", () => {
      // entry=1.0950, risk=0.005, price=1.1025 => (1.1025-1.0950)/0.005 = 1.5R
      expect(calculateLiveRR("LONG", 1.1025, 1.095, 0.005)).toBeCloseTo(1.5);
    });

    it("handles large risk multiples", () => {
      // entry=2000, risk=10, price=2050 => 50/10 = 5R
      expect(calculateLiveRR("LONG", 2050, 2000, 10)).toBe(5);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  calculatePricePnl                                                  */
/* ------------------------------------------------------------------ */

describe("calculatePricePnl", () => {
  describe("LONG trades", () => {
    it("returns positive P&L when price is above entry", () => {
      expect(calculatePricePnl("LONG", 1.105, 1.1)).toBeCloseTo(0.005);
    });

    it("returns negative P&L when price is below entry", () => {
      expect(calculatePricePnl("LONG", 1.095, 1.1)).toBeCloseTo(-0.005);
    });

    it("returns 0 when price equals entry", () => {
      expect(calculatePricePnl("LONG", 100, 100)).toBe(0);
    });
  });

  describe("SHORT trades", () => {
    it("returns positive P&L when price is below entry", () => {
      expect(calculatePricePnl("SHORT", 1.095, 1.1)).toBeCloseTo(0.005);
    });

    it("returns negative P&L when price is above entry", () => {
      expect(calculatePricePnl("SHORT", 1.105, 1.1)).toBeCloseTo(-0.005);
    });

    it("returns 0 when price equals entry", () => {
      expect(calculatePricePnl("SHORT", 100, 100)).toBeCloseTo(0);
    });
  });

  describe("gold-like prices", () => {
    it("handles large values correctly", () => {
      // XAUUSD LONG: entry 2000, price 2015 => +15
      expect(calculatePricePnl("LONG", 2015, 2000)).toBe(15);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  calculateTargetRR                                                  */
/* ------------------------------------------------------------------ */

describe("calculateTargetRR", () => {
  describe("valid inputs", () => {
    it("calculates target R:R for TP above entry", () => {
      // TP=110, entry=100, risk=5 => |110-100|/5 = 2.0R
      expect(calculateTargetRR(110, 100, 5)).toBe(2);
    });

    it("calculates target R:R for TP below entry (short scenario)", () => {
      // TP=90, entry=100, risk=5 => |90-100|/5 = 2.0R
      expect(calculateTargetRR(90, 100, 5)).toBe(2);
    });

    it("handles fractional forex-like values", () => {
      // TP=1.1050, entry=1.0950, risk=0.005 => |0.01|/0.005 = 2.0R
      expect(calculateTargetRR(1.105, 1.095, 0.005)).toBeCloseTo(2);
    });
  });

  describe("null TP scenarios", () => {
    it("returns null when TP is null", () => {
      expect(calculateTargetRR(null, 100, 5)).toBeNull();
    });

    it("returns null when TP is undefined", () => {
      expect(calculateTargetRR(undefined, 100, 5)).toBeNull();
    });

    it("returns null when TP is 0", () => {
      expect(calculateTargetRR(0, 100, 5)).toBeNull();
    });

    it("returns null when TP is negative", () => {
      expect(calculateTargetRR(-10, 100, 5)).toBeNull();
    });
  });

  describe("invalid risk distance", () => {
    it("returns null when initialRiskAbs is 0", () => {
      expect(calculateTargetRR(110, 100, 0)).toBeNull();
    });

    it("returns null when initialRiskAbs is negative", () => {
      expect(calculateTargetRR(110, 100, -5)).toBeNull();
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Frozen Snapshot Resolution                                         */
/* ------------------------------------------------------------------ */

const CARD = { entry: 1.1, stopLoss: 1.09, targets: [1.12], direction: "LONG" };

describe("getFrozenEntry", () => {
  it("prefers officialEntryPrice when available", () => {
    expect(getFrozenEntry({ officialEntryPrice: 1.1005, initialEntry: 1.1 }, 1.1)).toBe(1.1005);
  });

  it("falls back to initialEntry when officialEntryPrice is null", () => {
    expect(getFrozenEntry({ officialEntryPrice: null, initialEntry: 1.1002 }, 1.1)).toBe(1.1002);
  });

  it("falls back to card entry when both are null", () => {
    expect(getFrozenEntry({ officialEntryPrice: null, initialEntry: null }, 1.1)).toBe(1.1);
  });

  it("falls back to card entry when trade is null", () => {
    expect(getFrozenEntry(null, 1.1)).toBe(1.1);
  });

  it("falls back to card entry when trade is undefined", () => {
    expect(getFrozenEntry(undefined, 1.1)).toBe(1.1);
  });
});

describe("getFrozenRiskAbs", () => {
  it("prefers officialInitialRiskAbs when available", () => {
    expect(getFrozenRiskAbs({ officialInitialRiskAbs: 0.015, initialRiskAbs: 0.01 }, 1.1, 1.09)).toBe(0.015);
  });

  it("falls back to initialRiskAbs when official is null", () => {
    expect(getFrozenRiskAbs({ officialInitialRiskAbs: null, initialRiskAbs: 0.01 }, 1.1, 1.09)).toBe(0.01);
  });

  it("skips officialInitialRiskAbs when zero", () => {
    expect(getFrozenRiskAbs({ officialInitialRiskAbs: 0, initialRiskAbs: 0.01 }, 1.1, 1.09)).toBe(0.01);
  });

  it("falls back to |frozenEntry - cardSL| when both frozen fields are null", () => {
    const result = getFrozenRiskAbs({ officialInitialRiskAbs: null, initialRiskAbs: null, officialEntryPrice: 1.1 }, 1.1, 1.09);
    expect(result).toBeCloseTo(0.01);
  });

  it("returns 0 when SL is 0 and no frozen risk exists", () => {
    expect(getFrozenRiskAbs(null, 1.1, 0)).toBe(0);
  });

  it("handles null trade", () => {
    expect(getFrozenRiskAbs(null, 1.1, 1.09)).toBeCloseTo(0.01);
  });
});

describe("getFrozenTP", () => {
  it("prefers officialInitialTargets[0] when available", () => {
    expect(getFrozenTP({ officialInitialTargets: [1.15] }, [1.12])).toBe(1.15);
  });

  it("falls back to card targets when officialInitialTargets is empty", () => {
    expect(getFrozenTP({ officialInitialTargets: [] }, [1.12])).toBe(1.12);
  });

  it("falls back to card targets when officialInitialTargets is null", () => {
    expect(getFrozenTP({ officialInitialTargets: null }, [1.12])).toBe(1.12);
  });

  it("falls back to card targets when trade is null", () => {
    expect(getFrozenTP(null, [1.12])).toBe(1.12);
  });

  it("returns 0 when no TP anywhere", () => {
    expect(getFrozenTP(null, [])).toBe(0);
  });

  it("skips officialInitialTargets[0] when it is 0", () => {
    expect(getFrozenTP({ officialInitialTargets: [0] }, [1.12])).toBe(1.12);
  });
});

/* ------------------------------------------------------------------ */
/*  getPlannedRRRatio + formatPlannedRR                                */
/* ------------------------------------------------------------------ */

describe("getPlannedRRRatio", () => {
  it("computes RR from official frozen snapshot (LONG)", () => {
    const trade = { officialEntryPrice: 1.1, officialInitialRiskAbs: 0.01, officialInitialTargets: [1.125] };
    // reward = 1.125 - 1.1 = 0.025, risk = 0.01 => RR = 2.5
    expect(getPlannedRRRatio(trade, CARD)).toBeCloseTo(2.5);
  });

  it("computes RR from official frozen snapshot (SHORT)", () => {
    const trade = { officialEntryPrice: 1.1, officialInitialRiskAbs: 0.01, officialInitialTargets: [1.075] };
    const card = { ...CARD, direction: "SHORT" };
    // reward = 1.1 - 1.075 = 0.025, risk = 0.01 => RR = 2.5
    expect(getPlannedRRRatio(trade, card)).toBeCloseTo(2.5);
  });

  it("uses card fallback when trade is null (untracked card)", () => {
    // reward = 1.12 - 1.1 = 0.02, risk = |1.1 - 1.09| = 0.01 => RR = 2.0
    expect(getPlannedRRRatio(null, CARD)).toBeCloseTo(2.0);
  });

  it("does NOT change when card SL is modified post-window", () => {
    const trade = { officialEntryPrice: 1.1, officialInitialRiskAbs: 0.01, officialInitialTargets: [1.125] };
    // SL moved from 1.09 to 1.098 (trailing) — card.stopLoss is now 1.098
    const modifiedCard = { ...CARD, stopLoss: 1.098 };
    // Should still be 2.5 from frozen snapshot, NOT 12.5 from mutable SL
    expect(getPlannedRRRatio(trade, modifiedCard)).toBeCloseTo(2.5);
  });

  it("does NOT change when card TP is modified post-window", () => {
    const trade = { officialEntryPrice: 1.1, officialInitialRiskAbs: 0.01, officialInitialTargets: [1.125] };
    // TP moved from 1.12 to 1.15 — card.targets is now [1.15]
    const modifiedCard = { ...CARD, targets: [1.15] };
    // Should still be 2.5 from frozen snapshot, NOT 5.0 from mutable TP
    expect(getPlannedRRRatio(trade, modifiedCard)).toBeCloseTo(2.5);
  });

  it("returns null when risk is zero", () => {
    expect(getPlannedRRRatio(null, { ...CARD, stopLoss: 1.1 })).toBeNull();
  });

  it("returns null when reward is negative (wrong direction)", () => {
    // LONG with TP below entry
    const trade = { officialEntryPrice: 1.1, officialInitialRiskAbs: 0.01, officialInitialTargets: [1.08] };
    expect(getPlannedRRRatio(trade, CARD)).toBeNull();
  });

  it("returns null when TP is 0", () => {
    expect(getPlannedRRRatio(null, { ...CARD, targets: [0] })).toBeNull();
  });

  it("falls back through hierarchy correctly: official > initial > card", () => {
    // Has initialRiskAbs but not official
    const trade = { initialRiskAbs: 0.012, initialEntry: 1.1005 };
    const card = { entry: 1.1, stopLoss: 1.09, targets: [1.125], direction: "LONG" };
    // reward = 1.125 - 1.1005 = 0.0245, risk = 0.012 => RR = ~2.04
    const rr = getPlannedRRRatio(trade, card);
    expect(rr).not.toBeNull();
    expect(rr!).toBeCloseTo(0.0245 / 0.012, 1);
  });
});

describe("formatPlannedRR", () => {
  it("formats as '1:X.X'", () => {
    const trade = { officialEntryPrice: 1.1, officialInitialRiskAbs: 0.01, officialInitialTargets: [1.125] };
    expect(formatPlannedRR(trade, CARD)).toBe("1:2.5");
  });

  it("returns null when ratio is null", () => {
    expect(formatPlannedRR(null, { ...CARD, stopLoss: 1.1 })).toBeNull();
  });

  it("is immune to post-window SL trailing to breakeven", () => {
    const trade = { officialEntryPrice: 100, officialInitialRiskAbs: 5, officialInitialTargets: [112.5] };
    // SL moved to entry (BE) — card.stopLoss = 100
    const card = { entry: 100, stopLoss: 100, targets: [112.5], direction: "LONG" };
    // Without frozen snapshot this would divide by 0 or give Infinity
    // With frozen snapshot: reward = 12.5, risk = 5 => 1:2.5
    expect(formatPlannedRR(trade, card)).toBe("1:2.5");
  });

  it("is immune to post-window SL moved into profit", () => {
    const trade = { officialEntryPrice: 100, officialInitialRiskAbs: 5, officialInitialTargets: [112.5] };
    // SL moved past entry to 103 (locked profit)
    const card = { entry: 100, stopLoss: 103, targets: [112.5], direction: "LONG" };
    // Without frozen snapshot: risk = |100-103| = 3 => 1:4.2
    // With frozen snapshot: risk = 5 => 1:2.5
    expect(formatPlannedRR(trade, card)).toBe("1:2.5");
  });
});
