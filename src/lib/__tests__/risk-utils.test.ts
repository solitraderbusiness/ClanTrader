import { describe, it, expect } from "vitest";
import {
  deriveRiskStatus,
  calculateLiveRR,
  calculateTargetRR,
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
