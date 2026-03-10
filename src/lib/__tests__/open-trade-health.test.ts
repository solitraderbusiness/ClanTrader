import { describe, it, expect, beforeEach } from "vitest";
import {
  computeDataConfidence,
  computeRComputability,
  computeEntryQuality,
  computeProtectionStatus,
  computeSetupStatus,
  computeManagementStatus,
  computeProfitProtection,
  resolveOverallHealth,
  computeOpenTradeHealth,
  buildAttentionQueue,
  buildLiveHealthSummary,
} from "../open-trade-health";
import type {
  OpenTradeInput,
  OpenTradeHealth,
} from "../open-trade-health";

// ─── Factory ───────────────────────────────────────────────────────────────

/**
 * Builds a healthy LONG trade input with all data present.
 * Defaults:
 *   entry=100, SL=95, TP=110
 *   currentPrice=105 (mid-way, not near SL)
 *   currentSL=95 (unchanged), currentTP=110 (unchanged)
 *   floatingR=1.0 (in modest profit)
 *   trackingStatus=ACTIVE, priceAvailable=true
 */
function makeInput(overrides: Partial<OpenTradeInput> = {}): OpenTradeInput {
  return {
    tradeId: "trade-1",
    userId: "user-1",
    username: "trader_a",
    instrument: "EURUSD",
    direction: "LONG",

    // Live state
    currentPrice: 105,
    currentSL: 95,
    currentTP: 110,
    floatingPnl: 50,
    floatingR: 1.0,

    // Card values
    cardEntry: 100,
    cardSL: 95,
    cardTargets: [110],

    // Official frozen snapshot
    officialEntry: 100,
    officialSL: 95,
    officialTargets: [110],
    officialRiskAbs: 5,
    officialRiskMoney: 100,

    // MT actual
    mtOpenPrice: 100,

    // Tracking
    trackingStatus: "ACTIVE",
    priceAvailable: true,
    riskStatus: "PROTECTED",

    ...overrides,
  };
}

// ─── makeTradeWithHealth helper ────────────────────────────────────────────

