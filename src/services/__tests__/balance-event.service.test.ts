import { describe, it, expect } from "vitest";
import {
  computeDynamicThreshold,
  computeExternalFlow,
  classifyExternalFlow,
  computeSubperiodReturn,
  computeTWR,
  computeUpdatedNav,
  computeNavDrawdown,
  adjustEquitySeries,
} from "../balance-event.service";

// ─── computeDynamicThreshold ───────────────────────────────────────────

describe("computeDynamicThreshold", () => {
  it("returns 1 for micro accounts (< $500)", () => {
    expect(computeDynamicThreshold(100)).toBe(1);
    expect(computeDynamicThreshold(499)).toBe(1);
  });

  it("returns 2 for small accounts ($500 - $5K)", () => {
    expect(computeDynamicThreshold(500)).toBe(2);
    expect(computeDynamicThreshold(4999)).toBe(2);
  });

  it("returns 5 for medium accounts ($5K - $50K)", () => {
    expect(computeDynamicThreshold(5000)).toBe(5);
    expect(computeDynamicThreshold(10000)).toBe(5);
    expect(computeDynamicThreshold(49999)).toBe(5);
  });

  it("returns 10 for large accounts ($50K - $500K)", () => {
    expect(computeDynamicThreshold(50000)).toBe(10);
    expect(computeDynamicThreshold(100000)).toBe(10);
  });

  it("returns 25 for very large accounts (> $500K)", () => {
    expect(computeDynamicThreshold(500000)).toBe(25);
    expect(computeDynamicThreshold(1000000)).toBe(25);
  });

  it("handles negative balance (margin call scenario)", () => {
    expect(computeDynamicThreshold(-500)).toBe(2);
  });
});

// ─── computeExternalFlow ───────────────────────────────────────────────

describe("computeExternalFlow", () => {
  it("returns null when balance change equals closed PnL (normal trade close)", () => {
    // Balance goes from 10000 to 10500, closed trades PnL = 500
    const result = computeExternalFlow(10000, 10500, 500);
    expect(result).toBeNull();
  });

  it("returns null when residual is within threshold (broker noise)", () => {
    // Balance goes from 10000 to 10503, closed PnL = 500, residual = 3
    const result = computeExternalFlow(10000, 10503, 500);
    expect(result).toBeNull(); // threshold is 5 for $10K account
  });

  it("detects deposit when balance increases beyond closed PnL", () => {
    // Balance: 10000 → 19200, closed PnL = 200 → externalFlow = 9000
    const result = computeExternalFlow(10000, 19200, 200);
    expect(result).not.toBeNull();
    expect(result!.signedAmount).toBe(9000);
    expect(result!.absAmount).toBe(9000);
  });

  it("detects withdrawal when balance drops beyond closed PnL", () => {
    // Balance: 10000 → 1200, closed PnL = 200 → externalFlow = -9000
    const result = computeExternalFlow(10000, 1200, 200);
    expect(result).not.toBeNull();
    expect(result!.signedAmount).toBe(-9000);
    expect(result!.absAmount).toBe(9000);
  });

  it("detects deposit with no trade closes", () => {
    // Balance: 5000 → 10000, no closes → externalFlow = 5000
    const result = computeExternalFlow(5000, 10000, 0);
    expect(result).not.toBeNull();
    expect(result!.signedAmount).toBe(5000);
  });

  it("detects withdrawal with no trade closes", () => {
    // Balance: 10000 → 1000, no closes → externalFlow = -9000
    const result = computeExternalFlow(10000, 1000, 0);
    expect(result).not.toBeNull();
    expect(result!.signedAmount).toBe(-9000);
  });

  it("detects deposit when trade also closed in same interval", () => {
    // Balance: 10000 → 20500, closed PnL = 500 → externalFlow = 10000
    const result = computeExternalFlow(10000, 20500, 500);
    expect(result).not.toBeNull();
    expect(result!.signedAmount).toBe(10000);
  });

  it("detects withdrawal when trade also closed in same interval", () => {
    // Balance: 10000 → 1500, closed PnL = 500 → externalFlow = -9000
    const result = computeExternalFlow(10000, 1500, 500);
    expect(result).not.toBeNull();
    expect(result!.signedAmount).toBe(-9000);
  });

  it("handles no balance change and no closes (idle heartbeat)", () => {
    const result = computeExternalFlow(10000, 10000, 0);
    expect(result).toBeNull();
  });

  it("rounds amounts to 2 decimal places", () => {
    const result = computeExternalFlow(10000, 10100.555, 0);
    expect(result).not.toBeNull();
    expect(result!.signedAmount).toBe(100.56);
    expect(result!.absAmount).toBe(100.56);
  });
});

// ─── classifyExternalFlow ──────────────────────────────────────────────

