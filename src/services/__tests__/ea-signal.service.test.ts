import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

vi.mock("@/lib/db", () => ({
  db: {
    clanMember: { findFirst: vi.fn() },
    message: { create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    trade: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    tradeCard: { update: vi.fn() },
    tradeCardVersion: { create: vi.fn() },
    tradeEvent: { create: vi.fn() },
    tradeStatusHistory: { create: vi.fn() },
    mtTrade: { update: vi.fn() },
    mtAccount: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: { set: vi.fn(), get: vi.fn() },
}));

vi.mock("@/lib/audit", () => ({ log: vi.fn() }));

vi.mock("@/lib/socket-io-global", () => ({
  getIO: vi.fn(() => null),
}));

vi.mock("@/services/topic.service", () => ({
  getDefaultTopic: vi.fn(() => Promise.resolve({ id: "topic-1" })),
}));

vi.mock("@/services/trade-card.service", () => ({
  createTradeCardMessage: vi.fn(),
}));

vi.mock("@/services/auto-post.service", () => ({
  maybeAutoPost: vi.fn(() => Promise.resolve()),
  updateChannelPostRiskWarning: vi.fn(() => Promise.resolve()),
  updateChannelPostTargets: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/badge-engine.service", () => ({
  evaluateUserBadges: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/mt-statement.service", () => ({
  generateStatementFromMtAccount: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/statement-calc.service", () => ({
  calculateStatement: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/services/integrity.service", () => ({
  computeAndSetEligibility: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/services/signal-qualification.service", () => ({
  computeQualificationDeadline: vi.fn((d: Date) => new Date(d.getTime() + 20_000)),
  qualifyTrade: vi.fn(() => Promise.resolve(true)),
  reQualifyTrade: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/services/signal-matcher.service", () => ({
  normalizeInstrument: vi.fn((s: string) => s.toUpperCase()),
  mapDirection: vi.fn((d: string) => (d === "BUY" ? "LONG" : "SHORT")),
  pipDistance: vi.fn(() => 0),
}));

vi.mock("@/lib/risk-utils", () => ({
  deriveRiskStatus: vi.fn(() => "PROTECTED"),
}));

// --- Imports (must come after vi.mock calls) ---

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { createTradeCardMessage } from "@/services/trade-card.service";
import { computeAndSetEligibility } from "@/services/integrity.service";
import { qualifyTrade, reQualifyTrade } from "@/services/signal-qualification.service";
import { pipDistance } from "@/services/signal-matcher.service";
import { deriveRiskStatus } from "@/lib/risk-utils";
import { calculateStatement } from "@/services/statement-calc.service";
import {
  autoCreateSignalFromMtTrade,
  syncSignalModification,
  syncSignalClose,
} from "@/services/ea-signal.service";

// --- Helpers ---

function makeMtTrade(overrides: Record<string, unknown> = {}) {
  return {
    id: "mt-1",
    mtAccountId: "acc-1",
    ticket: BigInt(12345),
    symbol: "EURUSD",
    direction: "BUY" as const,
    openPrice: 1.1,
    closePrice: 1.11,
    openTime: new Date("2026-01-01T10:00:00Z"),
    closeTime: new Date("2026-01-01T12:00:00Z"),
    stopLoss: 1.095,
    takeProfit: 1.11,
    lots: 0.1,
    profit: 100,
    commission: -2,
    swap: -1,
    isOpen: false,
    matchedTradeId: null,
    ...overrides,
  };
}

function makeTradeWithCard(overrides: Record<string, unknown> = {}) {
  return {
    id: "trade-1",
    userId: "user-1",
    clanId: "clan-1",
    status: "OPEN",
    closedAt: null,
    closePrice: null,
    initialEntry: 1.1,
    initialStopLoss: 1.095,
    initialRiskAbs: 0.005,
    initialRiskMissing: false,
    officialEntryPrice: 1.1,
    officialInitialStopLoss: 1.095,
    officialInitialRiskAbs: 0.005,
    officialInitialRiskMoney: null,
    riskStatus: "PROTECTED",
    officialSignalQualified: false,
    qualificationDeadline: new Date(Date.now() + 20_000),
    openedAt: new Date(),
    tradeCard: {
      id: "card-1",
      instrument: "EURUSD",
      direction: "LONG",
      entry: 1.1,
      stopLoss: 1.095,
      targets: [1.11],
      tags: ["signal"],
      cardType: "SIGNAL",
      timeframe: "AUTO",
      riskPct: null,
      note: "Auto-generated from MetaTrader",
      message: { id: "msg-1", topicId: "topic-1", clanId: "clan-1" },
    },
    ...overrides,
  };
}

// Typed mock references for convenience
const mockRedisSet = vi.mocked(redis.set);
const mockClanMemberFindFirst = vi.mocked(db.clanMember.findFirst);
const mockTradeCreate = vi.mocked(db.trade.create);
const mockTradeFindUnique = vi.mocked(db.trade.findUnique);
const mockTradeUpdate = vi.mocked(db.trade.update);
const mockMtTradeUpdate = vi.mocked(db.mtTrade.update);
const mockTradeCardUpdate = vi.mocked(db.tradeCard.update);
const mockTradeCardVersionCreate = vi.mocked(db.tradeCardVersion.create);
const mockTradeEventCreate = vi.mocked(db.tradeEvent.create);
const mockTradeStatusHistoryCreate = vi.mocked(db.tradeStatusHistory.create);
const mockMessageCreate = vi.mocked(db.message.create);
const mockMessageFindUnique = vi.mocked(db.message.findUnique);
const mockMessageFindFirst = vi.mocked(db.message.findFirst);
const mockMessageUpdate = vi.mocked(db.message.update);
const mockReQualifyTrade = vi.mocked(reQualifyTrade);
const mockMtAccountFindFirst = vi.mocked(db.mtAccount.findFirst);
const mockCreateTradeCardMessage = vi.mocked(createTradeCardMessage);
const mockComputeAndSetEligibility = vi.mocked(computeAndSetEligibility);
const mockPipDistance = vi.mocked(pipDistance);
const mockDeriveRiskStatus = vi.mocked(deriveRiskStatus);
const mockCalculateStatement = vi.mocked(calculateStatement);

// ============================================================
// autoCreateSignalFromMtTrade
// ============================================================

describe("autoCreateSignalFromMtTrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early if mtTrade.matchedTradeId is set (dedup)", async () => {
    const mtTrade = makeMtTrade({ matchedTradeId: "existing-trade" });

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    expect(mockRedisSet).not.toHaveBeenCalled();
    expect(mockClanMemberFindFirst).not.toHaveBeenCalled();
  });

  it("returns early if Redis lock not acquired (race prevention)", async () => {
    const mtTrade = makeMtTrade();
    mockRedisSet.mockResolvedValue(null as never);

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    expect(mockRedisSet).toHaveBeenCalledWith(
      `ea-signal-lock:acc-1:${BigInt(12345)}`,
      "1",
      "EX",
      60,
      "NX"
    );
    expect(mockClanMemberFindFirst).not.toHaveBeenCalled();
  });

  it("returns early if user has no clan membership", async () => {
    const mtTrade = makeMtTrade();
    mockRedisSet.mockResolvedValue("OK" as never);
    mockClanMemberFindFirst.mockResolvedValue(null as never);

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    expect(mockClanMemberFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      })
    );
    expect(mockCreateTradeCardMessage).not.toHaveBeenCalled();
  });

  it("creates signal card with SL+TP: cardType=SIGNAL, tags=['signal']", async () => {
    const mtTrade = makeMtTrade({ stopLoss: 1.095, takeProfit: 1.11 });
    mockRedisSet.mockResolvedValue("OK" as never);
    mockClanMemberFindFirst.mockResolvedValue({ clanId: "clan-1" } as never);
    mockCreateTradeCardMessage.mockResolvedValue({
      id: "msg-1",
      tradeCard: { id: "card-1" },
    } as never);
    mockTradeCreate.mockResolvedValue({
      id: "trade-1",
      userId: "user-1",
      status: "OPEN",
    } as never);
    mockMtTradeUpdate.mockResolvedValue({} as never);
    mockComputeAndSetEligibility.mockResolvedValue(true);

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    expect(mockCreateTradeCardMessage).toHaveBeenCalledWith(
      "clan-1",
      "topic-1",
      "user-1",
      expect.objectContaining({
        cardType: "SIGNAL",
        tags: ["signal"],
        stopLoss: 1.095,
        targets: [1.11],
      })
    );
  });

  it("creates analysis card without SL: cardType=ANALYSIS, tags=['analysis']", async () => {
    const mtTrade = makeMtTrade({ stopLoss: 0, takeProfit: 1.11 });
    mockRedisSet.mockResolvedValue("OK" as never);
    mockClanMemberFindFirst.mockResolvedValue({ clanId: "clan-1" } as never);
    mockCreateTradeCardMessage.mockResolvedValue({
      id: "msg-1",
      tradeCard: { id: "card-1" },
    } as never);
    mockTradeCreate.mockResolvedValue({
      id: "trade-1",
      userId: "user-1",
      status: "OPEN",
    } as never);
    mockMtTradeUpdate.mockResolvedValue({} as never);
    mockComputeAndSetEligibility.mockResolvedValue(true);

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    expect(mockCreateTradeCardMessage).toHaveBeenCalledWith(
      "clan-1",
      "topic-1",
      "user-1",
      expect.objectContaining({
        cardType: "ANALYSIS",
        tags: ["analysis"],
      })
    );
  });

  it("creates analysis card without TP: cardType=ANALYSIS", async () => {
    const mtTrade = makeMtTrade({ stopLoss: 1.095, takeProfit: 0 });
    mockRedisSet.mockResolvedValue("OK" as never);
    mockClanMemberFindFirst.mockResolvedValue({ clanId: "clan-1" } as never);
    mockCreateTradeCardMessage.mockResolvedValue({
      id: "msg-1",
      tradeCard: { id: "card-1" },
    } as never);
    mockTradeCreate.mockResolvedValue({
      id: "trade-1",
      userId: "user-1",
      status: "OPEN",
    } as never);
    mockMtTradeUpdate.mockResolvedValue({} as never);
    mockComputeAndSetEligibility.mockResolvedValue(true);

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    expect(mockCreateTradeCardMessage).toHaveBeenCalledWith(
      "clan-1",
      "topic-1",
      "user-1",
      expect.objectContaining({
        cardType: "ANALYSIS",
        tags: ["analysis"],
      })
    );
  });

  it("computes initial risk correctly as |openPrice - SL|", async () => {
    const mtTrade = makeMtTrade({ openPrice: 1.1, stopLoss: 1.095 });
    mockRedisSet.mockResolvedValue("OK" as never);
    mockClanMemberFindFirst.mockResolvedValue({ clanId: "clan-1" } as never);
    mockCreateTradeCardMessage.mockResolvedValue({
      id: "msg-1",
      tradeCard: { id: "card-1" },
    } as never);
    mockTradeCreate.mockResolvedValue({
      id: "trade-1",
      userId: "user-1",
      status: "OPEN",
    } as never);
    mockMtTradeUpdate.mockResolvedValue({} as never);

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    expect(mockTradeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          initialRiskAbs: Math.abs(1.1 - 1.095),
          initialStopLoss: 1.095,
          initialEntry: 1.1,
        }),
      })
    );
  });

  it("sets initialRiskMissing=true when SL=0", async () => {
    const mtTrade = makeMtTrade({ stopLoss: 0 });
    mockRedisSet.mockResolvedValue("OK" as never);
    mockClanMemberFindFirst.mockResolvedValue({ clanId: "clan-1" } as never);
    mockCreateTradeCardMessage.mockResolvedValue({
      id: "msg-1",
      tradeCard: { id: "card-1" },
    } as never);
    mockTradeCreate.mockResolvedValue({
      id: "trade-1",
      userId: "user-1",
      status: "OPEN",
    } as never);
    mockMtTradeUpdate.mockResolvedValue({} as never);

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    expect(mockTradeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          initialRiskMissing: true,
          initialRiskAbs: 0,
        }),
      })
    );
  });

  it("calls qualifyTrade (AT_OPEN) when SL+TP present at creation", async () => {
    const mtTrade = makeMtTrade();
    mockRedisSet.mockResolvedValue("OK" as never);
    mockClanMemberFindFirst.mockResolvedValue({ clanId: "clan-1" } as never);
    mockCreateTradeCardMessage.mockResolvedValue({
      id: "msg-1",
      tradeCard: { id: "card-1" },
    } as never);
    mockTradeCreate.mockResolvedValue({
      id: "trade-1",
      userId: "user-1",
      status: "OPEN",
    } as never);
    mockMtTradeUpdate.mockResolvedValue({} as never);

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    // With SL+TP present, qualifyTrade is called (not computeAndSetEligibility directly)
    expect(qualifyTrade).toHaveBeenCalledWith(
      "trade-1", 1.095, 1.11, 1.1, "AT_OPEN",
      expect.objectContaining({ lots: 0.1, direction: "BUY" })
    );
  });

  it("links MtTrade to Trade via mtTrade.update with matchedTradeId", async () => {
    const mtTrade = makeMtTrade();
    mockRedisSet.mockResolvedValue("OK" as never);
    mockClanMemberFindFirst.mockResolvedValue({ clanId: "clan-1" } as never);
    mockCreateTradeCardMessage.mockResolvedValue({
      id: "msg-1",
      tradeCard: { id: "card-1" },
    } as never);
    mockTradeCreate.mockResolvedValue({
      id: "trade-1",
      userId: "user-1",
      status: "OPEN",
    } as never);
    mockMtTradeUpdate.mockResolvedValue({} as never);

    await autoCreateSignalFromMtTrade(mtTrade as never, "user-1");

    expect(mockMtTradeUpdate).toHaveBeenCalledWith({
      where: { id: "mt-1" },
      data: { matchedTradeId: "trade-1" },
    });
  });
});