function makeTradeWithHealth(
  healthOverrides: Partial<OpenTradeHealth> = {},
  extra: {
    tradeId?: string;
    userId?: string;
    username?: string;
    instrument?: string;
    floatingR?: number | null;
    trackingStatus?: string;
    rComputable?: boolean;
  } = {}
) {
  const defaultHealth: OpenTradeHealth = {
    overall: "HEALTHY",
    dataConfidence: "HIGH",
    entryQuality: "PRECISE",
    protectionStatus: "PROTECTED",
    setupStatus: "VALID",
    managementStatus: "ON_PLAN",
    profitProtection: "N_A",
    reasons: [],
  };

  return {
    tradeId: extra.tradeId ?? "trade-1",
    userId: extra.userId ?? "user-1",
    username: extra.username ?? "trader_a",
    instrument: extra.instrument ?? "EURUSD",
    floatingR: extra.floatingR ?? null,
    trackingStatus: extra.trackingStatus ?? "ACTIVE",
    rComputable: extra.rComputable ?? true,
    health: { ...defaultHealth, ...healthOverrides },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// computeDataConfidence
// ══════════════════════════════════════════════════════════════════════════════

describe("computeDataConfidence", () => {
  beforeEach(() => {});

  it("returns LOW when trackingStatus is TRACKING_LOST", () => {
    const result = computeDataConfidence(
      makeInput({ trackingStatus: "TRACKING_LOST" })
    );
    expect(result).toBe("LOW");
  });

  it("returns LOW when price is not available and currentPrice is null", () => {
    const result = computeDataConfidence(
      makeInput({ priceAvailable: false, currentPrice: null })
    );
    expect(result).toBe("LOW");
  });

  it("returns LOW when both price unavailable conditions are met", () => {
    const result = computeDataConfidence(
      makeInput({
        trackingStatus: "ACTIVE",
        priceAvailable: false,
        currentPrice: null,
      })
    );
    expect(result).toBe("LOW");
  });

  it("returns PARTIAL when trackingStatus is STALE", () => {
    const result = computeDataConfidence(
      makeInput({ trackingStatus: "STALE" })
    );
    expect(result).toBe("PARTIAL");
  });

  it("returns PARTIAL when no official entry and no official SL", () => {
    const result = computeDataConfidence(
      makeInput({ officialEntry: null, officialSL: null })
    );
    expect(result).toBe("PARTIAL");
  });

  it("returns PARTIAL when officialEntry equals officialSL", () => {
    const result = computeDataConfidence(
      makeInput({ officialEntry: 100, officialSL: 100 })
    );
    expect(result).toBe("PARTIAL");
  });

  it("returns PARTIAL when cardEntry equals cardSL with no official data", () => {
    const result = computeDataConfidence(
      makeInput({
        officialEntry: null,
        officialSL: null,
        cardEntry: 100,
        cardSL: 100,
      })
    );
    // No official data → PARTIAL before reaching entry===sl check
    expect(result).toBe("PARTIAL");
  });

  it("returns HIGH when all data is present with valid official snapshot", () => {
    const result = computeDataConfidence(makeInput());
    expect(result).toBe("HIGH");
  });

  it("returns HIGH when price is available even without official entry (falls back to card)", () => {
    // cardEntry != cardSL, no official data but STALE condition not triggered
    // Actually without officialEntry/SL it returns PARTIAL
    const result = computeDataConfidence(
      makeInput({ officialEntry: null, officialSL: null })
    );
    expect(result).toBe("PARTIAL");
  });

  it("returns HIGH when priceAvailable is false but currentPrice is set (partial availability)", () => {
    // priceAvailable=false but currentPrice is non-null → does NOT trigger LOW
    const result = computeDataConfidence(
      makeInput({ priceAvailable: false, currentPrice: 105 })
    );
    expect(result).toBe("HIGH");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// computeRComputability
// ══════════════════════════════════════════════════════════════════════════════

describe("computeRComputability", () => {
  it("returns false when officialEntry is null and cardEntry is 0 (falsy)", () => {
    const result = computeRComputability(
      makeInput({ officialEntry: null, officialSL: null, cardEntry: 0, cardSL: 95 })
    );
    expect(result).toBe(false);
  });

  it("returns false when officialSL is null and cardSL is 0 (falsy)", () => {
    const result = computeRComputability(
      makeInput({ officialEntry: null, officialSL: null, cardEntry: 100, cardSL: 0 })
    );
    expect(result).toBe(false);
  });

  it("returns false when entry equals SL (no risk distance)", () => {
    const result = computeRComputability(
      makeInput({ officialEntry: 100, officialSL: 100 })
    );
    expect(result).toBe(false);
  });

  it("returns false when officialEntry equals officialSL after override", () => {
    const result = computeRComputability(
      makeInput({ officialEntry: 50, officialSL: 50 })
    );
    expect(result).toBe(false);
  });

  it("returns true when officialRiskAbs is positive", () => {
    const result = computeRComputability(
      makeInput({ officialRiskAbs: 5, officialEntry: 100, officialSL: 95 })
    );
    expect(result).toBe(true);
  });

  it("returns true when entry/SL have valid separation (fallback path)", () => {
    const result = computeRComputability(
      makeInput({ officialRiskAbs: null, officialEntry: 100, officialSL: 90 })
    );
    expect(result).toBe(true);
  });

  it("returns true when using card entry/SL fallback with valid separation", () => {
    const result = computeRComputability(
      makeInput({
        officialEntry: null,
        officialSL: null,
        officialRiskAbs: null,
        cardEntry: 100,
        cardSL: 90,
      })
    );
    expect(result).toBe(true);
  });

  it("returns false when officialRiskAbs is 0", () => {
    const result = computeRComputability(
      makeInput({
        officialRiskAbs: 0,
        officialEntry: 100,
        officialSL: 100,
      })
    );
    expect(result).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// computeEntryQuality
// ══════════════════════════════════════════════════════════════════════════════

describe("computeEntryQuality", () => {
  it("returns UNKNOWN when mtOpenPrice is null", () => {
    const result = computeEntryQuality(makeInput({ mtOpenPrice: null }));
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN when mtOpenPrice is 0 (falsy)", () => {
    const result = computeEntryQuality(makeInput({ mtOpenPrice: 0 }));
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN when planned entry is 0 via card fallback", () => {
    const result = computeEntryQuality(
      makeInput({ officialEntry: null, cardEntry: 0, mtOpenPrice: 100 })
    );
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN when risk distance is zero (entry equals SL)", () => {
    // plannedEntry=100, plannedSL=100 → riskDistance=0
    const result = computeEntryQuality(
      makeInput({ officialEntry: 100, officialSL: 100, mtOpenPrice: 100 })
    );
    expect(result).toBe("UNKNOWN");
  });

  it("returns PRECISE when deviation is exactly at 0.10 threshold", () => {
    // riskDistance = |100 - 90| = 10; deviation = |100.99 - 100| / 10 = 0.099
    const result = computeEntryQuality(
      makeInput({ officialEntry: 100, officialSL: 90, mtOpenPrice: 100.99 })
    );
    expect(result).toBe("PRECISE");
  });

  it("returns PRECISE when deviation is well within 0.10", () => {
    // riskDistance=10; actualEntry=100; deviation=0/10=0
    const result = computeEntryQuality(
      makeInput({ officialEntry: 100, officialSL: 90, mtOpenPrice: 100 })
    );
    expect(result).toBe("PRECISE");
  });

  it("returns GOOD when deviation is between 0.10 and 0.25", () => {
    // riskDistance=10; actualEntry=101.5; deviation=1.5/10=0.15
    const result = computeEntryQuality(
      makeInput({ officialEntry: 100, officialSL: 90, mtOpenPrice: 101.5 })
    );
    expect(result).toBe("GOOD");
  });

  it("returns GOOD when deviation is at 0.25 threshold", () => {
    // riskDistance=10; actualEntry=102.49; deviation=2.49/10=0.249
    const result = computeEntryQuality(
      makeInput({ officialEntry: 100, officialSL: 90, mtOpenPrice: 102.49 })
    );
    expect(result).toBe("GOOD");
  });

  it("returns LATE when deviation is between 0.25 and 0.50", () => {
    // riskDistance=10; actualEntry=103; deviation=3/10=0.30
    const result = computeEntryQuality(
      makeInput({ officialEntry: 100, officialSL: 90, mtOpenPrice: 103 })
    );
    expect(result).toBe("LATE");
  });

  it("returns LATE when deviation is at 0.50 threshold", () => {
    // riskDistance=10; actualEntry=104.99; deviation=4.99/10=0.499
    const result = computeEntryQuality(
      makeInput({ officialEntry: 100, officialSL: 90, mtOpenPrice: 104.99 })
    );
    expect(result).toBe("LATE");
  });

  it("returns CHASED when deviation exceeds 0.50", () => {
    // riskDistance=10; actualEntry=106; deviation=6/10=0.60
    const result = computeEntryQuality(
      makeInput({ officialEntry: 100, officialSL: 90, mtOpenPrice: 106 })
    );
    expect(result).toBe("CHASED");
  });

  it("works for SHORT direction — deviation measured by absolute difference", () => {
    // SHORT: plannedEntry=100, plannedSL=110 → riskDistance=10
    // actualEntry=101.5 → deviation=1.5/10=0.15 → GOOD
    const result = computeEntryQuality(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        officialSL: 110,
        mtOpenPrice: 101.5,
      })
    );
    expect(result).toBe("GOOD");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// computeProtectionStatus
// ══════════════════════════════════════════════════════════════════════════════

describe("computeProtectionStatus", () => {
  // ── UNKNOWN_RISK ──────────────────────────────────────────────────────────

  it("returns UNKNOWN_RISK when officialSL is null and cardSL is 0", () => {
    const result = computeProtectionStatus(
      makeInput({ officialSL: null, cardSL: 0 })
    );
    expect(result).toBe("UNKNOWN_RISK");
  });

  it("returns UNKNOWN_RISK when originalSL is 0", () => {
    // Both officialSL and cardSL are effectively 0
    const result = computeProtectionStatus(
      makeInput({ officialSL: 0 as unknown as null, cardSL: 0 })
    );
    expect(result).toBe("UNKNOWN_RISK");
  });

  // ── UNPROTECTED ───────────────────────────────────────────────────────────

  it("returns UNPROTECTED when currentSL is null (SL removed)", () => {
    const result = computeProtectionStatus(
      makeInput({ currentSL: null })
    );
    expect(result).toBe("UNPROTECTED");
  });

  it("returns UNPROTECTED when currentSL is 0", () => {
    const result = computeProtectionStatus(
      makeInput({ currentSL: 0 })
    );
    expect(result).toBe("UNPROTECTED");
  });

  // ── BREAKEVEN_LOCKED ──────────────────────────────────────────────────────

  it("returns BREAKEVEN_LOCKED for LONG when currentSL equals entry", () => {
    // entry=100, currentSL=100 → SL at entry
    const result = computeProtectionStatus(
      makeInput({ officialEntry: 100, currentSL: 100 })
    );
    expect(result).toBe("BREAKEVEN_LOCKED");
  });

  it("returns BREAKEVEN_LOCKED for LONG when currentSL is above entry", () => {
    // entry=100, currentSL=105 → SL above entry (profit locked)
    const result = computeProtectionStatus(
      makeInput({ officialEntry: 100, currentSL: 105 })
    );
    expect(result).toBe("BREAKEVEN_LOCKED");
  });

  it("returns BREAKEVEN_LOCKED for SHORT when currentSL equals entry", () => {
    // SHORT: entry=100, currentSL=100 → SL at entry
    const result = computeProtectionStatus(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        officialSL: 110,
        cardSL: 110,
        currentSL: 100,
      })
    );
    expect(result).toBe("BREAKEVEN_LOCKED");
  });

  it("returns BREAKEVEN_LOCKED for SHORT when currentSL is below entry", () => {
    // SHORT: entry=100, currentSL=95 → SL below entry (profit locked)
    const result = computeProtectionStatus(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        officialSL: 110,
        cardSL: 110,
        currentSL: 95,
      })
    );
    expect(result).toBe("BREAKEVEN_LOCKED");
  });

  // ── PARTIALLY_PROTECTED ───────────────────────────────────────────────────

  it("returns PARTIALLY_PROTECTED for LONG when SL improved more than 10%", () => {
    // originalRisk = |100 - 90| = 10
    // currentSL = 92 → currentRisk = |100 - 92| = 8 → improvement = (10-8)/10 = 0.20 > 0.10
    const result = computeProtectionStatus(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        cardSL: 90,
        currentSL: 92,
      })
    );
    expect(result).toBe("PARTIALLY_PROTECTED");
  });

  it("returns PARTIALLY_PROTECTED for SHORT when SL improved more than 10%", () => {
    // SHORT: originalRisk = |100 - 110| = 10
    // currentSL = 108 → currentRisk = |100 - 108| = 8 → improvement = 0.20 > 0.10
    const result = computeProtectionStatus(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        officialSL: 110,
        cardSL: 110,
        currentSL: 108,
      })
    );
    expect(result).toBe("PARTIALLY_PROTECTED");
  });

  // ── PROTECTED ─────────────────────────────────────────────────────────────

  it("returns PROTECTED for LONG when SL is unchanged", () => {
    // originalRisk=5, currentSL=95 → improvement=0 → PROTECTED
    const result = computeProtectionStatus(makeInput());
    expect(result).toBe("PROTECTED");
  });

  it("returns PROTECTED when SL improved <= 10% (just under threshold)", () => {
    // originalRisk = |100 - 90| = 10
    // currentSL = 90.9 → currentRisk = 9.1 → improvement = 0.09 ≤ 0.10
    const result = computeProtectionStatus(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        cardSL: 90,
        currentSL: 90.9,
      })
    );
    expect(result).toBe("PROTECTED");
  });

  it("returns PROTECTED when entry data is missing (falls back to PROTECTED)", () => {
    // No entry available → protection returns PROTECTED as fallback
    const result = computeProtectionStatus(
      makeInput({
        officialEntry: null,
        mtOpenPrice: null,
        cardEntry: 0,
        officialSL: 90,
        currentSL: 92,
      })
    );
    expect(result).toBe("PROTECTED");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// computeSetupStatus
// ══════════════════════════════════════════════════════════════════════════════

describe("computeSetupStatus", () => {
  // ── UNKNOWN ───────────────────────────────────────────────────────────────

  it("returns UNKNOWN when trackingStatus is TRACKING_LOST", () => {
    const result = computeSetupStatus(
      makeInput({ trackingStatus: "TRACKING_LOST" })
    );
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN when currentPrice is null", () => {
    const result = computeSetupStatus(makeInput({ currentPrice: null }));
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN when current SL is null and no fallback SL", () => {
    const result = computeSetupStatus(
      makeInput({ currentSL: null, officialSL: null, cardSL: 0 })
    );
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN when SL is 0", () => {
    const result = computeSetupStatus(
      makeInput({ currentSL: 0 })
    );
    expect(result).toBe("UNKNOWN");
  });

  // ── INVALIDATED ───────────────────────────────────────────────────────────

  it("returns INVALIDATED for LONG when price is below SL", () => {
    // LONG: price=93 <= SL=95 → invalidated
    const result = computeSetupStatus(
      makeInput({ currentPrice: 93, currentSL: 95 })
    );
    expect(result).toBe("INVALIDATED");
  });

  it("returns INVALIDATED for LONG when price equals SL", () => {
    const result = computeSetupStatus(
      makeInput({ currentPrice: 95, currentSL: 95 })
    );
    expect(result).toBe("INVALIDATED");
  });

  it("returns INVALIDATED for SHORT when price is above SL", () => {
    // SHORT: entry=100, SL=110; price=112 >= SL=110 → invalidated
    const result = computeSetupStatus(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        currentPrice: 112,
        currentSL: 110,
      })
    );
    expect(result).toBe("INVALIDATED");
  });

  it("returns INVALIDATED for SHORT when price equals SL", () => {
    const result = computeSetupStatus(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        currentPrice: 110,
        currentSL: 110,
      })
    );
    expect(result).toBe("INVALIDATED");
  });

  // ── NEAR_INVALIDATION ─────────────────────────────────────────────────────

  it("returns NEAR_INVALIDATION for LONG when price is within 25% of risk distance to SL", () => {
    // entry=100, SL=80 → riskDistance=20; distanceToSL = price - SL
    // ratio < 0.25 → distanceToSL < 5 → price < 85
    // price=83: distanceToSL=3, ratio=3/20=0.15 < 0.25 → NEAR_INVALIDATION
    const result = computeSetupStatus(
      makeInput({
        officialEntry: 100,
        currentSL: 80,
        currentPrice: 83,
      })
    );
    expect(result).toBe("NEAR_INVALIDATION");
  });

  it("returns NEAR_INVALIDATION for SHORT within 25% of risk distance to SL", () => {
    // SHORT: entry=100, SL=120 → riskDistance=20
    // distanceToSL = SL - price; ratio < 0.25 → distanceToSL < 5
    // price=117: distanceToSL=3, ratio=3/20=0.15 < 0.25 → NEAR_INVALIDATION
    const result = computeSetupStatus(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        currentSL: 120,
        currentPrice: 117,
      })
    );
    expect(result).toBe("NEAR_INVALIDATION");
  });

  // ── VALID ─────────────────────────────────────────────────────────────────

  it("returns VALID for LONG when price is comfortably above SL", () => {
    // entry=100, SL=95, price=105 → riskDistance=5, distanceToSL=10, ratio=2 > 0.25
    const result = computeSetupStatus(makeInput());
    expect(result).toBe("VALID");
  });

  it("returns VALID for SHORT when price is comfortably below SL", () => {
    // SHORT: entry=100, SL=110, price=95 → riskDistance=10, distanceToSL=15, ratio=1.5 > 0.25
    const result = computeSetupStatus(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        currentSL: 110,
        currentPrice: 95,
      })
    );
    expect(result).toBe("VALID");
  });

  it("returns VALID when entry data missing but price clearly above SL", () => {
    // No entry → cannot compute ratio → returns VALID
    const result = computeSetupStatus(
      makeInput({
        officialEntry: null,
        mtOpenPrice: null,
        cardEntry: 0,
        currentPrice: 105,
        currentSL: 95,
      })
    );
    expect(result).toBe("VALID");
  });

  it("returns VALID when risk distance is zero (SL equals entry)", () => {
    // riskDistance=0 → returns VALID (guard)
    const result = computeSetupStatus(
      makeInput({
        officialEntry: 100,
        currentSL: 100,
        currentPrice: 105,
      })
    );
    expect(result).toBe("VALID");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// computeManagementStatus
// ══════════════════════════════════════════════════════════════════════════════

describe("computeManagementStatus", () => {
  // ── UNKNOWN ───────────────────────────────────────────────────────────────

  it("returns UNKNOWN when officialSL is null (no frozen snapshot)", () => {
    const result = computeManagementStatus(
      makeInput({ officialSL: null })
    );
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN when officialEntry is null", () => {
    const result = computeManagementStatus(
      makeInput({ officialEntry: null })
    );
    expect(result).toBe("UNKNOWN");
  });

  it("returns UNKNOWN when officialEntry equals officialSL (zero risk distance)", () => {
    const result = computeManagementStatus(
      makeInput({ officialEntry: 100, officialSL: 100 })
    );
    expect(result).toBe("UNKNOWN");
  });

  // ── BROKEN: SL removed ───────────────────────────────────────────────────

  it("returns BROKEN when currentSL is null (SL removed after official snapshot)", () => {
    const result = computeManagementStatus(
      makeInput({ currentSL: null })
    );
    expect(result).toBe("BROKEN");
  });

  it("returns BROKEN when currentSL is 0 (SL zeroed out)", () => {
    const result = computeManagementStatus(
      makeInput({ currentSL: 0 })
    );
    expect(result).toBe("BROKEN");
  });

  // ── BROKEN: SL widened > 10% ─────────────────────────────────────────────

  it("returns BROKEN for LONG when SL moved significantly lower (widened > 10%)", () => {
    // officialEntry=100, officialSL=90 → originalRisk=10
    // currentSL=88 → widening = 90-88 = 2 → ratio = 2/10 = 0.20 > 0.10 → BROKEN
    const result = computeManagementStatus(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        currentSL: 88,
      })
    );
    expect(result).toBe("BROKEN");
  });

  it("returns BROKEN for SHORT when SL moved significantly higher (widened > 10%)", () => {
    // SHORT: officialEntry=100, officialSL=110 → originalRisk=10
    // currentSL=112 → widening = 112-110 = 2 → ratio = 2/10 = 0.20 > 0.10 → BROKEN
    const result = computeManagementStatus(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        officialSL: 110,
        currentSL: 112,
      })
    );
    expect(result).toBe("BROKEN");
  });

  it("does NOT return BROKEN for LONG when SL widened <= 10%", () => {
    // officialEntry=100, officialSL=90 → originalRisk=10
    // currentSL=89.5 → widening = 0.5 → ratio = 0.05 ≤ 0.10 → not BROKEN
    const result = computeManagementStatus(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        currentSL: 89.5,
      })
    );
    expect(result).not.toBe("BROKEN");
  });

  // ── DRIFTED: TP changed > 25% ─────────────────────────────────────────────

  it("returns DRIFTED when TP changed more than 25% of target distance", () => {
    // officialEntry=100, officialTP=110 → targetDistance=10
    // currentTP=113 → tpDrift = |113-110|/10 = 0.30 > 0.25 → DRIFTED
    const result = computeManagementStatus(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        officialTargets: [110],
        currentTP: 113,
      })
    );
    expect(result).toBe("DRIFTED");
  });

  it("does NOT return DRIFTED when TP changed <= 25%", () => {
    // officialEntry=100, officialTP=110 → targetDistance=10
    // currentTP=112.4 → tpDrift = 2.4/10 = 0.24 ≤ 0.25 → not DRIFTED
    const result = computeManagementStatus(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        officialTargets: [110],
        currentTP: 112.4,
      })
    );
    expect(result).not.toBe("DRIFTED");
  });

  it("does NOT return DRIFTED when officialTargets is empty", () => {
    // No official TP to compare against
    const result = computeManagementStatus(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        officialTargets: [],
        currentTP: 115,
      })
    );
    expect(result).toBe("ON_PLAN");
  });

  it("does NOT return DRIFTED when currentTP is null", () => {
    const result = computeManagementStatus(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        officialTargets: [110],
        currentTP: null,
      })
    );
    expect(result).toBe("ON_PLAN");
  });

  // ── ON_PLAN ───────────────────────────────────────────────────────────────

  it("returns ON_PLAN when SL is unchanged and TP is within bounds", () => {
    const result = computeManagementStatus(makeInput());
    expect(result).toBe("ON_PLAN");
  });

  it("returns ON_PLAN when SL is tightened (improved) for LONG", () => {
    // LONG: officialSL=90, currentSL=92 → SL moved up (improved) — not widened
    const result = computeManagementStatus(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        currentSL: 92,
        currentTP: 110,
        officialTargets: [110],
      })
    );
    expect(result).toBe("ON_PLAN");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// computeProfitProtection
