import { db } from "@/lib/db";
import { getIO } from "@/lib/socket-io-global";
import { audit, log } from "@/lib/audit";
import { createMessage } from "@/services/message.service";
import { evaluateUserBadges } from "@/services/badge-engine.service";
import type { TradeActionType } from "@prisma/client";

const ACTION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export class EaActionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
  ) {
    super(message);
  }
}

/**
 * Create a pending action that the EA will pick up on next heartbeat.
 */
export async function createPendingAction(params: {
  tradeId: string;
  actionType: TradeActionType;
  requestedById: string;
  newValue?: string;
  note?: string;
}) {
  const { tradeId, actionType, requestedById, newValue, note } = params;

  // Find the trade with its matched MT trade
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: {
      mtTradeMatches: {
        where: { isOpen: true },
        take: 1,
      },
    },
  });

  if (!trade) {
    throw new EaActionError("Trade not found", "NOT_FOUND", 404);
  }

  if (!trade.mtLinked) {
    throw new EaActionError("Trade is not MT-linked", "NOT_MT_LINKED", 400);
  }

  const mtTrade = trade.mtTradeMatches[0];
  if (!mtTrade) {
    throw new EaActionError(
      "No active MT trade found for this signal",
      "NO_MT_TRADE",
      400,
    );
  }

  // Check for existing pending/sent action on this trade
  const existing = await db.eaPendingAction.findFirst({
    where: {
      tradeId,
      status: { in: ["PENDING", "SENT"] },
    },
  });

  if (existing) {
    throw new EaActionError(
      "There is already a pending action for this trade",
      "ACTION_ALREADY_PENDING",
      409,
    );
  }

  const action = await db.eaPendingAction.create({
    data: {
      tradeId,
      mtAccountId: mtTrade.mtAccountId,
      actionType,
      newValue: newValue || null,
      note: note || null,
      requestedById,
      mtTicket: mtTrade.ticket,
      expiresAt: new Date(Date.now() + ACTION_EXPIRY_MS),
    },
  });

  return action;
}

/**
 * Fetch pending actions for an MT account (called during heartbeat).
 * Marks them as SENT and expires timed-out ones.
 */
export async function fetchPendingActionsForAccount(mtAccountId: string) {
  // Find timed-out actions before updating (so we can notify clients)
  const timedOut = await db.eaPendingAction.findMany({
    where: {
      mtAccountId,
      status: { in: ["PENDING", "SENT"] },
      expiresAt: { lt: new Date() },
    },
    include: {
      trade: {
        include: {
          tradeCard: {
            include: { message: { select: { topicId: true } } },
          },
        },
      },
    },
  });

  // Expire timed-out actions
  if (timedOut.length > 0) {
    for (const action of timedOut) {
      log("ea_action.timed_out", "WARN", "EA", {
        actionId: action.id,
        tradeId: action.tradeId,
        actionType: action.actionType,
      }, action.requestedById);
    }

    await db.eaPendingAction.updateMany({
      where: {
        id: { in: timedOut.map((a) => a.id) },
      },
      data: {
        status: "TIMED_OUT",
        completedAt: new Date(),
      },
    });

    // Notify clients about timed-out actions
    const io = getIO();
    if (io) {
      for (const action of timedOut) {
        const topicId = action.trade.tradeCard?.message?.topicId;
        if (topicId) {
          const room = `topic:${action.trade.clanId}:${topicId}`;
          io.to(room).emit("ea_action_resolved", {
            tradeId: action.tradeId,
            actionId: action.id,
            actionType: action.actionType,
            status: "TIMED_OUT",
            errorMessage: "Action timed out — EA did not respond",
          });
        }
      }
    }
  }

  // Fetch pending actions
  const actions = await db.eaPendingAction.findMany({
    where: {
      mtAccountId,
      status: "PENDING",
    },
    take: 10,
    orderBy: { createdAt: "asc" },
  });

  if (actions.length === 0) return [];

  // Mark as SENT
  await db.eaPendingAction.updateMany({
    where: {
      id: { in: actions.map((a) => a.id) },
    },
    data: {
      status: "SENT",
      sentAt: new Date(),
    },
  });

  return actions.map((a) => ({
    id: a.id,
    ticket: a.mtTicket?.toString() ?? "",
    actionType: a.actionType,
    newValue: a.newValue,
  }));
}

/**
 * Report the result of an EA action execution.
 */