// ============================================================
// syncSignalModification
// ============================================================

describe("syncSignalModification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early if no matchedTradeId", async () => {
    const mtTrade = makeMtTrade({ matchedTradeId: null });

    await syncSignalModification(mtTrade as never, "user-1");

    expect(mockRedisSet).not.toHaveBeenCalled();
  });

  it("returns early if Redis lock not acquired", async () => {
    const mtTrade = makeMtTrade({ matchedTradeId: "trade-1" });
    mockRedisSet.mockResolvedValue(null as never);

    await syncSignalModification(mtTrade as never, "user-1");

    expect(mockRedisSet).toHaveBeenCalled();
    expect(mockTradeFindUnique).not.toHaveBeenCalled();
  });

  it("returns early if no SL/TP change (same values)", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      stopLoss: 1.095,
      takeProfit: 1.11,
    });
    mockRedisSet.mockResolvedValue("OK" as never);
    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);

    await syncSignalModification(mtTrade as never, "user-1");

    // No version created, no update
    expect(mockTradeCardVersionCreate).not.toHaveBeenCalled();
    expect(mockTradeUpdate).not.toHaveBeenCalled();
  });

  it("BUG REGRESSION: ANALYSIS->SIGNAL upgrade captures initial risk", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      stopLoss: 1.095,
      takeProfit: 1.11,
    });

    // Trade starts as ANALYSIS with missing risk
    const trade = makeTradeWithCard({
      initialRiskMissing: true,
      initialStopLoss: 0,
      initialRiskAbs: 0,
      tradeCard: {
        id: "card-1",
        instrument: "EURUSD",
        direction: "LONG",
        entry: 1.1,
        stopLoss: 0,
        targets: [0],
        tags: ["analysis"],
        cardType: "ANALYSIS",
        timeframe: "AUTO",
        riskPct: null,
        note: "Auto-generated",
        message: { id: "msg-1", topicId: "topic-1", clanId: "clan-1" },
      },
    });

    mockRedisSet.mockResolvedValue("OK" as never);
    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockTradeCardVersionCreate.mockResolvedValue({} as never);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeCardUpdate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({ id: "sys-1" } as never);
    mockMessageFindUnique.mockResolvedValue(null as never);

    await syncSignalModification(mtTrade as never, "user-1");

    // qualifyTrade should be called (within-window qualification)
    // Then ANALYSIS->SIGNAL upgrade should capture initial risk
    const allUpdateCalls = mockTradeUpdate.mock.calls.map((c) => c[0]);
    const upgradeCall = allUpdateCalls.find(
      (c) => (c as Record<string, unknown>).data && (((c as Record<string, unknown>).data) as Record<string, unknown>).cardType === "SIGNAL"
    );
    expect(upgradeCall).toBeTruthy();
    expect(upgradeCall).toEqual(
      expect.objectContaining({
        where: { id: "trade-1" },
        data: expect.objectContaining({
          cardType: "SIGNAL",
          initialStopLoss: 1.095,
          initialRiskAbs: Math.abs(1.1 - 1.095),
          initialRiskMissing: false,
        }),
      })
    );

    // Trade card should be updated to SIGNAL with signal tags
    expect(mockTradeCardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardType: "SIGNAL",
          tags: ["signal"],
          stopLoss: 1.095,
          targets: [1.11],
        }),
      })
    );
  });

  it("BUG REGRESSION: re-evaluates eligibility after initial risk captured on modification", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      stopLoss: 84.238,
      takeProfit: 102.517,
    });

    // Trade was created as ANALYSIS with no SL → initialRiskMissing = true
    const trade = makeTradeWithCard({
      initialRiskMissing: true,
      initialStopLoss: 0,
      initialRiskAbs: 0,
      tradeCard: {
        id: "card-1",
        instrument: "XAGUSD",
        direction: "LONG",
        entry: 89.868,
        stopLoss: 0,
        targets: [0],
        tags: ["analysis"],
        cardType: "ANALYSIS",
        timeframe: "AUTO",
        riskPct: null,
        note: "Auto-generated",
        message: { id: "msg-1", topicId: "topic-1", clanId: "clan-1" },
      },
    });

    mockRedisSet.mockResolvedValue("OK" as never);
    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockTradeCardVersionCreate.mockResolvedValue({} as never);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeCardUpdate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({ id: "sys-1" } as never);
    mockMessageFindUnique.mockResolvedValue(null as never);

    await syncSignalModification(mtTrade as never, "user-1");

    // computeAndSetEligibility MUST be called after initial risk is captured
    expect(computeAndSetEligibility).toHaveBeenCalledWith("trade-1");
  });

  it("normal SL change updates trade.riskStatus and tradeCard.stopLoss", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      stopLoss: 1.096,
      takeProfit: 1.11,
    });

    mockRedisSet.mockResolvedValue("OK" as never);
    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    mockTradeCardVersionCreate.mockResolvedValue({} as never);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeCardUpdate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({ id: "sys-1" } as never);
    mockMessageFindUnique.mockResolvedValue(null as never);
    mockDeriveRiskStatus.mockReturnValue("PROTECTED" as never);

    await syncSignalModification(mtTrade as never, "user-1");

    // trade.update should set riskStatus and slEverModified
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trade-1" },
        data: expect.objectContaining({
          riskStatus: "PROTECTED",
          slEverModified: true,
        }),
      })
    );

    // tradeCard should be updated with new SL
    expect(mockTradeCardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "card-1" },
        data: expect.objectContaining({
          stopLoss: 1.096,
        }),
      })
    );
  });

  it("SL removal sets riskStatus=UNPROTECTED and creates CRITICAL event", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      stopLoss: 0,
      takeProfit: 1.11,
    });

    mockRedisSet.mockResolvedValue("OK" as never);
    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    mockTradeCardVersionCreate.mockResolvedValue({} as never);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeCardUpdate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({ id: "sys-1" } as never);
    mockMessageFindUnique.mockResolvedValue(null as never);

    await syncSignalModification(mtTrade as never, "user-1");

    // Should set riskStatus to UNPROTECTED
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trade-1" },
        data: { riskStatus: "UNPROTECTED" },
      })
    );

    // Should create CRITICAL trade event for SL_REMOVED
    expect(mockTradeEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tradeId: "trade-1",
          actionType: "SL_REMOVED",
          severity: "CRITICAL",
          source: "EA",
        }),
      })
    );

    // Should set tradeCard stopLoss to 0
    expect(mockTradeCardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "card-1" },
        data: { stopLoss: 0 },
      })
    );
  });

  it("TP removal updates targets to [0]", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      stopLoss: 1.095,
      takeProfit: 0,
    });

    mockRedisSet.mockResolvedValue("OK" as never);
    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    mockTradeCardVersionCreate.mockResolvedValue({} as never);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeCardUpdate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({ id: "sys-1" } as never);
    mockMessageFindUnique.mockResolvedValue(null as never);

    await syncSignalModification(mtTrade as never, "user-1");

    // Should create TP_REMOVED event with INFO severity
    expect(mockTradeEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tradeId: "trade-1",
          actionType: "TP_REMOVED",
          severity: "INFO",
        }),
      })
    );

    // Should update targets to [0]
    expect(mockTradeCardUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "card-1" },
        data: { targets: [0] },
      })
    );
  });

  it("BUG REGRESSION: captures initial risk on any SL change when not yet recorded", async () => {
    // Trade was opened without SL, so initialRiskMissing=true.
    // Now user sets SL to 1.095 but TP stays at 1.11 (already existed).
    // This should capture initialStopLoss even without a cardType upgrade.
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      stopLoss: 1.095,
      takeProfit: 1.11,
    });

    const trade = makeTradeWithCard({
      initialRiskMissing: true,
      initialStopLoss: 0,
      initialRiskAbs: 0,
      tradeCard: {
        id: "card-1",
        instrument: "EURUSD",
        direction: "LONG",
        entry: 1.1,
        stopLoss: 0,         // no SL before
        targets: [1.11],     // TP was already present
        tags: ["signal"],
        cardType: "SIGNAL",  // already SIGNAL (no upgrade needed)
        timeframe: "AUTO",
        riskPct: null,
        note: "Test",
        message: { id: "msg-1", topicId: "topic-1", clanId: "clan-1" },
      },
    });

    mockRedisSet.mockResolvedValue("OK" as never);
    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockTradeCardVersionCreate.mockResolvedValue({} as never);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeCardUpdate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({ id: "sys-1" } as never);
    mockMessageFindUnique.mockResolvedValue(null as never);
    mockDeriveRiskStatus.mockReturnValue("PROTECTED" as never);

    await syncSignalModification(mtTrade as never, "user-1");

    // The normal SL/TP change branch should capture initial risk
    // because captureInitialRisk = newSL > 0 && trade.initialRiskMissing
    const updateCalls = mockTradeUpdate.mock.calls;
    // Find the update call that sets initialStopLoss
    const riskCaptureCall = updateCalls.find(
      (call) => (call[0] as { data: Record<string, unknown> }).data.initialStopLoss !== undefined
    );
    expect(riskCaptureCall).toBeDefined();
    const data = (riskCaptureCall![0] as { data: Record<string, unknown> }).data;
    expect(data.initialStopLoss).toBe(1.095);
    expect(data.initialRiskAbs).toBeCloseTo(Math.abs(1.1 - 1.095));
    expect(data.initialRiskMissing).toBe(false);
  });
});

