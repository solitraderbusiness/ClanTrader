import { db } from "@/lib/db";
import { getCandleProvider } from "@/lib/candle-provider";
import { evaluateTradeOnCandle } from "@/lib/trade-evaluator";
import { isGap, getInstrumentType } from "@/lib/gap-detection";
import { evaluateUserBadges } from "@/services/badge-engine.service";
import type { Trade, TradeCard, IntegrityReason, TradeStatus, Prisma } from "@prisma/client";

const BATCH_SIZE = 50;
const CANDLE_LOOKBACK_MS = 5 * 60 * 1000; // 5 minutes lookback from lastEvaluatedAt

interface EvalSummary {
  evaluated: number;
  statusChanges: number;
  errors: number;
}

/**
 * Mark a trade as UNVERIFIED with the given reason and details.
 */
async function markTradeUnverified(
  trade: Trade,
  reason: IntegrityReason,
  details: Record<string, unknown>
): Promise<void> {
  await db.trade.update({
    where: { id: trade.id },
    data: {
      status: "UNVERIFIED",
      integrityStatus: "UNVERIFIED",
      integrityReason: reason,
      integrityDetails: details as unknown as Prisma.InputJsonValue,
      statementEligible: false,
      resolutionSource: "EVALUATOR",
      lastEvaluatedAt: new Date(),
      closedAt: new Date(),
    },
  });

  await db.tradeStatusHistory.create({
    data: {
      tradeId: trade.id,
      fromStatus: trade.status,
      toStatus: "UNVERIFIED",
      changedById: trade.userId,
      note: `Evaluator: ${reason}`,
    },
  });

  await db.tradeEvent.create({
    data: {
      tradeId: trade.id,
      actionType: "INTEGRITY_FLAG",
      actorId: trade.userId,
      oldValue: JSON.stringify({ status: trade.status }),
      newValue: JSON.stringify({ status: "UNVERIFIED", reason }),
      note: JSON.stringify(details),
    },
  });
}

/**
 * Evaluate a single trade against candle data.
 * Returns true if a status change occurred.
 */
async function evaluateTrade(
  trade: Trade & { tradeCard: TradeCard }
): Promise<boolean> {
  const card = trade.tradeCard;
  const instrumentType = getInstrumentType(card.instrument);
  const provider = getCandleProvider();

  // Determine time range for candle fetch
  const from = trade.lastEvaluatedAt
    ? new Date(trade.lastEvaluatedAt.getTime() - CANDLE_LOOKBACK_MS)
    : trade.createdAt;
  const to = new Date();

  const candles = await provider.fetchOneMinuteCandles(
    card.instrument,
    from,
    to
  );

  if (candles.length === 0) {
    // No candles available — just update lastEvaluatedAt
    await db.trade.update({
      where: { id: trade.id },
      data: { lastEvaluatedAt: new Date() },
    });
    return false;
  }

  // Sort candles chronologically
  candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Track current trade state for evaluation
  let currentStatus: "PENDING" | "OPEN" = trade.status as "PENDING" | "OPEN";
  const entry = card.entry;
  const stopLoss = card.stopLoss;
  const takeProfit = card.targets[0];

  if (takeProfit === undefined) {
    // No target — can't evaluate
    await db.trade.update({
      where: { id: trade.id },
      data: { lastEvaluatedAt: new Date() },
    });
    return false;
  }

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    // Check for data gap (except first candle)
    if (i > 0) {
      const prevCandle = candles[i - 1];
      if (isGap(prevCandle, candle, instrumentType)) {
        await markTradeUnverified(trade, "DATA_GAP", {
          gapFrom: prevCandle.timestamp,
          gapTo: candle.timestamp,
          instrumentType,
          tradeSnapshot: { entry, stopLoss, takeProfit },
        });
        return true;
      }
    }

    const result = evaluateTradeOnCandle(
      currentStatus,
      entry,
      stopLoss,
      takeProfit,
      candle
    );

    switch (result.action) {
      case "NOOP":
        continue;

      case "ENTER":
        // Transition PENDING → OPEN
        currentStatus = "OPEN";
        await db.trade.update({
          where: { id: trade.id },
          data: {
            status: "OPEN",
            entryFilledAt: result.timestamp,
            lastEvaluatedAt: new Date(),
          },
        });
        await db.tradeStatusHistory.create({
          data: {
            tradeId: trade.id,
            fromStatus: "PENDING",
            toStatus: "OPEN",
            changedById: trade.userId,
            note: "Evaluator: entry confirmed",
          },
        });
        continue;

      case "RESOLVE_TP": {
        const newStatus: TradeStatus = "TP_HIT";
        await db.trade.update({
          where: { id: trade.id },
          data: {
            status: newStatus,
            closedAt: result.timestamp,
            integrityStatus: "VERIFIED",
            resolutionSource: "EVALUATOR",
            lastEvaluatedAt: new Date(),
          },
        });
        await db.tradeStatusHistory.create({
          data: {
            tradeId: trade.id,
            fromStatus: "OPEN",
            toStatus: newStatus,
            changedById: trade.userId,
            note: "Evaluator: take profit hit",
          },
        });
        // Fire-and-forget badge evaluation
        evaluateUserBadges(trade.userId).catch((err) =>
          console.error("Badge evaluation error:", err)
        );
        return true;
      }

      case "RESOLVE_SL": {
        const newStatus: TradeStatus = "SL_HIT";
        await db.trade.update({
          where: { id: trade.id },
          data: {
            status: newStatus,
            closedAt: result.timestamp,
            integrityStatus: "VERIFIED",
            resolutionSource: "EVALUATOR",
            lastEvaluatedAt: new Date(),
          },
        });
        await db.tradeStatusHistory.create({
          data: {
            tradeId: trade.id,
            fromStatus: "OPEN",
            toStatus: newStatus,
            changedById: trade.userId,
            note: "Evaluator: stop loss hit",
          },
        });
        evaluateUserBadges(trade.userId).catch((err) =>
          console.error("Badge evaluation error:", err)
        );
        return true;
      }

      case "MARK_UNVERIFIED":
        await markTradeUnverified(trade, result.reason, result.details);
        return true;
    }
  }

  // All candles processed, no resolution yet — update lastEvaluatedAt
  await db.trade.update({
    where: { id: trade.id },
    data: { lastEvaluatedAt: new Date() },
  });

  return false;
}

/**
 * Evaluate all PENDING/OPEN trades that haven't been manually resolved.
 */
export async function evaluateAllPendingTrades(): Promise<EvalSummary> {
  const summary: EvalSummary = { evaluated: 0, statusChanges: 0, errors: 0 };

  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const trades = await db.trade.findMany({
      where: {
        status: { in: ["PENDING", "OPEN"] },
        resolutionSource: { not: "MANUAL" },
      },
      include: {
        tradeCard: true,
      },
      orderBy: { lastEvaluatedAt: "asc" },
      take: BATCH_SIZE,
      skip,
    });

    if (trades.length < BATCH_SIZE) {
      hasMore = false;
    }

    for (const trade of trades) {
      try {
        const changed = await evaluateTrade(trade);
        summary.evaluated++;
        if (changed) summary.statusChanges++;
      } catch (err) {
        console.error(`Evaluator error for trade ${trade.id}:`, err);
        summary.errors++;
      }
    }

    skip += BATCH_SIZE;
  }

  return summary;
}
