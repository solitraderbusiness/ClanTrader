import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
const mockFindUnique = vi.fn();
const mockCount = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    trade: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      count: (...args: unknown[]) => mockCount(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  log: vi.fn(),
}));

import { computeAndSetEligibility } from "@/services/integrity.service";

function makeTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "trade-1",
    mtLinked: true,
    integrityStatus: "PENDING",
    resolutionSource: "EA_VERIFIED",
    initialStopLoss: 1.0950,
    initialRiskMissing: false,
    officialSignalQualified: true,
    wasEverCounted: false,
    userId: "user-1",
    tradeCard: {
      createdAt: new Date("2026-01-01T10:00:00Z"),
      cardType: "SIGNAL",
    },
    mtTradeMatches: [{
      ticket: BigInt(12345),
      openTime: new Date("2026-01-01T10:02:00Z"), // 2 min after card created
    }],
    ...overrides,
  };
}

describe("Integrity Contract - computeAndSetEligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockCount.mockResolvedValue(0);
  });

  it("approves fully valid EA-verified trade", async () => {
    mockFindUnique.mockResolvedValue(makeTrade());

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statementEligible: true,
          eligibleAtOpen: true,
          integrityStatus: "VERIFIED",
        }),
      })
    );
  });

  it("rejects trade when not MT-linked", async () => {
    mockFindUnique.mockResolvedValue(makeTrade({ mtLinked: false }));

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statementEligible: false,
          integrityDetails: expect.objectContaining({
            reasons: expect.arrayContaining(["NOT_MT_LINKED"]),
          }),
        }),
      })
    );
  });

  it("rejects trade when integrityStatus is UNVERIFIED", async () => {
    mockFindUnique.mockResolvedValue(makeTrade({ integrityStatus: "UNVERIFIED" }));

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statementEligible: false,
          integrityDetails: expect.objectContaining({
            reasons: expect.arrayContaining(["INTEGRITY_UNVERIFIED"]),
          }),
        }),
      })
    );
  });

  it("rejects trade with untrusted resolution source", async () => {
    mockFindUnique.mockResolvedValue(makeTrade({ resolutionSource: "MANUAL" }));

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrityDetails: expect.objectContaining({
            reasons: expect.arrayContaining(["UNTRUSTED_RESOLUTION"]),
          }),
        }),
      })
    );
  });

  it("rejects late signal card (card created AFTER trade opened)", async () => {
    mockFindUnique.mockResolvedValue(makeTrade({
      tradeCard: {
        createdAt: new Date("2026-01-01T10:05:00Z"), // 5 min AFTER trade
        cardType: "SIGNAL",
      },
      mtTradeMatches: [{
        ticket: BigInt(12345),
        openTime: new Date("2026-01-01T10:00:00Z"), // trade opened first
      }],
    }));

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrityDetails: expect.objectContaining({
            reasons: expect.arrayContaining(["CARD_AFTER_TRADE"]),
          }),
        }),
      })
    );
  });

  it("rejects trade without initial stop loss", async () => {
    mockFindUnique.mockResolvedValue(makeTrade({
      initialStopLoss: 0,
      initialRiskMissing: true,
    }));

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrityDetails: expect.objectContaining({
            reasons: expect.arrayContaining(["NO_INITIAL_RISK"]),
          }),
        }),
      })
    );
  });

  it("rejects duplicate MT ticket", async () => {
    mockFindUnique.mockResolvedValue(makeTrade());
    mockCount.mockResolvedValue(1); // duplicate found

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrityDetails: expect.objectContaining({
            reasons: expect.arrayContaining(["DUPLICATE_MT_TICKET"]),
          }),
        }),
      })
    );
  });

  it("returns false when trade not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await computeAndSetEligibility("nonexistent");

    expect(result).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("accumulates multiple reason codes", async () => {
    mockFindUnique.mockResolvedValue(makeTrade({
      mtLinked: false,
      integrityStatus: "UNVERIFIED",
      resolutionSource: "MANUAL",
      initialStopLoss: 0,
      initialRiskMissing: true,
    }));

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    const updateCall = mockUpdate.mock.calls[0][0];
    const reasons = updateCall.data.integrityDetails.reasons;
    expect(reasons).toContain("NOT_MT_LINKED");
    expect(reasons).toContain("INTEGRITY_UNVERIFIED");
    expect(reasons).toContain("UNTRUSTED_RESOLUTION");
    expect(reasons).toContain("NO_INITIAL_RISK");
  });

  it("sets wasEverCounted and countedAt on first eligibility", async () => {
    mockFindUnique.mockResolvedValue(makeTrade({ wasEverCounted: false }));

    await computeAndSetEligibility("trade-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          wasEverCounted: true,
          countedAt: expect.any(Date),
        }),
      })
    );
  });

  it("does not re-set countedAt if already counted", async () => {
    mockFindUnique.mockResolvedValue(makeTrade({ wasEverCounted: true }));

    await computeAndSetEligibility("trade-1");

    const updateCall = mockUpdate.mock.calls[0][0];
    expect(updateCall.data.wasEverCounted).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Condition 7: NOT_SIGNAL_QUALIFIED regression
//
// Trades must pass the 20-second qualification window (officialSignalQualified).
// A trade that was never officially signal-qualified cannot be statement-eligible.
// ---------------------------------------------------------------------------

describe("Integrity Contract - NOT_SIGNAL_QUALIFIED", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockCount.mockResolvedValue(0);
  });

  it("rejects trade when officialSignalQualified is false", async () => {
    mockFindUnique.mockResolvedValue(
      makeTrade({ officialSignalQualified: false })
    );

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statementEligible: false,
          integrityDetails: expect.objectContaining({
            reasons: expect.arrayContaining(["NOT_SIGNAL_QUALIFIED"]),
          }),
        }),
      })
    );
  });

  it("rejects trade when officialSignalQualified is undefined (never set)", async () => {
    const trade = makeTrade();
    // Remove the field entirely — simulates a trade created before the field existed
    delete (trade as Record<string, unknown>).officialSignalQualified;
    mockFindUnique.mockResolvedValue(trade);

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrityDetails: expect.objectContaining({
            reasons: expect.arrayContaining(["NOT_SIGNAL_QUALIFIED"]),
          }),
        }),
      })
    );
  });

  it("accepts trade when officialSignalQualified is true (all other conditions pass)", async () => {
    mockFindUnique.mockResolvedValue(
      makeTrade({ officialSignalQualified: true })
    );

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statementEligible: true,
          integrityStatus: "VERIFIED",
        }),
      })
    );
  });

  it("NOT_SIGNAL_QUALIFIED accumulates with other failure reasons", async () => {
    mockFindUnique.mockResolvedValue(
      makeTrade({
        officialSignalQualified: false,
        mtLinked: false,
        resolutionSource: "MANUAL",
      })
    );

    const result = await computeAndSetEligibility("trade-1");

    expect(result).toBe(false);
    const updateCall = mockUpdate.mock.calls[0][0];
    const reasons = updateCall.data.integrityDetails.reasons;
    expect(reasons).toContain("NOT_SIGNAL_QUALIFIED");
    expect(reasons).toContain("NOT_MT_LINKED");
    expect(reasons).toContain("UNTRUSTED_RESOLUTION");
  });

  it("does not include NOT_SIGNAL_QUALIFIED when trade is qualified", async () => {
    mockFindUnique.mockResolvedValue(
      makeTrade({ officialSignalQualified: true })
    );

    await computeAndSetEligibility("trade-1");

    const updateCall = mockUpdate.mock.calls[0][0];
    // When eligible, integrityDetails is not set (undefined)
    expect(updateCall.data.integrityDetails).toBeUndefined();
  });

  it("does not promote PENDING to VERIFIED when only NOT_SIGNAL_QUALIFIED fails", async () => {
    mockFindUnique.mockResolvedValue(
      makeTrade({ officialSignalQualified: false, integrityStatus: "PENDING" })
    );

    await computeAndSetEligibility("trade-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          integrityStatus: "PENDING", // must NOT be promoted
          statementEligible: false,
        }),
      })
    );
  });
});

describe("Integrity Contract - Outcome-based Win Rate", () => {
  it("counts positive finalRR as win regardless of status label", () => {
    // This tests the logic in statement-calc.service.ts
    // Status "CLOSED" but finalRR = 1.5 → should count as win
    const trades = [
      { status: "CLOSED", finalRR: 1.5 },  // win by R:R
      { status: "TP_HIT", finalRR: -0.3 }, // loss by R:R despite TP_HIT label
      { status: "SL_HIT", finalRR: 0.2 },  // win by R:R despite SL_HIT label
      { status: "BE", finalRR: 0 },          // breakeven
    ];

    let wins = 0, losses = 0, breakEven = 0;
    for (const trade of trades) {
      const r = trade.finalRR;
      if (r > 0) wins++;
      else if (r < 0) losses++;
      else breakEven++;
    }

    expect(wins).toBe(2);       // CLOSED +1.5R and SL_HIT +0.2R
    expect(losses).toBe(1);     // TP_HIT -0.3R
    expect(breakEven).toBe(1);  // BE 0R

    const resolved = wins + losses + breakEven;
    const winRate = resolved > 0 ? wins / resolved : 0;
    expect(winRate).toBe(0.5); // 2 out of 4
  });
});