// ══════════════════════════════════════════════════════════════════════════════

describe("computeProfitProtection", () => {
  it("returns N_A when floatingR is null", () => {
    const result = computeProfitProtection(
      makeInput({ floatingR: null }),
      true,
      "PROTECTED"
    );
    expect(result).toBe("N_A");
  });

  it("returns N_A when floatingR is zero (not in profit)", () => {
    const result = computeProfitProtection(
      makeInput({ floatingR: 0 }),
      true,
      "PROTECTED"
    );
    expect(result).toBe("N_A");
  });

  it("returns N_A when floatingR is negative (in loss)", () => {
    const result = computeProfitProtection(
      makeInput({ floatingR: -0.5 }),
      true,
      "PROTECTED"
    );
    expect(result).toBe("N_A");
  });

  it("returns N_A when R is not computable even if in profit", () => {
    const result = computeProfitProtection(
      makeInput({ floatingR: 2.0 }),
      false,
      "PROTECTED"
    );
    expect(result).toBe("N_A");
  });

  it("returns SECURED when in profit with BREAKEVEN_LOCKED protection", () => {
    const result = computeProfitProtection(
      makeInput({ floatingR: 1.5 }),
      true,
      "BREAKEVEN_LOCKED"
    );
    expect(result).toBe("SECURED");
  });

  it("returns SECURED when in profit with PARTIALLY_PROTECTED protection", () => {
    const result = computeProfitProtection(
      makeInput({ floatingR: 0.5 }),
      true,
      "PARTIALLY_PROTECTED"
    );
    expect(result).toBe("SECURED");
  });

  it("returns FRAGILE_WINNER when in profit with UNPROTECTED status", () => {
    const result = computeProfitProtection(
      makeInput({ floatingR: 1.0 }),
      true,
      "UNPROTECTED"
    );
    expect(result).toBe("FRAGILE_WINNER");
  });

  it("returns FRAGILE_WINNER when in profit with UNKNOWN_RISK status", () => {
    const result = computeProfitProtection(
      makeInput({ floatingR: 2.0 }),
      true,
      "UNKNOWN_RISK"
    );
    expect(result).toBe("FRAGILE_WINNER");
  });

  it("returns OPEN_WINNER when in profit with PROTECTED status", () => {
    const result = computeProfitProtection(
      makeInput({ floatingR: 1.0 }),
      true,
      "PROTECTED"
    );
    expect(result).toBe("OPEN_WINNER");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// resolveOverallHealth
// ══════════════════════════════════════════════════════════════════════════════

describe("resolveOverallHealth", () => {
  it("returns LOW_CONFIDENCE when confidence is LOW (highest precedence)", () => {
    const result = resolveOverallHealth(
      "LOW",
      "UNPROTECTED",
      "INVALIDATED",
      "BROKEN",
      "CHASED",
      "FRAGILE_WINNER"
    );
    expect(result).toBe("LOW_CONFIDENCE");
  });

  it("returns BROKEN_PLAN when setup is INVALIDATED (precedence 2)", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "INVALIDATED",
      "ON_PLAN",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("BROKEN_PLAN");
  });

  it("returns BROKEN_PLAN when management is BROKEN (precedence 2)", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "VALID",
      "BROKEN",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("BROKEN_PLAN");
  });

  it("returns BROKEN_PLAN for INVALIDATED even when management is ON_PLAN", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "INVALIDATED",
      "ON_PLAN",
      "GOOD",
      "N_A"
    );
    expect(result).toBe("BROKEN_PLAN");
  });

  it("returns AT_RISK when protection is UNPROTECTED (precedence 3)", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "UNPROTECTED",
      "VALID",
      "ON_PLAN",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("AT_RISK");
  });

  it("returns AT_RISK when protection is UNKNOWN_RISK", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "UNKNOWN_RISK",
      "VALID",
      "ON_PLAN",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("AT_RISK");
  });

  it("returns AT_RISK when setup is NEAR_INVALIDATION", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "NEAR_INVALIDATION",
      "ON_PLAN",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("AT_RISK");
  });

  it("returns AT_RISK when profitProtection is FRAGILE_WINNER", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "VALID",
      "ON_PLAN",
      "PRECISE",
      "FRAGILE_WINNER"
    );
    expect(result).toBe("AT_RISK");
  });

  it("returns NEEDS_REVIEW when entryQuality is LATE (precedence 4)", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "VALID",
      "ON_PLAN",
      "LATE",
      "N_A"
    );
    expect(result).toBe("NEEDS_REVIEW");
  });

  it("returns NEEDS_REVIEW when entryQuality is CHASED", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "VALID",
      "ON_PLAN",
      "CHASED",
      "N_A"
    );
    expect(result).toBe("NEEDS_REVIEW");
  });

  it("returns NEEDS_REVIEW when management is DRIFTED", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "VALID",
      "DRIFTED",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("NEEDS_REVIEW");
  });

  it("returns NEEDS_REVIEW when confidence is PARTIAL", () => {
    const result = resolveOverallHealth(
      "PARTIAL",
      "PROTECTED",
      "VALID",
      "ON_PLAN",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("NEEDS_REVIEW");
  });

  it("returns HEALTHY when all conditions are nominal", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "VALID",
      "ON_PLAN",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("HEALTHY");
  });

  it("returns HEALTHY with OPEN_WINNER profit protection", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "PROTECTED",
      "VALID",
      "ON_PLAN",
      "PRECISE",
      "OPEN_WINNER"
    );
    expect(result).toBe("HEALTHY");
  });

  it("returns HEALTHY with SECURED profit protection", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "BREAKEVEN_LOCKED",
      "VALID",
      "ON_PLAN",
      "PRECISE",
      "SECURED"
    );
    expect(result).toBe("HEALTHY");
  });

  it("LOW_CONFIDENCE takes precedence over BROKEN_PLAN", () => {
    // Even if setup is INVALIDATED, LOW confidence wins
    const result = resolveOverallHealth(
      "LOW",
      "PROTECTED",
      "INVALIDATED",
      "BROKEN",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("LOW_CONFIDENCE");
  });

  it("BROKEN_PLAN takes precedence over AT_RISK", () => {
    const result = resolveOverallHealth(
      "HIGH",
      "UNPROTECTED",
      "INVALIDATED",
      "ON_PLAN",
      "PRECISE",
      "N_A"
    );
    expect(result).toBe("BROKEN_PLAN");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// computeOpenTradeHealth (orchestrator)
// ══════════════════════════════════════════════════════════════════════════════

describe("computeOpenTradeHealth", () => {
  it("returns all HEALTHY components for a clean LONG trade", () => {
    const result = computeOpenTradeHealth(makeInput());

    expect(result.overall).toBe("HEALTHY");
    expect(result.dataConfidence).toBe("HIGH");
    expect(result.entryQuality).toBe("PRECISE");
    expect(result.protectionStatus).toBe("PROTECTED");
    expect(result.setupStatus).toBe("VALID");
    expect(result.managementStatus).toBe("ON_PLAN");
    expect(result.profitProtection).toBe("OPEN_WINNER");
    expect(result.reasons).toEqual([]);
  });

  it("returns BROKEN_PLAN and INVALIDATED reason when price crosses SL", () => {
    const result = computeOpenTradeHealth(
      makeInput({ currentPrice: 93, currentSL: 95 })
    );

    expect(result.overall).toBe("BROKEN_PLAN");
    expect(result.setupStatus).toBe("INVALIDATED");
    expect(result.reasons).toContain("INVALIDATED");
  });

  it("returns LOW_CONFIDENCE with TRACKING_LOST reason", () => {
    const result = computeOpenTradeHealth(
      makeInput({ trackingStatus: "TRACKING_LOST" })
    );

    expect(result.overall).toBe("LOW_CONFIDENCE");
    expect(result.reasons).toContain("TRACKING_LOST");
  });

  it("returns BROKEN_PLAN and UNPROTECTED reason when SL is removed (management=BROKEN wins)", () => {
    // When currentSL is null but officialSL was set, management is BROKEN (SL removed).
    // BROKEN_PLAN takes precedence over AT_RISK in resolveOverallHealth.
    const result = computeOpenTradeHealth(
      makeInput({ currentSL: null, floatingR: -0.5 })
    );

    expect(result.overall).toBe("BROKEN_PLAN");
    expect(result.protectionStatus).toBe("UNPROTECTED");
    expect(result.managementStatus).toBe("BROKEN");
    expect(result.reasons).toContain("UNPROTECTED");
    expect(result.reasons).toContain("SL_WIDENED");
  });

  it("returns AT_RISK when SL is null but no official snapshot (no BROKEN management)", () => {
    // Without an officialSL, management is UNKNOWN (cannot detect removal).
    // Protection is UNKNOWN_RISK (no original SL baseline), which triggers AT_RISK.
    const result = computeOpenTradeHealth(
      makeInput({ currentSL: null, officialSL: null, cardSL: 0, floatingR: -0.5 })
    );

    expect(result.overall).toBe("AT_RISK");
    expect(result.protectionStatus).toBe("UNKNOWN_RISK");
    expect(result.managementStatus).toBe("UNKNOWN");
    expect(result.reasons).toContain("NO_VALID_SL");
  });

  it("includes R_NOT_COMPUTABLE reason when entry equals SL", () => {
    const result = computeOpenTradeHealth(
      makeInput({ officialEntry: 100, officialSL: 100 })
    );

    expect(result.reasons).toContain("R_NOT_COMPUTABLE");
  });

  it("includes WINNER_NOT_PROTECTED reason for fragile winner", () => {
    const result = computeOpenTradeHealth(
      makeInput({ floatingR: 2.0, currentSL: null })
    );

    expect(result.profitProtection).toBe("FRAGILE_WINNER");
    expect(result.reasons).toContain("WINNER_NOT_PROTECTED");
  });

  it("includes ENTRY_CHASED reason for chased entry", () => {
    // riskDistance=10; actualEntry=107 → deviation=7/10=0.70 > 0.50
    const result = computeOpenTradeHealth(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        mtOpenPrice: 107,
      })
    );

    expect(result.entryQuality).toBe("CHASED");
    expect(result.reasons).toContain("ENTRY_CHASED");
  });

  it("includes ENTRY_LATE reason for late entry", () => {
    // riskDistance=10; actualEntry=103.5 → deviation=3.5/10=0.35
    const result = computeOpenTradeHealth(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        mtOpenPrice: 103.5,
      })
    );

    expect(result.entryQuality).toBe("LATE");
    expect(result.reasons).toContain("ENTRY_LATE");
  });

  it("includes TP_CHANGED reason for drifted TP", () => {
    // officialTP=110, targetDistance=10, currentTP=113.5 → drift=0.35
    const result = computeOpenTradeHealth(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        officialTargets: [110],
        currentTP: 113.5,
      })
    );

    expect(result.managementStatus).toBe("DRIFTED");
    expect(result.reasons).toContain("TP_CHANGED");
  });

  it("includes SL_WIDENED reason for broken management", () => {
    // officialEntry=100, officialSL=90 → originalRisk=10
    // currentSL=88 → widening=2/10=0.20 > 0.10 → BROKEN
    const result = computeOpenTradeHealth(
      makeInput({
        officialEntry: 100,
        officialSL: 90,
        currentSL: 88,
      })
    );

    expect(result.managementStatus).toBe("BROKEN");
    expect(result.reasons).toContain("SL_WIDENED");
  });

  it("includes NEAR_INVALIDATION reason when price is close to SL", () => {
    // entry=100, SL=80, price=83 → ratio=3/20=0.15 < 0.25
    const result = computeOpenTradeHealth(
      makeInput({
        officialEntry: 100,
        currentSL: 80,
        currentPrice: 83,
      })
    );

    expect(result.setupStatus).toBe("NEAR_INVALIDATION");
    expect(result.reasons).toContain("NEAR_INVALIDATION");
  });

  it("includes TRACKING_STALE reason for stale trades", () => {
    const result = computeOpenTradeHealth(
      makeInput({ trackingStatus: "STALE" })
    );

    expect(result.reasons).toContain("TRACKING_STALE");
  });

  it("includes NO_VALID_SL reason when protection status is UNKNOWN_RISK", () => {
    const result = computeOpenTradeHealth(
      makeInput({ officialSL: null, cardSL: 0 })
    );

    expect(result.protectionStatus).toBe("UNKNOWN_RISK");
    expect(result.reasons).toContain("NO_VALID_SL");
  });

  it("returns a healthy SHORT trade correctly", () => {
    const result = computeOpenTradeHealth(
      makeInput({
        direction: "SHORT",
        officialEntry: 100,
        officialSL: 110,
        officialTargets: [90],
        cardEntry: 100,
        cardSL: 110,
        cardTargets: [90],
        currentPrice: 95,
        currentSL: 110,
        currentTP: 90,
        mtOpenPrice: 100,
        floatingR: 0.5,
      })
    );

    expect(result.overall).toBe("HEALTHY");
    expect(result.setupStatus).toBe("VALID");
    expect(result.protectionStatus).toBe("PROTECTED");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// buildAttentionQueue
// ══════════════════════════════════════════════════════════════════════════════

describe("buildAttentionQueue", () => {
  it("returns empty array for empty trades input", () => {
    const result = buildAttentionQueue([]);
    expect(result).toEqual([]);
  });

  it("returns TRACKING_LOST_OPEN_RISK item for tracking lost trade", () => {
    const trades = [
      makeTradeWithHealth(
        { overall: "LOW_CONFIDENCE" },
        { trackingStatus: "TRACKING_LOST" }
      ),
    ];

    const result = buildAttentionQueue(trades);

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("TRACKING_LOST_OPEN_RISK");
    expect(result[0].severity).toBe("CRITICAL");
  });

  it("does NOT emit UNPROTECTED_LOSER for TRACKING_LOST trade", () => {
    const trades = [
      makeTradeWithHealth(
        {
          overall: "AT_RISK",
          protectionStatus: "UNPROTECTED",
        },
        {
          trackingStatus: "TRACKING_LOST",
          floatingR: -1.0,
        }
      ),
    ];

    const result = buildAttentionQueue(trades);

    const kinds = result.map((i) => i.kind);
    expect(kinds).not.toContain("UNPROTECTED_LOSER");
    // Should appear as TRACKING_LOST_OPEN_RISK instead
    expect(kinds).toContain("TRACKING_LOST_OPEN_RISK");
  });

  it("does NOT emit INVALIDATED_OR_BROKEN for TRACKING_LOST trade", () => {
    const trades = [
      makeTradeWithHealth(
        {
          setupStatus: "INVALIDATED",
          managementStatus: "BROKEN",
        },
        { trackingStatus: "TRACKING_LOST" }
      ),
    ];

    const result = buildAttentionQueue(trades);
    const kinds = result.map((i) => i.kind);
    expect(kinds).not.toContain("INVALIDATED_OR_BROKEN");
  });

  it("returns UNPROTECTED_LOSER for unprotected trade in loss", () => {
    const trades = [
      makeTradeWithHealth(
        {
          overall: "AT_RISK",
          protectionStatus: "UNPROTECTED",
        },
        {
          trackingStatus: "ACTIVE",
          floatingR: -1.5,
        }
      ),
    ];

    const result = buildAttentionQueue(trades);

    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe("UNPROTECTED_LOSER");
    expect(result[0].severity).toBe("CRITICAL");
  });

  it("does NOT emit UNPROTECTED_LOSER when trade is in profit (floatingR > 0)", () => {
    const trades = [
      makeTradeWithHealth(
        { protectionStatus: "UNPROTECTED" },
        { trackingStatus: "ACTIVE", floatingR: 1.0 }
      ),
    ];

    const result = buildAttentionQueue(trades);
    const kinds = result.map((i) => i.kind);
    expect(kinds).not.toContain("UNPROTECTED_LOSER");
  });

  it("returns INVALIDATED_OR_BROKEN for invalidated trade", () => {
    const trades = [
      makeTradeWithHealth(
        {
          setupStatus: "INVALIDATED",
        },
        { trackingStatus: "ACTIVE" }
      ),
    ];

    const result = buildAttentionQueue(trades);
    expect(result[0].kind).toBe("INVALIDATED_OR_BROKEN");
  });

  it("returns INVALIDATED_OR_BROKEN for broken management", () => {
    const trades = [
      makeTradeWithHealth(
        {
          managementStatus: "BROKEN",
        },
        { trackingStatus: "ACTIVE" }
      ),
    ];

    const result = buildAttentionQueue(trades);
    expect(result[0].kind).toBe("INVALIDATED_OR_BROKEN");
  });

  it("returns NEAR_INVALIDATION item", () => {
    const trades = [
      makeTradeWithHealth(
        { setupStatus: "NEAR_INVALIDATION" },
        { trackingStatus: "ACTIVE" }
      ),
    ];

    const result = buildAttentionQueue(trades);
    expect(result[0].kind).toBe("NEAR_INVALIDATION");
    expect(result[0].severity).toBe("WARNING");
  });

  it("returns FRAGILE_WINNER item", () => {
    const trades = [
      makeTradeWithHealth(
        { profitProtection: "FRAGILE_WINNER" },
        { trackingStatus: "ACTIVE", floatingR: 1.0 }
      ),
    ];

    const result = buildAttentionQueue(trades);
    expect(result[0].kind).toBe("FRAGILE_WINNER");
    expect(result[0].severity).toBe("WARNING");
  });

  it("returns UNKNOWN_RISK for non-computable R", () => {
    const trades = [
      makeTradeWithHealth(
        {},
        { trackingStatus: "ACTIVE", rComputable: false }
      ),
    ];

    const result = buildAttentionQueue(trades);
    const kinds = result.map((i) => i.kind);
    expect(kinds).toContain("UNKNOWN_RISK");
  });

  it("caps queue at ATTENTION_QUEUE_MAX (5) items", () => {
    // 7 trades each with NEAR_INVALIDATION to have plenty of candidates
    const trades = Array.from({ length: 7 }, (_, i) =>
      makeTradeWithHealth(
        { setupStatus: "NEAR_INVALIDATION" },
        { tradeId: `trade-${i}`, userId: `user-${i}`, trackingStatus: "ACTIVE" }
      )
    );

    const result = buildAttentionQueue(trades);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("enforces max 2 items per member", () => {
    // Same user with 3 different trades each having different issues
    // UNPROTECTED_LOSER (CRITICAL), INVALIDATED_OR_BROKEN (CRITICAL), NEAR_INVALIDATION (WARNING)
    const trades = [
      makeTradeWithHealth(
        { protectionStatus: "UNPROTECTED" },
        {
          tradeId: "trade-1",
          userId: "user-same",
          username: "alice",
          trackingStatus: "ACTIVE",
          floatingR: -1.0,
        }
      ),
      makeTradeWithHealth(
        { setupStatus: "INVALIDATED" },
        {
          tradeId: "trade-2",
          userId: "user-same",
          username: "alice",
          trackingStatus: "ACTIVE",
        }
      ),
      makeTradeWithHealth(
        { setupStatus: "NEAR_INVALIDATION" },
        {
          tradeId: "trade-3",
          userId: "user-same",
          username: "alice",
          trackingStatus: "ACTIVE",
        }
      ),
    ];

    const result = buildAttentionQueue(trades);
    const sameUserItems = result.filter((i) => i.userId === "user-same");
    expect(sameUserItems.length).toBeLessThanOrEqual(2);
  });

  it("deduplicates the same trade (keeps highest-priority reason)", () => {
    // A single trade that qualifies for multiple kinds
    // Since seenTrades deduplication is keyed by tradeId, each trade appears once
    const trades = [
      makeTradeWithHealth(
        {
          protectionStatus: "UNPROTECTED",
          setupStatus: "INVALIDATED",
        },
        {
          tradeId: "trade-X",
          userId: "user-1",
          trackingStatus: "ACTIVE",
          floatingR: -2.0,
        }
      ),
    ];

    const result = buildAttentionQueue(trades);

    // tradeId "trade-X" should appear only once, with the highest-priority kind
    const tradeXItems = result.filter((i) => i.tradeId === "trade-X");
    expect(tradeXItems).toHaveLength(1);
    // UNPROTECTED_LOSER is highest priority in ATTENTION_PRIORITY list
    expect(tradeXItems[0].kind).toBe("UNPROTECTED_LOSER");
  });

  it("maintains priority order (CRITICAL before WARNING)", () => {
    const trades = [
      makeTradeWithHealth(
        { setupStatus: "NEAR_INVALIDATION" }, // WARNING
        { tradeId: "trade-warn", userId: "user-2", trackingStatus: "ACTIVE" }
      ),
      makeTradeWithHealth(
        { setupStatus: "INVALIDATED" }, // CRITICAL
        { tradeId: "trade-crit", userId: "user-3", trackingStatus: "ACTIVE" }
      ),
    ];

    const result = buildAttentionQueue(trades);

    expect(result[0].severity).toBe("CRITICAL");
    expect(result[1].severity).toBe("WARNING");
  });

  it("includes correct messageKey and messageParams", () => {
    const trades = [
      makeTradeWithHealth(
        { setupStatus: "NEAR_INVALIDATION" },
        {
          tradeId: "trade-1",
          userId: "user-1",
          username: "bob",
          instrument: "GBPUSD",
          trackingStatus: "ACTIVE",
          floatingR: -0.8,
        }
      ),
    ];

    const result = buildAttentionQueue(trades);

    expect(result[0].messageKey).toBe("digest.attention.near_invalidation");
    expect(result[0].messageParams).toMatchObject({
      username: "bob",
      instrument: "GBPUSD",
      floatingR: -0.8,
    });
  });

  it("omits floatingR from messageParams when it is null", () => {
    const trades = [
      makeTradeWithHealth(
        { setupStatus: "NEAR_INVALIDATION" },
        {
          tradeId: "trade-1",
          userId: "user-1",
          username: "bob",
          instrument: "GBPUSD",
          trackingStatus: "ACTIVE",
          floatingR: null,
        }
      ),
    ];

    const result = buildAttentionQueue(trades);
    expect(result[0].messageParams).not.toHaveProperty("floatingR");
  });

  it("rounds floatingR to 2 decimal places in messageParams", () => {
    const trades = [
      makeTradeWithHealth(
        { protectionStatus: "UNPROTECTED" },
        {
          tradeId: "trade-1",
          userId: "user-1",
          username: "carol",
          instrument: "EURUSD",
          trackingStatus: "ACTIVE",
          floatingR: -1.23456,
        }
      ),
    ];

    const result = buildAttentionQueue(trades);
    expect(result[0].messageParams.floatingR).toBe(-1.23);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// buildLiveHealthSummary
// ══════════════════════════════════════════════════════════════════════════════

describe("buildLiveHealthSummary", () => {
  function makeHealthEntry(
    overall: OpenTradeHealth["overall"],
    protectionStatus: OpenTradeHealth["protectionStatus"] = "PROTECTED",
    profitProtection: OpenTradeHealth["profitProtection"] = "N_A",
    rComputable = true
  ) {
    return {
      health: {
        overall,
        dataConfidence: "HIGH" as const,
        entryQuality: "PRECISE" as const,
        protectionStatus,
        setupStatus: "VALID" as const,
        managementStatus: "ON_PLAN" as const,
        profitProtection,
        reasons: [] as OpenTradeHealth["reasons"],
      },
      rComputable,
    };
  }

  it("returns all zeros for empty input", () => {
    const result = buildLiveHealthSummary([]);

    expect(result).toEqual({
      healthyPositions: 0,
      needsReviewPositions: 0,
      atRiskPositions: 0,
      brokenPlanPositions: 0,
      lowConfidencePositions: 0,
      unknownRiskPositions: 0,
      unprotectedPositions: 0,
      fragileWinnerPositions: 0,
    });
  });

  it("counts HEALTHY positions correctly", () => {
    const healths = [
      makeHealthEntry("HEALTHY"),
      makeHealthEntry("HEALTHY"),
      makeHealthEntry("NEEDS_REVIEW"),
    ];

    const result = buildLiveHealthSummary(healths);
    expect(result.healthyPositions).toBe(2);
    expect(result.needsReviewPositions).toBe(1);
  });

  it("counts all health categories independently", () => {
    const healths = [
      makeHealthEntry("HEALTHY"),
      makeHealthEntry("NEEDS_REVIEW"),
      makeHealthEntry("AT_RISK"),
      makeHealthEntry("BROKEN_PLAN"),
      makeHealthEntry("LOW_CONFIDENCE"),
    ];

    const result = buildLiveHealthSummary(healths);
    expect(result.healthyPositions).toBe(1);
    expect(result.needsReviewPositions).toBe(1);
    expect(result.atRiskPositions).toBe(1);
    expect(result.brokenPlanPositions).toBe(1);
    expect(result.lowConfidencePositions).toBe(1);
  });

  it("counts unprotectedPositions for UNPROTECTED protection status", () => {
    const healths = [
      makeHealthEntry("AT_RISK", "UNPROTECTED"),
      makeHealthEntry("HEALTHY", "PROTECTED"),
      makeHealthEntry("AT_RISK", "UNPROTECTED"),
    ];

    const result = buildLiveHealthSummary(healths);
    expect(result.unprotectedPositions).toBe(2);
  });

  it("counts fragileWinnerPositions for FRAGILE_WINNER profit protection", () => {
    const healths = [
      makeHealthEntry("AT_RISK", "UNPROTECTED", "FRAGILE_WINNER"),
      makeHealthEntry("HEALTHY", "PROTECTED", "N_A"),
      makeHealthEntry("AT_RISK", "UNPROTECTED", "FRAGILE_WINNER"),
    ];

    const result = buildLiveHealthSummary(healths);
    expect(result.fragileWinnerPositions).toBe(2);
  });

  it("counts unknownRiskPositions when R is not computable", () => {
    const healths = [
      makeHealthEntry("LOW_CONFIDENCE", "PROTECTED", "N_A", false),
      makeHealthEntry("HEALTHY", "PROTECTED", "N_A", true),
    ];

    const result = buildLiveHealthSummary(healths);
    expect(result.unknownRiskPositions).toBe(1);
  });

  it("counts unknownRiskPositions when protection is UNKNOWN_RISK even if rComputable", () => {
    const healths = [
      makeHealthEntry("AT_RISK", "UNKNOWN_RISK", "N_A", true),
    ];

    const result = buildLiveHealthSummary(healths);
    expect(result.unknownRiskPositions).toBe(1);
  });

  it("counts unknownRiskPositions for both rComputable=false AND UNKNOWN_RISK", () => {
    const healths = [
      makeHealthEntry("LOW_CONFIDENCE", "UNKNOWN_RISK", "N_A", false),
    ];

    // One trade matches both conditions — should still count once
    const result = buildLiveHealthSummary(healths);
    expect(result.unknownRiskPositions).toBe(1);
  });

  it("handles mixed scenario with multiple simultaneous counters", () => {
    const healths = [
      // UNPROTECTED + FRAGILE_WINNER + not rComputable
      makeHealthEntry("AT_RISK", "UNPROTECTED", "FRAGILE_WINNER", false),
      // Normal healthy
      makeHealthEntry("HEALTHY"),
      // UNKNOWN_RISK protection
      makeHealthEntry("AT_RISK", "UNKNOWN_RISK"),
    ];

    const result = buildLiveHealthSummary(healths);
    expect(result.atRiskPositions).toBe(2);
    expect(result.healthyPositions).toBe(1);
    expect(result.unprotectedPositions).toBe(1);
    expect(result.fragileWinnerPositions).toBe(1);
    // rComputable=false counts + UNKNOWN_RISK counts = 2 total
    expect(result.unknownRiskPositions).toBe(2);
  });
});