describe("classifyExternalFlow", () => {
  it("classifies positive flow as DEPOSIT", () => {
    expect(classifyExternalFlow(5000)).toBe("DEPOSIT");
    expect(classifyExternalFlow(0.01)).toBe("DEPOSIT");
  });

  it("classifies negative flow as WITHDRAWAL", () => {
    expect(classifyExternalFlow(-5000)).toBe("WITHDRAWAL");
    expect(classifyExternalFlow(-0.01)).toBe("WITHDRAWAL");
  });

  it("classifies zero flow as UNKNOWN_EXTERNAL_FLOW", () => {
    expect(classifyExternalFlow(0)).toBe("UNKNOWN_EXTERNAL_FLOW");
  });
});

// ─── computeSubperiodReturn ────────────────────────────────────────────

describe("computeSubperiodReturn", () => {
  it("computes normal trading return with no cash flow", () => {
    // Start: 10000, End: 10500, No CF → return = 5%
    const r = computeSubperiodReturn(10000, 10500, 0);
    expect(r).toBeCloseTo(0.05, 6);
  });

  it("strips out deposit from return calculation", () => {
    // Start: 10000, End: 19200, Deposit: 9000 → trading return = 2%
    const r = computeSubperiodReturn(10000, 19200, 9000);
    expect(r).toBeCloseTo(0.02, 6);
  });

  it("strips out withdrawal from return calculation", () => {
    // Start: 10000, End: 1200, Withdrawal: -9000 → trading return = 2%
    const r = computeSubperiodReturn(10000, 1200, -9000);
    expect(r).toBeCloseTo(0.02, 6);
  });

  it("handles negative trading return with deposit", () => {
    // Start: 10000, End: 18800, Deposit: 9000 → trading return = -2%
    const r = computeSubperiodReturn(10000, 18800, 9000);
    expect(r).toBeCloseTo(-0.02, 6);
  });

  it("returns 0 when starting value is zero", () => {
    expect(computeSubperiodReturn(0, 1000, 0)).toBe(0);
  });

  it("returns 0 when starting value is negative", () => {
    expect(computeSubperiodReturn(-100, 1000, 0)).toBe(0);
  });

  it("handles zero change correctly", () => {
    const r = computeSubperiodReturn(10000, 10000, 0);
    expect(r).toBe(0);
  });
});

// ─── computeTWR ────────────────────────────────────────────────────────

describe("computeTWR", () => {
  it("computes TWR from sub-period returns", () => {
    // Three periods: +5%, -2%, +3% → (1.05)(0.98)(1.03) - 1 ≈ 0.05987
    const twr = computeTWR([0.05, -0.02, 0.03]);
    expect(twr).toBeCloseTo(0.05987, 4);
  });

  it("returns 0 for empty returns", () => {
    expect(computeTWR([])).toBe(0);
  });

  it("handles single return", () => {
    const twr = computeTWR([0.1]);
    expect(twr).toBeCloseTo(0.1, 6);
  });

  it("correctly compounds multiple returns", () => {
    // Two periods of +10% each = (1.1)(1.1) - 1 = 0.21
    const twr = computeTWR([0.1, 0.1]);
    expect(twr).toBeCloseTo(0.21, 6);
  });

  it("handles all negative returns", () => {
    // Two periods of -5% = (0.95)(0.95) - 1 = -0.0975
    const twr = computeTWR([-0.05, -0.05]);
    expect(twr).toBeCloseTo(-0.0975, 4);
  });
});

// ─── computeUpdatedNav ─────────────────────────────────────────────────

describe("computeUpdatedNav", () => {
  it("updates NAV with normal trading return", () => {
    // NAV=1.0, equity 10000→10500, no CF → NAV = 1.05
    const nav = computeUpdatedNav(1.0, 10000, 10500, 0);
    expect(nav).toBeCloseTo(1.05, 4);
  });

  it("strips deposit from NAV calculation", () => {
    // NAV=1.0, equity 10000→19200, deposit 9000 → trading return 2% → NAV = 1.02
    const nav = computeUpdatedNav(1.0, 10000, 19200, 9000);
    expect(nav).toBeCloseTo(1.02, 4);
  });

  it("strips withdrawal from NAV calculation", () => {
    // NAV=1.0, equity 10000→1200, withdrawal -9000 → trading return 2% → NAV = 1.02
    const nav = computeUpdatedNav(1.0, 10000, 1200, -9000);
    expect(nav).toBeCloseTo(1.02, 4);
  });

  it("preserves existing NAV growth", () => {
    // NAV=1.5 (already 50% up), equity 15000→15750, no CF → 5% return → NAV = 1.575
    const nav = computeUpdatedNav(1.5, 15000, 15750, 0);
    expect(nav).toBeCloseTo(1.575, 4);
  });

  it("clamps extreme losses to prevent negative NAV", () => {
    // Extreme case: equity drops from 10000 to 50 → -99.5% return, clamped to -99%
    const nav = computeUpdatedNav(1.0, 10000, 50, 0);
    expect(nav).toBeGreaterThan(0);
  });

  it("returns current NAV when equity before is zero", () => {
    const nav = computeUpdatedNav(1.0, 0, 10000, 0);
    expect(nav).toBe(1.0);
  });
});