// ============================================================
// syncSignalClose
// ============================================================

describe("syncSignalClose", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early if no matchedTradeId", async () => {
    const mtTrade = makeMtTrade({ matchedTradeId: null });

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockTradeFindUnique).not.toHaveBeenCalled();
  });

  it("BUG REGRESSION: already closed trade gets corrected with better close price", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.112,  // different from the original 1.11
      profit: 120,
      commission: -2,
      swap: -1,
    });

    const trade = makeTradeWithCard({
      closedAt: new Date("2026-01-01T12:00:00Z"),
      closePrice: 1.11,
      status: "TP_HIT",
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockPipDistance.mockReturnValue(0);

    await syncSignalClose(mtTrade as never, "user-1");

    // Should update with corrected close price and R:R
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trade-1" },
        data: expect.objectContaining({
          closePrice: 1.112,
        }),
      })
    );

    // Should re-evaluate eligibility
    expect(mockComputeAndSetEligibility).toHaveBeenCalledWith("trade-1");

    // Should recalculate statements
    expect(mockCalculateStatement).toHaveBeenCalledWith(
      "user-1",
      "clan-1",
      "MONTHLY",
      expect.any(String)
    );
    expect(mockCalculateStatement).toHaveBeenCalledWith(
      "user-1",
      "clan-1",
      "ALL_TIME",
      "all-time"
    );
  });

  it("already closed with same close price returns early (no double-processing)", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.11,
    });

    const trade = makeTradeWithCard({
      closedAt: new Date("2026-01-01T12:00:00Z"),
      closePrice: 1.11,
      status: "TP_HIT",
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);

    await syncSignalClose(mtTrade as never, "user-1");

    // Should NOT update anything
    expect(mockTradeUpdate).not.toHaveBeenCalled();
    expect(mockComputeAndSetEligibility).not.toHaveBeenCalled();
  });

  it("normal close: computes outcome correctly for TP_HIT (within 5 pips of TP)", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.11,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    // pipDistance returns 0 for first call (close vs TP) — within tolerance
    mockPipDistance.mockReturnValueOnce(0);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "TP_HIT",
        }),
      })
    );
  });

  it("normal close: computes SL_HIT (within 5 pips of SL)", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.095,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    // First call: pipDistance(instrument, closePrice, tp) — NOT within tolerance
    mockPipDistance.mockReturnValueOnce(150);
    // Second call: pipDistance(instrument, closePrice, sl) — within tolerance
    mockPipDistance.mockReturnValueOnce(0);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SL_HIT",
        }),
      })
    );
  });

  it("normal close: computes BE (within 5 pips of entry)", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.1,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    // TP check: not within tolerance
    mockPipDistance.mockReturnValueOnce(100);
    // SL check: not within tolerance
    mockPipDistance.mockReturnValueOnce(50);
    // Entry check: within tolerance
    mockPipDistance.mockReturnValueOnce(0);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "BE",
        }),
      })
    );
  });

  it("normal close: computes CLOSED (not near any level)", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.105,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    // All pipDistance calls return > CLOSE_TOLERANCE_PIPS (5)
    mockPipDistance.mockReturnValue(50);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CLOSED",
        }),
      })
    );
  });

  it("computes finalRR correctly for LONG trade: dir * (closePrice - entry) / riskAbs", async () => {
    // LONG: entry=1.1, SL=1.095, risk=0.005
    // closePrice=1.115 -> RR = 1 * (1.115 - 1.1) / 0.005 = 3.0
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.115,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    mockPipDistance.mockReturnValue(50); // CLOSED outcome
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    const updateCall = mockTradeUpdate.mock.calls[0][0] as {
      data: { finalRR: number };
    };
    // dir=1 (LONG), (1.115 - 1.1) / 0.005 = 3.0
    expect(updateCall.data.finalRR).toBe(3);
  });

  it("computes finalRR correctly for SHORT trade", async () => {
    // SHORT: entry=1.1, SL=1.105, risk=0.005
    // closePrice=1.085 -> RR = -1 * (1.085 - 1.1) / 0.005 = -1 * (-0.015) / 0.005 = 3.0
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      direction: "SELL",
      closePrice: 1.085,
    });

    const trade = makeTradeWithCard({
      initialEntry: 1.1,
      initialStopLoss: 1.105,
      initialRiskAbs: 0.005,
      tradeCard: {
        id: "card-1",
        instrument: "EURUSD",
        direction: "SHORT",
        entry: 1.1,
        stopLoss: 1.105,
        targets: [1.085],
        tags: ["signal"],
        cardType: "SIGNAL",
        timeframe: "AUTO",
        riskPct: null,
        note: "Test",
        message: { id: "msg-1", topicId: "topic-1", clanId: "clan-1" },
      },
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockPipDistance.mockReturnValue(50); // CLOSED outcome
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    const updateCall = mockTradeUpdate.mock.calls[0][0] as {
      data: { finalRR: number };
    };
    // dir=-1 (SHORT), -1 * (1.085 - 1.1) / 0.005 = -1 * -0.015 / 0.005 = 3.0
    expect(updateCall.data.finalRR).toBe(3);
  });

  it("computes netProfit: profit + commission + swap", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      profit: 100,
      commission: -2,
      swap: -1,
      closePrice: 1.115,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    mockPipDistance.mockReturnValue(50);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    const updateCall = mockTradeUpdate.mock.calls[0][0] as {
      data: { netProfit: number };
    };
    // netProfit = 100 + (-2) + (-1) = 97, rounded: 97
    expect(updateCall.data.netProfit).toBe(97);
  });

  it("calls computeAndSetEligibility after close", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.115,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    mockPipDistance.mockReturnValue(50);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockComputeAndSetEligibility).toHaveBeenCalledWith("trade-1");
  });

  it("calls calculateStatement for MONTHLY and ALL_TIME", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.115,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    mockPipDistance.mockReturnValue(50);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockCalculateStatement).toHaveBeenCalledWith(
      "user-1",
      "clan-1",
      "MONTHLY",
      expect.any(String)
    );
    expect(mockCalculateStatement).toHaveBeenCalledWith(
      "user-1",
      "clan-1",
      "ALL_TIME",
      "all-time"
    );
  });

  it("falls back to |entry - SL| when initialRiskAbs is 0 (SL=0 gives riskAbs=entry)", async () => {
    // When initialRiskAbs=0 and SL=0, the code falls back to Math.abs(entry - 0) = entry itself.
    // This means finalRR is computed using the entry as the risk distance, not null.
    // This is the real production behavior — when no SL is set, the denominator becomes
    // the full entry price, producing a tiny R:R value.
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.115,
    });

    const trade = makeTradeWithCard({
      initialRiskAbs: 0,
      initialStopLoss: 0,
      officialEntryPrice: null,
      officialInitialRiskAbs: null,
      officialInitialStopLoss: null,
      tradeCard: {
        id: "card-1",
        instrument: "EURUSD",
        direction: "LONG",
        entry: 1.1,
        stopLoss: 0,
        targets: [1.11],
        tags: ["analysis"],
        cardType: "ANALYSIS",
        timeframe: "AUTO",
        riskPct: null,
        note: "Test",
        message: { id: "msg-1", topicId: "topic-1", clanId: "clan-1" },
      },
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockPipDistance.mockReturnValue(50);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    const updateCall = mockTradeUpdate.mock.calls[0][0] as {
      data: { finalRR: number | null };
    };
    // riskAbs fallback = Math.abs(1.1 - 0) = 1.1
    // finalRR = 1 * (1.115 - 1.1) / 1.1 = 0.015 / 1.1 = 0.01363... -> rounded to 0.01
    const expected = Math.round((1 * (1.115 - 1.1)) / 1.1 * 100) / 100;
    expect(updateCall.data.finalRR).toBe(expected);
  });

  it("BUG REGRESSION: close price correction recalculates outcome correctly", async () => {
    // Scenario: trade was originally marked TP_HIT at 1.11, but real close was 1.095 (near SL)
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.095,
      profit: -50,
      commission: -2,
      swap: -1,
    });

    const trade = makeTradeWithCard({
      closedAt: new Date("2026-01-01T12:00:00Z"),
      closePrice: 1.11,
      status: "TP_HIT",
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    // For close correction: pipDistance(instrument, 1.095, tp=1.11) -> far
    mockPipDistance.mockReturnValueOnce(150);
    // pipDistance(instrument, 1.095, sl=1.095) -> within tolerance
    mockPipDistance.mockReturnValueOnce(0);
    mockTradeUpdate.mockResolvedValue({} as never);

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "trade-1" },
        data: expect.objectContaining({
          status: "SL_HIT",
          closePrice: 1.095,
        }),
      })
    );

    // Net profit should be -50 + (-2) + (-1) = -53
    const updateCall = mockTradeUpdate.mock.calls[0][0] as {
      data: { netProfit: number };
    };
    expect(updateCall.data.netProfit).toBe(-53);
  });

  it("uses officialEntryPrice over tradeCard.entry for R:R calculation", async () => {
    // officialEntryPrice (from frozen snapshot) should be used for R, not card entry
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.115,
    });

    const trade = makeTradeWithCard({
      officialEntryPrice: 1.102,            // Official snapshot entry (fill price)
      officialInitialRiskAbs: 0.007,        // |1.102 - 1.095|
      initialEntry: 1.102,
      initialRiskAbs: 0.007,
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockPipDistance.mockReturnValue(50); // CLOSED
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    const updateCall = mockTradeUpdate.mock.calls[0][0] as {
      data: { finalRR: number };
    };
    // dir=1 (LONG), (1.115 - 1.102) / 0.007 = 0.013/0.007 = 1.857... -> rounded to 1.86
    // Uses officialEntryPrice=1.102 and officialInitialRiskAbs=0.007
    const expected = Math.round((1 * (1.115 - 1.102)) / 0.007 * 100) / 100;
    expect(updateCall.data.finalRR).toBe(expected);
  });

  it("creates trade status history record on close", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.115,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    mockPipDistance.mockReturnValue(50);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockTradeStatusHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tradeId: "trade-1",
          fromStatus: "OPEN",
          toStatus: "CLOSED",
          changedById: "user-1",
        }),
      })
    );
  });

  it("creates trade event record on close", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.115,
    });

    mockTradeFindUnique.mockResolvedValue(makeTradeWithCard() as never);
    mockPipDistance.mockReturnValue(50);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    expect(mockTradeEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tradeId: "trade-1",
          actionType: "STATUS_CHANGE",
          source: "EA",
          severity: "INFO",
        }),
      })
    );
  });

  // --- BUG REGRESSION: Official snapshot used for R calculation ---

  it("BUG REGRESSION: uses officialInitialRiskAbs for finalRR calculation", async () => {
    // Trade with official snapshot: entry=1.1, officialRisk=0.01 (SL at 1.09)
    // But initial risk was different (0.005, SL at 1.095)
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.09, // closes at official SL
    });

    const trade = makeTradeWithCard({
      officialEntryPrice: 1.1,
      officialInitialRiskAbs: 0.01,      // official snapshot: SL was at 1.09
      officialInitialStopLoss: 1.09,
      initialRiskAbs: 0.005,              // initial: SL was at 1.095
      initialEntry: 1.1,
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockPipDistance.mockReturnValue(50); // > tolerance → outcome = CLOSED
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    // R should be: (1.09 - 1.1) / 0.01 = -1.0 (using official risk)
    // NOT: (1.09 - 1.1) / 0.005 = -2.0 (using initial risk)
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          finalRR: -1,
        }),
      })
    );
  });

  it("BUG REGRESSION: falls back to initialRiskAbs when official snapshot is null", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.095,
    });

    const trade = makeTradeWithCard({
      officialEntryPrice: null,
      officialInitialRiskAbs: null,
      officialInitialStopLoss: null,
      initialEntry: 1.1,
      initialRiskAbs: 0.005,
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockPipDistance.mockReturnValue(50);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    // R = (1.095 - 1.1) / 0.005 = -1.0
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          finalRR: -1,
        }),
      })
    );
  });

  it("BUG REGRESSION: close correction updates system message text", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.112,
      profit: 120,
      commission: -2,
      swap: -1,
    });

    const trade = makeTradeWithCard({
      closedAt: new Date("2026-01-01T12:00:00Z"),
      closePrice: 1.11,
      status: "TP_HIT",
      officialEntryPrice: 1.1,
      officialInitialRiskAbs: 0.005,
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    mockTradeUpdate.mockResolvedValue({} as never);
    mockPipDistance.mockReturnValue(0);
    // Simulate finding the original close message
    mockMessageFindFirst.mockResolvedValue({ id: "close-msg-1" } as never);
    mockMessageUpdate.mockResolvedValue({} as never);
    mockMessageFindUnique.mockResolvedValue(null as never);

    await syncSignalClose(mtTrade as never, "user-1");

    // Should find and update the original close message
    expect(mockMessageFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          replyToId: "msg-1",
          type: "TRADE_ACTION",
          content: { startsWith: "Trade closed at" },
        }),
      })
    );
    expect(mockMessageUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "close-msg-1" },
        data: expect.objectContaining({
          content: expect.stringContaining("Trade closed at 1.112"),
          isEdited: true,
        }),
      })
    );
  });

  it("BUG REGRESSION: SL_HIT with slippage has R < -1 (not clamped)", async () => {
    // SL at 1.095 but trade slipped to 1.094 (beyond SL)
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      closePrice: 1.094,
    });

    const trade = makeTradeWithCard({
      officialEntryPrice: 1.1,
      officialInitialRiskAbs: 0.005, // SL at 1.095
      officialInitialStopLoss: 1.095,
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    // Close within 5 pips of SL → SL_HIT
    mockPipDistance
      .mockReturnValueOnce(50)  // vs TP — far away
      .mockReturnValueOnce(1)   // vs SL — close (within tolerance)
      .mockReturnValueOnce(50); // vs entry — far away
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeStatusHistoryCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);
    mockMtAccountFindFirst.mockResolvedValue({ id: "acc-1" } as never);

    await syncSignalClose(mtTrade as never, "user-1");

    // Outcome should be SL_HIT (within pip tolerance of SL)
    // R = (1.094 - 1.1) / 0.005 = -1.2 (slippage gives worse than -1R)
    expect(mockTradeUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SL_HIT",
          finalRR: -1.2,
        }),
      })
    );
  });
});