export async function reportActionResult(
  actionId: string,
  mtAccountId: string,
  success: boolean,
  errorMessage?: string,
) {
  const action = await db.eaPendingAction.findUnique({
    where: { id: actionId },
    include: {
      trade: {
        include: {
          tradeCard: {
            include: {
              message: {
                include: {
                  user: { select: { id: true, name: true } },
                },
              },
            },
          },
          user: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!action) {
    throw new EaActionError("Action not found", "NOT_FOUND", 404);
  }

  if (action.mtAccountId !== mtAccountId) {
    throw new EaActionError("Action does not belong to this account", "FORBIDDEN", 403);
  }

  if (action.status !== "SENT" && action.status !== "PENDING") {
    throw new EaActionError(
      `Action is in ${action.status} state, cannot report result`,
      "INVALID_STATE",
      400,
    );
  }

  const newStatus = success ? "EXECUTED" : "FAILED";
  audit("ea_action.result", "EaPendingAction", actionId, action.requestedById, {
    actionType: action.actionType,
    status: newStatus,
    errorMessage: errorMessage || null,
  }, { level: success ? "INFO" : "ERROR", category: "EA" });

  // Update the action
  const updatedAction = await db.eaPendingAction.update({
    where: { id: actionId },
    data: {
      status: newStatus,
      completedAt: new Date(),
      errorMessage: errorMessage || null,
    },
  });

  const trade = action.trade;
  const tradeCard = trade.tradeCard;
  if (!tradeCard) {
    log("ea_action.no_trade_card", "ERROR", "EA", { tradeId: trade.id, actionId }, action.requestedById);
    throw new EaActionError("Trade card not found", "NO_TRADE_CARD", 500);
  }
  const actorName = trade.user.name || "Unknown";
  let systemContent: string;
  let appliedValue: string | null = null; // The actual value that was applied

  if (success) {
    // Apply DB changes based on action type
    switch (action.actionType) {
      case "SET_BE": {
        appliedValue = String(tradeCard.entry);
        await db.tradeCard.update({
          where: { id: tradeCard.id },
          data: { stopLoss: tradeCard.entry },
        });
        systemContent = `${actorName} set break even via MetaTrader (SL → ${tradeCard.entry})`;
        break;
      }
      case "MOVE_SL": {
        const newSL = parseFloat(action.newValue || "0");
        appliedValue = String(newSL);
        await db.tradeCard.update({
          where: { id: tradeCard.id },
          data: { stopLoss: newSL },
        });
        systemContent = `${actorName} moved SL to ${newSL} via MetaTrader`;
        break;
      }
      case "CHANGE_TP": {
        const newTP = parseFloat(action.newValue || "0");
        appliedValue = String(newTP);
        await db.tradeCard.update({
          where: { id: tradeCard.id },
          data: { targets: [newTP] },
        });
        systemContent = `${actorName} changed target to ${newTP} via MetaTrader`;
        break;
      }
      case "CLOSE": {
        // Try to get close price from matched MtTrade
        const mtTrade = await db.mtTrade.findFirst({
          where: { matchedTradeId: trade.id },
          orderBy: { openTime: "desc" },
        });
        const closePrice = mtTrade?.closePrice ?? undefined;

        // Compute final R:R
        const entry = trade.initialEntry ?? tradeCard.entry;
        const riskAbs = (trade.initialRiskAbs && trade.initialRiskAbs > 0)
          ? trade.initialRiskAbs
          : Math.abs(entry - tradeCard.stopLoss);
        let finalRR: number | null = null;
        if (closePrice != null && riskAbs > 0) {
          const dir = tradeCard.direction === "LONG" ? 1 : -1;
          finalRR = Math.round((dir * (closePrice - entry)) / riskAbs * 100) / 100;
        }

        // Net P&L from MtTrade
        const netProfit = mtTrade
          ? Math.round(((mtTrade.profit ?? 0) + (mtTrade.commission ?? 0) + (mtTrade.swap ?? 0)) * 100) / 100
          : undefined;

        await db.trade.update({
          where: { id: trade.id },
          data: {
            status: "CLOSED",
            closedAt: new Date(),
            resolutionSource: "EA_VERIFIED",
            integrityStatus: "VERIFIED",
            statementEligible: true,
            ...(closePrice != null && { closePrice }),
            ...(finalRR != null && { finalRR }),
            ...(netProfit != null && { netProfit }),
          },
        });
        await db.tradeStatusHistory.create({
          data: {
            tradeId: trade.id,
            fromStatus: trade.status,
            toStatus: "CLOSED",
            changedById: action.requestedById,
            note: closePrice != null
              ? `Closed via MetaTrader EA at ${closePrice}`
              : "Closed via MetaTrader EA",
          },
        });
        systemContent = `${actorName} closed the trade via MetaTrader`;
        break;
      }
      default:
        systemContent = `${actorName} executed ${action.actionType} via MetaTrader`;
    }
  } else {
    systemContent = `MetaTrader action ${action.actionType} failed${errorMessage ? `: ${errorMessage}` : ""}`;
  }

  // Create TradeEvent
  await db.tradeEvent.create({
    data: {
      tradeId: trade.id,
      actionType: action.actionType,
      actorId: action.requestedById,
      oldValue: null,
      newValue: success ? action.newValue : null,
      note: success
        ? `EA executed: ${action.actionType}`
        : `EA failed: ${errorMessage || "unknown error"}`,
    },
  });

  // Create system message in the topic
  const topicId = tradeCard.message.topicId;
  let systemMessage = null;
  if (topicId) {
    systemMessage = await createMessage(
      trade.clanId,
      action.requestedById,
      systemContent,
      topicId,
      { type: "TRADE_ACTION" },
    );
  }

  // Emit socket events
  const io = getIO();
  if (io && topicId) {
    const room = `topic:${trade.clanId}:${topicId}`;

    io.to(room).emit("ea_action_resolved", {
      tradeId: trade.id,
      actionId,
      actionType: action.actionType,
      status: newStatus,
      errorMessage: errorMessage || null,
      newValue: appliedValue,
    });

    if (success && action.actionType === "CLOSE") {
      io.to(room).emit("trade_status_updated", {
        tradeId: trade.id,
        messageId: tradeCard.message.id,
        status: "CLOSED",
        trade: { id: trade.id, status: "CLOSED", userId: trade.userId },
      });
    }

    if (systemMessage) {
      io.to(room).emit("receive_message", {
        id: systemMessage.id,
        clanId: trade.clanId,
        topicId,
        content: systemMessage.content,
        images: [],
        type: "TRADE_ACTION",
        isPinned: false,
        isEdited: false,
        reactions: null,
        replyTo: null,
        createdAt: systemMessage.createdAt.toISOString(),
        user: systemMessage.user,
        tradeCard: null,
      });
    }
  }

  // Badge evaluation on close
  if (success && action.actionType === "CLOSE") {
    evaluateUserBadges(trade.userId).catch((err) =>
      log("badge.evaluation_error", "ERROR", "SYSTEM", { error: String(err), userId: trade.userId }),
    );
  }

  return updatedAction;
}
