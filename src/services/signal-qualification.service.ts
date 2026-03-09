import { db } from "@/lib/db";
import { log } from "@/lib/audit";
import { computeAndSetEligibility } from "@/services/integrity.service";

/**
 * Signal Qualification Service
 *
 * A trade becomes an official signal-qualified trade if it has valid SL+TP:
 *   Option A: At open (first heartbeat with SL+TP)
 *   Option B: Within 20 seconds of MT open time
 *
 * At qualification, an immutable official risk snapshot is frozen:
 *   officialEntryPrice, officialInitialStopLoss, officialInitialTargets,
 *   officialInitialRiskAbs, officialInitialRiskMoney
 *
 * Trades that miss the 20-second window become analysis-origin forever.
 */

const QUALIFICATION_WINDOW_MS = 20_000; // 20 seconds

/**
 * Set qualification deadline when a trade is first created from EA.
 * Called from ea-signal-create.service.ts.
 */
export function computeQualificationDeadline(mtOpenTime: Date): Date {
  return new Date(mtOpenTime.getTime() + QUALIFICATION_WINDOW_MS);
}

/**
 * Attempt to qualify a trade as an official signal.
 * Returns true if qualification succeeded.
 *
 * @param tradeId - The Trade record ID
 * @param sl - Current stop loss price
 * @param tp - Current take profit price (first target)
 * @param entry - Entry price
 * @param originType - "AT_OPEN" if SL+TP present at first sync, "WITHIN_WINDOW" if added later
 * @param mtTradeData - Optional MT trade data for computing risk money
 */
export async function qualifyTrade(
  tradeId: string,
  sl: number,
  tp: number,
  entry: number,
  originType: "AT_OPEN" | "WITHIN_WINDOW",
  mtTradeData?: { lots: number; currentPrice: number; profit: number; direction: "BUY" | "SELL" }
): Promise<boolean> {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    select: {
      officialSignalQualified: true,
      qualificationDeadline: true,
      openedAt: true,
    },
  });

  if (!trade) return false;

  // Already qualified — no-op
  if (trade.officialSignalQualified) return true;

  // Check deadline (skip for AT_OPEN — those are always within window)
  if (originType === "WITHIN_WINDOW" && trade.qualificationDeadline) {
    if (new Date() > trade.qualificationDeadline) {
      // Past deadline — cannot qualify
      return false;
    }
  }

  // Validate SL and TP
  if (sl <= 0 || tp <= 0) return false;

  const officialRiskAbs = Math.abs(entry - sl);
  if (officialRiskAbs <= 0) return false;

  // Compute risk money if MT trade data is available
  let officialRiskMoney: number | null = null;
  if (mtTradeData) {
    officialRiskMoney = computeRiskMoney(
      mtTradeData.lots,
      mtTradeData.currentPrice,
      entry,
      mtTradeData.profit,
      mtTradeData.direction,
      officialRiskAbs
    );
  }

  // Freeze the official snapshot
  await db.trade.update({
    where: { id: tradeId },
    data: {
      officialSignalQualified: true,
      officialQualifiedAt: new Date(),
      officialSignalOriginType: originType,
      officialEntryPrice: entry,
      officialInitialStopLoss: sl,
      officialInitialTargets: [tp],
      officialInitialRiskAbs: officialRiskAbs,
      officialInitialRiskMoney: officialRiskMoney,
    },
  });

  log("signal.qualified", "INFO", "TRADE", {
    tradeId,
    originType,
    entry,
    sl,
    tp,
    riskAbs: officialRiskAbs,
    riskMoney: officialRiskMoney,
  });

  // Re-evaluate eligibility now that qualification passed
  await computeAndSetEligibility(tradeId);

  return true;
}

/**
 * Compute risk in account currency from MT trade data.
 *
 * Uses the relationship: dollarPerPoint = |profit / priceMove|
 * Then: riskMoney = dollarPerPoint * riskAbs
 *
 * Returns null if the calculation would be unreliable.
 */
export function computeRiskMoney(
  lots: number,
  currentPrice: number,
  entryPrice: number,
  floatingProfit: number,
  direction: "BUY" | "SELL",
  riskAbs: number
): number | null {
  // Need meaningful price movement to derive dollar-per-point
  const priceMove = Math.abs(currentPrice - entryPrice);
  if (priceMove < 0.000001) return null; // Price hasn't moved enough

  const dollarPerPoint = Math.abs(floatingProfit / priceMove);
  if (dollarPerPoint <= 0 || !isFinite(dollarPerPoint)) return null;

  const riskMoney = dollarPerPoint * riskAbs;

  // Sanity check: risk money should be positive and reasonable
  if (riskMoney <= 0 || riskMoney > 1_000_000) return null;

  return Math.round(riskMoney * 100) / 100;
}

/**
 * Backfill officialInitialRiskMoney for a trade that qualified but
 * couldn't compute risk money at qualification time.
 * Called from subsequent heartbeats when price has moved enough.
 */
export async function backfillRiskMoney(
  tradeId: string,
  lots: number,
  currentPrice: number,
  floatingProfit: number,
  direction: "BUY" | "SELL"
): Promise<void> {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    select: {
      officialSignalQualified: true,
      officialEntryPrice: true,
      officialInitialRiskAbs: true,
      officialInitialRiskMoney: true,
    },
  });

  if (!trade) return;
  if (!trade.officialSignalQualified) return;
  if (trade.officialInitialRiskMoney != null) return; // Already computed
  if (!trade.officialEntryPrice || !trade.officialInitialRiskAbs) return;

  const riskMoney = computeRiskMoney(
    lots,
    currentPrice,
    trade.officialEntryPrice,
    floatingProfit,
    direction,
    trade.officialInitialRiskAbs
  );

  if (riskMoney != null) {
    await db.trade.update({
      where: { id: tradeId },
      data: { officialInitialRiskMoney: riskMoney },
    });
  }
}

/**
 * Check for trades whose qualification deadline has expired without
 * qualifying. Mark them as permanent analysis-origin.
 * Called periodically from heartbeat processing.
 */
export async function expireUnqualifiedTrades(userId: string): Promise<number> {
  const now = new Date();

  // Find trades past deadline that never qualified
  const expired = await db.trade.findMany({
    where: {
      userId,
      officialSignalQualified: false,
      qualificationDeadline: { lt: now, not: null },
      status: { in: ["PENDING", "OPEN"] },
      mtLinked: true,
    },
    select: { id: true, cardType: true },
  });

  if (expired.length === 0) return 0;

  // Mark as analysis-origin if not already
  for (const trade of expired) {
    if (trade.cardType !== "ANALYSIS") {
      await db.trade.update({
        where: { id: trade.id },
        data: { cardType: "ANALYSIS" },
      });

      await db.tradeEvent.create({
        data: {
          tradeId: trade.id,
          actionType: "INTEGRITY_FLAG",
          actorId: userId,
          oldValue: JSON.stringify({ cardType: trade.cardType }),
          newValue: JSON.stringify({ cardType: "ANALYSIS", reason: "QUALIFICATION_EXPIRED" }),
          note: `Trade missed 20-second qualification window — permanent analysis-origin`,
          severity: "INFO",
          source: "SYSTEM",
        },
      });
    }
  }

  return expired.length;
}