// ─── computeNavDrawdown ────────────────────────────────────────────────

describe("computeNavDrawdown", () => {
  it("returns 0 drawdown when at peak", () => {
    const { drawdownPct, newPeak } = computeNavDrawdown(1.5, 1.5);
    expect(drawdownPct).toBe(0);
    expect(newPeak).toBeCloseTo(1.5, 4);
  });

  it("computes drawdown below peak", () => {
    // NAV=1.35, peak=1.5 → drawdown = (1.5-1.35)/1.5 = 10%
    const { drawdownPct } = computeNavDrawdown(1.35, 1.5);
    expect(drawdownPct).toBe(10);
  });

  it("updates peak when NAV exceeds it", () => {
    const { newPeak } = computeNavDrawdown(1.6, 1.5);
    expect(newPeak).toBeCloseTo(1.6, 4);
  });

  it("returns 0 for zero peak", () => {
    const { drawdownPct } = computeNavDrawdown(0, 0);
    expect(drawdownPct).toBe(0);
  });
});

// ─── adjustEquitySeries ────────────────────────────────────────────────

describe("adjustEquitySeries", () => {
  it("passes through data unchanged when no external flows", () => {
    const data = [
      { balance: 10000, equity: 10200, externalFlowSigned: 0, timestamp: "t1" },
      { balance: 10000, equity: 10500, externalFlowSigned: 0, timestamp: "t2" },
    ];
    const result = adjustEquitySeries(data);
    expect(result[0].balance).toBe(10000);
    expect(result[0].equity).toBe(10200);
    expect(result[1].balance).toBe(10000);
    expect(result[1].equity).toBe(10500);
  });

  it("adjusts for deposit — removes spike", () => {
    const data = [
      { balance: 10000, equity: 10200, externalFlowSigned: 0, timestamp: "t1" },
      { balance: 19200, equity: 19400, externalFlowSigned: 9000, timestamp: "t2" }, // $9K deposit
      { balance: 19200, equity: 19700, externalFlowSigned: 0, timestamp: "t3" },
    ];
    const result = adjustEquitySeries(data);
    // Before deposit: unchanged
    expect(result[0].balance).toBe(10000);
    expect(result[0].equity).toBe(10200);
    // At deposit: adjusted = raw - cumFlow = 19200 - 9000 = 10200
    expect(result[1].balance).toBe(10200);
    expect(result[1].equity).toBe(10400);
    // After deposit: still adjusted
    expect(result[2].balance).toBe(10200);
    expect(result[2].equity).toBe(10700);
  });

  it("adjusts for withdrawal — removes cliff", () => {
    const data = [
      { balance: 10000, equity: 10200, externalFlowSigned: 0, timestamp: "t1" },
      { balance: 1200, equity: 1400, externalFlowSigned: -9000, timestamp: "t2" }, // $9K withdrawal
      { balance: 1200, equity: 1500, externalFlowSigned: 0, timestamp: "t3" },
    ];
    const result = adjustEquitySeries(data);
    // Before withdrawal: unchanged
    expect(result[0].balance).toBe(10000);
    // At withdrawal: adjusted = 1200 - (-9000) = 10200
    expect(result[1].balance).toBe(10200);
    expect(result[1].equity).toBe(10400);
    // After: adjusted = 1200 - (-9000) = 10200
    expect(result[2].balance).toBe(10200);
    expect(result[2].equity).toBe(10500);
  });

  it("handles multiple flows correctly", () => {
    const data = [
      { balance: 10000, equity: 10000, externalFlowSigned: 0, timestamp: "t1" },
      { balance: 15000, equity: 15200, externalFlowSigned: 5000, timestamp: "t2" }, // $5K deposit
      { balance: 15500, equity: 15700, externalFlowSigned: 0, timestamp: "t3" },
      { balance: 6500, equity: 6700, externalFlowSigned: -9000, timestamp: "t4" }, // $9K withdrawal
    ];
    const result = adjustEquitySeries(data);
    // Cumulative: 0, 5000, 5000, -4000
    expect(result[0].balance).toBe(10000);
    expect(result[1].balance).toBe(10000);    // 15000 - 5000
    expect(result[2].balance).toBe(10500);    // 15500 - 5000
    expect(result[3].balance).toBe(10500);    // 6500 - (-4000) = 6500 + 4000
  });

  it("preserves isEstimated and isBalanceEventBoundary", () => {
    const data = [
      { balance: 10000, equity: 10000, externalFlowSigned: 0, timestamp: "t1", isEstimated: false, isBalanceEventBoundary: false },
      { balance: 19000, equity: 19000, externalFlowSigned: 9000, timestamp: "t2", isEstimated: true, isBalanceEventBoundary: true },
    ];
    const result = adjustEquitySeries(data);
    expect(result[0].isEstimated).toBe(false);
    expect(result[0].isBalanceEventBoundary).toBe(false);
    expect(result[1].isEstimated).toBe(true);
    expect(result[1].isBalanceEventBoundary).toBe(true);
  });
});

