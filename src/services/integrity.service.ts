import { db } from "@/lib/db";
import { log } from "@/lib/audit";

/**
 * Integrity Contract — deny-by-default eligibility engine.
 *
 * A trade is statement-eligible ONLY if ALL 6 conditions pass:
 *   1. MT-linked
 *   2. integrityStatus is not UNVERIFIED
 *   3. resolutionSource is EA_VERIFIED or EVALUATOR
 *   4. Signal card existed BEFORE MT trade opened
 *   5. Initial risk snapshot exists (SL captured)
 *   6. No duplicate MT ticket already counted
 */

export type IntegrityReasonCode = keyof typeof INTEGRITY_REASON_CODES;

export const INTEGRITY_REASON_CODES = {
  NOT_MT_LINKED: "integrity.notMtLinked",
  INTEGRITY_UNVERIFIED: "integrity.unverified",
  UNTRUSTED_RESOLUTION: "integrity.untrustedResolution",
  CARD_AFTER_TRADE: "integrity.cardAfterTrade",
  NO_INITIAL_RISK: "integrity.noInitialRisk",
  DUPLICATE_MT_TICKET: "integrity.duplicateMtTicket",
  ANALYSIS_UPGRADE: "integrity.analysisUpgrade",
  MANUAL_TRADE: "integrity.manualTrade",
  MANUAL_OVERRIDE: "integrity.manualOverride",
  TP_MODIFIED: "integrity.tpModified",
  SL_REMOVED: "integrity.slRemoved",
  LATE_SIGNAL: "integrity.lateSignal",
  PENDING_VERIFICATION: "integrity.pendingVerification",
  CARD_TYPE_ANALYSIS: "integrity.cardTypeAnalysis",
} as const;

export async function computeAndSetEligibility(
  tradeId: string
): Promise<boolean> {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: {
      tradeCard: {
        select: { createdAt: true, cardType: true },
      },
      mtTradeMatches: {
        select: { ticket: true, openTime: true },
        take: 1,
      },
    },
  });

  if (!trade) return false;

  const reasons: IntegrityReasonCode[] = [];

  // Condition 1: Trade must be MT-linked
  if (!trade.mtLinked) {
    reasons.push("NOT_MT_LINKED");
  }

  // Condition 2: integrityStatus must not be UNVERIFIED
  if (trade.integrityStatus === "UNVERIFIED") {
    reasons.push("INTEGRITY_UNVERIFIED");
  }

  // Condition 3: resolutionSource must be EA_VERIFIED or EVALUATOR
  if (!["EA_VERIFIED", "EVALUATOR"].includes(trade.resolutionSource)) {
    reasons.push("UNTRUSTED_RESOLUTION");
  }

  // Condition 4: Signal card existed BEFORE MT trade opened
  if (trade.tradeCard && trade.mtTradeMatches.length > 0) {
    const cardCreated = trade.tradeCard.createdAt.getTime();
    const mtOpen = trade.mtTradeMatches[0].openTime.getTime();
    if (cardCreated > mtOpen) {
      reasons.push("CARD_AFTER_TRADE");
    }
  }

  // Condition 5: Initial risk snapshot exists (SL captured)
  if (
    !trade.initialStopLoss ||
    trade.initialStopLoss <= 0 ||
    trade.initialRiskMissing
  ) {
    reasons.push("NO_INITIAL_RISK");
  }

  // Condition 6: No duplicate MT ticket already counted
  if (trade.mtTradeMatches.length > 0) {
    const ticket = trade.mtTradeMatches[0].ticket;
    const duplicates = await db.trade.count({
      where: {
        id: { not: tradeId },
        statementEligible: true,
        mtTradeMatches: { some: { ticket } },
      },
    });
    if (duplicates > 0) {
      reasons.push("DUPLICATE_MT_TICKET");
    }
  }

  const isEligible = reasons.length === 0;

  // Promote PENDING → VERIFIED if all conditions pass
  const newIntegrityStatus =
    isEligible && trade.integrityStatus === "PENDING"
      ? "VERIFIED"
      : trade.integrityStatus;

  await db.trade.update({
    where: { id: tradeId },
    data: {
      integrityStatus: newIntegrityStatus,
      statementEligible: isEligible,
      eligibleAtOpen: isEligible,
      ...(isEligible && !trade.wasEverCounted
        ? { wasEverCounted: true, countedAt: new Date() }
        : {}),
      integrityDetails:
        reasons.length > 0 ? ({ reasons } as object) : undefined,
    },
  });

  if (!isEligible) {
    log(
      "integrity.check_failed",
      "INFO",
      "TRADE",
      { tradeId, reasons },
      trade.userId
    );
  }

  return isEligible;
}