// ============================================================
// syncSignalModification — reQualifyTrade integration
// ============================================================

describe("syncSignalModification — reQualifyTrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls reQualifyTrade when SL changes on already-qualified trade", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      isOpen: true,
      stopLoss: 1.096,    // new SL
      takeProfit: 1.11,
    });

    const trade = makeTradeWithCard({
      officialSignalQualified: true, // already qualified
      tradeCard: {
        id: "card-1",
        instrument: "EURUSD",
        direction: "LONG",
        entry: 1.1,
        stopLoss: 1.095,   // old SL
        targets: [1.11],
        tags: ["signal"],
        cardType: "SIGNAL",
        timeframe: "AUTO",
        riskPct: null,
        note: "Auto-generated",
        message: { id: "msg-1", topicId: "topic-1", clanId: "clan-1" },
      },
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue("OK");
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeCardUpdate.mockResolvedValue({} as never);
    mockTradeCardVersionCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);

    await syncSignalModification(mtTrade as never, "user-1");

    // Should call reQualifyTrade, NOT qualifyTrade
    expect(mockReQualifyTrade).toHaveBeenCalledWith(
      "trade-1",
      1.096,  // new SL
      1.11,   // TP
      expect.objectContaining({ lots: 0.1 })
    );
  });

  it("calls qualifyTrade (not reQualifyTrade) when trade is not yet qualified", async () => {
    const mtTrade = makeMtTrade({
      matchedTradeId: "trade-1",
      isOpen: true,
      stopLoss: 1.095,
      takeProfit: 1.11,
    });

    const trade = makeTradeWithCard({
      officialSignalQualified: false, // not yet qualified
      tradeCard: {
        id: "card-1",
        instrument: "EURUSD",
        direction: "LONG",
        entry: 1.1,
        stopLoss: 0,       // was missing
        targets: [0],
        tags: ["analysis"],
        cardType: "ANALYSIS",
        timeframe: "AUTO",
        riskPct: null,
        note: "Auto-generated",
        message: { id: "msg-1", topicId: "topic-1", clanId: "clan-1" },
      },
    });

    mockTradeFindUnique.mockResolvedValue(trade as never);
    (redis.set as ReturnType<typeof vi.fn>).mockResolvedValue("OK");
    mockTradeUpdate.mockResolvedValue({} as never);
    mockTradeCardUpdate.mockResolvedValue({} as never);
    mockTradeCardVersionCreate.mockResolvedValue({} as never);
    mockTradeEventCreate.mockResolvedValue({} as never);
    mockMessageCreate.mockResolvedValue({
      id: "sys-1",
      user: { id: "user-1" },
    } as never);

    await syncSignalModification(mtTrade as never, "user-1");

    // Should call qualifyTrade, NOT reQualifyTrade
    expect(qualifyTrade).toHaveBeenCalled();
    expect(mockReQualifyTrade).not.toHaveBeenCalled();
  });
});