// ─── Acceptance criteria: deposit case ─────────────────────────────────

describe("Acceptance: deposit does not distort performance", () => {
  it("$10K account + $200 profit + $9K deposit → performance stays ~2%", () => {
    // Before deposit: equity 10200, balance 10000
    // After deposit: raw equity 19200, raw balance 19000
    // Trading return = (19200 - 10200 - 9000) / 10200 = 0 / 10200 = 0
    // Wait — the deposit goes to balance, equity also jumps
    // Let's model it properly:
    // equityBefore = 10200 (10000 balance + 200 floating)
    // deposit of 9000 → equityAfter = 19200 (19000 balance + 200 floating)
    // externalFlow = 9000
    // subperiodReturn = (19200 - 10200 - 9000) / 10200 = 0/10200 = 0

    const r = computeSubperiodReturn(10200, 19200, 9000);
    expect(r).toBeCloseTo(0, 6); // No trading happened in this interval

    // TWR across the day:
    // Period 1: equity 10000→10200, no CF → +2%
    // Period 2: equity 10200→19200, CF=9000 → 0%
    const twr = computeTWR([0.02, 0]);
    expect(twr).toBeCloseTo(0.02, 4); // Total: +2% from trading

    // Chart adjustment:
    const series = adjustEquitySeries([
      { balance: 10000, equity: 10200, externalFlowSigned: 0, timestamp: "t1" },
      { balance: 19000, equity: 19200, externalFlowSigned: 9000, timestamp: "t2" },
    ]);
    // Adjusted chart: t1 = 10200, t2 = 19200 - 9000 = 10200 → flat (no fake spike)
    expect(series[1].equity).toBe(10200);
  });
});

// ─── Acceptance criteria: withdrawal case ──────────────────────────────

describe("Acceptance: withdrawal does not distort performance", () => {
  it("$10K account + $200 profit + $9K withdrawal → performance stays ~2%", () => {
    // equityBefore = 10200 (10000 balance + 200 floating)
    // withdrawal of 9000 → equityAfter = 1200 (1000 balance + 200 floating)
    // externalFlow = -9000
    // subperiodReturn = (1200 - 10200 - (-9000)) / 10200 = 0/10200 = 0

    const r = computeSubperiodReturn(10200, 1200, -9000);
    expect(r).toBeCloseTo(0, 6);

    // TWR across the day:
    const twr = computeTWR([0.02, 0]);
    expect(twr).toBeCloseTo(0.02, 4);

    // Chart adjustment:
    const series = adjustEquitySeries([
      { balance: 10000, equity: 10200, externalFlowSigned: 0, timestamp: "t1" },
      { balance: 1000, equity: 1200, externalFlowSigned: -9000, timestamp: "t2" },
    ]);
    // Adjusted chart: t2 = 1200 - (-9000) = 10200 → continuous (no fake cliff)
    expect(series[1].equity).toBe(10200);
  });
});

// ─── Acceptance: drawdown not poisoned by withdrawal ───────────────────

describe("Acceptance: drawdown uses NAV, not raw equity", () => {
  it("withdrawal does not create phantom drawdown", () => {
    // Start: NAV=1.0, equity=10000
    // Trading profit: equity→10200 → NAV updated
    const nav1 = computeUpdatedNav(1.0, 10000, 10200, 0);
    expect(nav1).toBeCloseTo(1.02, 4);

    // Withdrawal of $9000: equity drops 10200→1200, CF=-9000
    const nav2 = computeUpdatedNav(nav1, 10200, 1200, -9000);
    // Trading return = (1200 - 10200 - (-9000)) / 10200 = 0 → NAV unchanged
    expect(nav2).toBeCloseTo(1.02, 4);

    // Drawdown from NAV peak
    const { drawdownPct } = computeNavDrawdown(nav2, nav1);
    expect(drawdownPct).toBe(0); // No drawdown — withdrawal didn't affect NAV
  });
});
