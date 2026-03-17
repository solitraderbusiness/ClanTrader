import { db } from "@/lib/db";
import { log } from "@/lib/audit";
import { getIO } from "@/lib/socket-io-global";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { pipDistance } from "@/services/signal-matcher.service";
import { computeAndSetEligibility } from "@/services/integrity.service";
import { evaluateUserBadges } from "@/services/badge-engine.service";
import { generateStatementFromMtAccount } from "@/services/mt-statement.service";
import { calculateStatement } from "@/services/statement-calc.service";
import { serializeMessageForSocket, messageInclude, topicRoom, clanRoom, CLOSE_TOLERANCE_PIPS } from "./ea-signal-helpers";
import type { MtTrade } from "@prisma/client";

export async function syncSignalClose(
  mtTrade: MtTrade,
  userId: string
): Promise<void> {
  try {
    if (!mtTrade.matchedTradeId) return;

    const trade = await db.trade.findUnique({
      where: { id: mtTrade.matchedTradeId },
      include: {
        tradeCard: {
          include: {
            message: { select: { id: true, topicId: true, clanId: true } },
          },
        },
      },
    });
    if (!trade) return;

    // If already closed, only proceed if we have a better close price
    if (trade.closedAt) {
      const newClosePrice = mtTrade.closePrice;
      if (!newClosePrice || newClosePrice === trade.closePrice) return;
      // We have a better close price — update the trade with correct data
      const tradeCard = trade.tradeCard;
      const effectiveEntry = trade.officialEntryPrice ?? trade.initialEntry ?? tradeCard.entry;
      const sl = tradeCard.stopLoss;
      const effectiveRiskAbs = (trade.officialInitialRiskAbs && trade.officialInitialRiskAbs > 0)
        ? trade.officialInitialRiskAbs
        : (trade.initialRiskAbs && trade.initialRiskAbs > 0)
          ? trade.initialRiskAbs
          : Math.abs(effectiveEntry - sl);
      let finalRR: number | null = null;
      if (effectiveRiskAbs > 0) {
        const dir = tradeCard.direction === "LONG" ? 1 : -1;
        finalRR = Math.round((dir * (newClosePrice - effectiveEntry)) / effectiveRiskAbs * 100) / 100;
      }
      const netProfit = (mtTrade.profit ?? 0) + (mtTrade.commission ?? 0) + (mtTrade.swap ?? 0);
      const instrument = tradeCard.instrument;
      const tp = tradeCard.targets[0] ?? 0;

      let outcome: "TP_HIT" | "SL_HIT" | "BE" | "CLOSED" = "CLOSED";
      if (tp > 0 && pipDistance(instrument, newClosePrice, tp) <= CLOSE_TOLERANCE_PIPS) {
        outcome = "TP_HIT";
      } else if (sl > 0 && pipDistance(instrument, newClosePrice, sl) <= CLOSE_TOLERANCE_PIPS) {
        outcome = "SL_HIT";
      } else if (pipDistance(instrument, newClosePrice, effectiveEntry) <= CLOSE_TOLERANCE_PIPS) {
        outcome = "BE";
      }

      await db.trade.update({
        where: { id: trade.id },
        data: { status: outcome, closePrice: newClosePrice, finalRR, netProfit: Math.round(netProfit * 100) / 100 },
      });
      await computeAndSetEligibility(trade.id);

      // Update the original close system message so card and message converge
      const { clanId, topicId } = tradeCard.message;
      const replyToId = tradeCard.message.id;
      const rrText = finalRR != null ? ` | ${finalRR > 0 ? "+" : ""}${finalRR}R` : "";
      const originalCloseMsg = await db.message.findFirst({
        where: {
          replyToId,
          type: "TRADE_ACTION",
          content: { startsWith: "Trade closed at" },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (originalCloseMsg) {
        await db.message.update({
          where: { id: originalCloseMsg.id },
          data: {
            content: `Trade closed at ${newClosePrice} → ${outcome}${rrText}`,
            isEdited: true,
          },
        });
      }

      // Broadcast correction so connected clients update in real-time
      const io = getIO();
      if (io && topicId) {
        const tradePayload = {
          id: trade.id, status: outcome, userId: trade.userId,
          finalRR, netProfit: Math.round(netProfit * 100) / 100, closePrice: newClosePrice,
        };
        io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, {
          tradeId: trade.id,
          messageId: replyToId,
          status: outcome,
          trade: tradePayload,
        });
        io.to(`clan:${clanId}`).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, {
          tradeId: trade.id,
          messageId: replyToId,
          status: outcome,
          trade: tradePayload,
        });

        // Broadcast edited message so chat text updates
        if (originalCloseMsg) {
          const updatedMsg = await db.message.findUnique({
            where: { id: originalCloseMsg.id },
            include: messageInclude,
          });
          if (updatedMsg) {
            const editSerialized = serializeMessageForSocket(updatedMsg, clanId);
            io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.MESSAGE_EDITED, editSerialized);
            io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.MESSAGE_EDITED, editSerialized);
          }
        }
      }

      // Recalculate statement with corrected data
      const now = new Date();
      const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      calculateStatement(userId, clanId, "MONTHLY", periodKey).catch(() => {});
      calculateStatement(userId, clanId, "ALL_TIME", "all-time").catch(() => {});

      log("ea_signal.close_price_corrected", "INFO", "EA", {
        tradeId: trade.id, oldClose: trade.closePrice, newClose: newClosePrice,
        oldOutcome: trade.status, newOutcome: outcome, finalRR,
      }, userId);
      return;
    }

    const tradeCard = trade.tradeCard;
    const entry = tradeCard.entry;
    const sl = tradeCard.stopLoss;
    const tp = tradeCard.targets[0] ?? 0;
    const closePrice = mtTrade.closePrice ?? entry;
    const instrument = tradeCard.instrument;

    // Determine outcome
    let outcome: "TP_HIT" | "SL_HIT" | "BE" | "CLOSED" = "CLOSED";
    if (tp > 0 && pipDistance(instrument, closePrice, tp) <= CLOSE_TOLERANCE_PIPS) {
      outcome = "TP_HIT";
    } else if (sl > 0 && pipDistance(instrument, closePrice, sl) <= CLOSE_TOLERANCE_PIPS) {
      outcome = "SL_HIT";
    } else if (pipDistance(instrument, closePrice, entry) <= CLOSE_TOLERANCE_PIPS) {
      outcome = "BE";
    }

    // Compute final R:R — prefer official frozen snapshot, fall back to initial fields
    const effectiveEntry = trade.officialEntryPrice ?? trade.initialEntry ?? entry;
    const effectiveRiskAbs = (trade.officialInitialRiskAbs && trade.officialInitialRiskAbs > 0)
      ? trade.officialInitialRiskAbs
      : (trade.initialRiskAbs && trade.initialRiskAbs > 0)
        ? trade.initialRiskAbs
        : Math.abs(effectiveEntry - sl);
    let finalRR: number | null = null;
    if (effectiveRiskAbs > 0) {
      const dir = tradeCard.direction === "LONG" ? 1 : -1;
      finalRR = Math.round((dir * (closePrice - effectiveEntry)) / effectiveRiskAbs * 100) / 100;
    }

    // Net P&L = profit + commission + swap (MT reports commission/swap as negatives)
    const netProfit = (mtTrade.profit ?? 0) + (mtTrade.commission ?? 0) + (mtTrade.swap ?? 0);

    // Update trade — preserve existing eligibility, re-evaluate after
    await db.trade.update({
      where: { id: trade.id },
      data: {
        status: outcome,
        closedAt: new Date(),
        resolutionSource: "EA_VERIFIED",
        closePrice,
        finalRR,
        netProfit: Math.round(netProfit * 100) / 100,
      },
    });

    // Re-evaluate eligibility on close (may promote PENDING → VERIFIED)
    await computeAndSetEligibility(trade.id);

    // Status history
    await db.tradeStatusHistory.create({
      data: {
        tradeId: trade.id,
        fromStatus: trade.status,
        toStatus: outcome,
        changedById: userId,
        note: `EA-verified close at ${closePrice} (${outcome})`,
      },
    });

    // Trade event
    await db.tradeEvent.create({
      data: {
        tradeId: trade.id,
        actionType: "STATUS_CHANGE",
        actorId: userId,
        oldValue: JSON.stringify({ status: trade.status }),
        newValue: JSON.stringify({ status: outcome, closePrice }),
        note: `Trade closed in MetaTrader at ${closePrice} → ${outcome}`,
        severity: "INFO",
        source: "EA",
      },
    });

    // System message — reply to trade card message
    const rrText = finalRR != null ? ` | ${finalRR > 0 ? "+" : ""}${finalRR}R` : "";
    const { clanId, topicId } = tradeCard.message;
    const replyToId = tradeCard.message.id;
    const systemMsg = await db.message.create({
      data: {
        clanId,
        topicId,
        userId,
        content: `Trade closed at ${closePrice} → ${outcome}${rrText}`,
        type: "TRADE_ACTION",
        replyToId,
      },
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true, role: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            user: { select: { id: true, name: true } },
          },
        },
        tradeCard: {
          include: {
            trade: { select: { id: true, status: true, userId: true, mtLinked: true, riskStatus: true, initialRiskAbs: true, initialEntry: true, officialEntryPrice: true, officialInitialRiskAbs: true, officialInitialTargets: true } },
          },
        },
      },
    });

    // Broadcast
    const io = getIO();
    if (io) {
      const serialized = serializeMessageForSocket(systemMsg, clanId);
      if (topicId) {
        io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, serialized);
      }
      io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, serialized);

      const tradePayload = {
        id: trade.id, status: outcome, userId: trade.userId,
        finalRR, netProfit: Math.round(netProfit * 100) / 100, closePrice,
      };
      const statusData = {
        tradeId: trade.id,
        messageId: tradeCard.message.id,
        status: outcome,
        trade: tradePayload,
      };
      if (topicId) {
        io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, statusData);
      }
      io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, statusData);
    }

    // Fire-and-forget: badges + statement generation
    evaluateUserBadges(userId).catch((err) =>
      log("badge.evaluation_error", "ERROR", "SYSTEM", { error: String(err), userId, context: "ea_signal_close" })
    );

    const mtAccount = await db.mtAccount.findFirst({
      where: { id: mtTrade.mtAccountId },
      select: { id: true },
    });
    if (mtAccount) {
      generateStatementFromMtAccount(userId, mtAccount.id).catch((err) =>
        log("ea_signal.statement_generation_error", "ERROR", "EA", { error: String(err), userId }, userId)
      );
    }

    // Fire-and-forget: recalculate trader's clan statement
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    calculateStatement(userId, clanId, "MONTHLY", periodKey).catch((err) =>
      log("ea_signal.statement_calc_error", "ERROR", "EA", { error: String(err) }, userId)
    );
    calculateStatement(userId, clanId, "ALL_TIME", "all-time").catch((err) =>
      log("ea_signal.statement_calc_error", "ERROR", "EA", { error: String(err) }, userId)
    );

    // Fire-and-forget: user notification for trade close
    import("@/services/notification-triggers").then(({ notifyTradeClosed }) =>
      notifyTradeClosed(userId, tradeCard.instrument, tradeCard.direction, outcome, finalRR).catch(() => {})
    );
  } catch (err) {
    log("ea_signal.sync_close_error", "ERROR", "EA", { error: String(err), tradeId: mtTrade.matchedTradeId }, userId);
  }
}
