import { db } from "@/lib/db";
import { MessageServiceError, requireClanMembership, createMessage } from "@/services/message.service";
import { canPerformAction, type TradeActionKey } from "@/lib/trade-action-constants";
import { audit } from "@/lib/audit";
import type { TradeActionType, TradeStatus } from "@prisma/client";

export async function executeTradeAction(
  tradeId: string,
  clanId: string,
  actorId: string,
  actionType: TradeActionKey,
  newValue?: string,
  note?: string
) {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
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
  });

  if (!trade || trade.clanId !== clanId) {
    throw new MessageServiceError("Trade not found", "NOT_FOUND", 404);
  }

  // Check permissions
  const membership = await requireClanMembership(actorId, clanId);
  const actor = await db.user.findUnique({
    where: { id: actorId },
    select: { id: true, name: true, role: true },
  });

  const isAuthor = trade.userId === actorId;
  if (!canPerformAction(actor?.role, membership.role, actionType, isAuthor)) {
    throw new MessageServiceError(
      "You do not have permission to perform this action",
      "FORBIDDEN",
      403
    );
  }

  let oldValue: string | undefined;
  let systemContent: string;
  const actorName = actor?.name || "Unknown";
  const tradeCard = trade.tradeCard;

  // Execute the action
  switch (actionType) {
    case "SET_BE": {
      oldValue = JSON.stringify({ stopLoss: tradeCard.stopLoss });
      await db.tradeCard.update({
        where: { id: tradeCard.id },
        data: { stopLoss: tradeCard.entry },
      });
      systemContent = `${actorName} set break even (SL: ${tradeCard.stopLoss} → ${tradeCard.entry})`;
      break;
    }

    case "MOVE_SL": {
      if (!newValue) {
        throw new MessageServiceError("New stop loss value is required", "INVALID_INPUT", 400);
      }
      const newSL = parseFloat(newValue);
      if (isNaN(newSL) || newSL <= 0) {
        throw new MessageServiceError("Invalid stop loss value", "INVALID_INPUT", 400);
      }
      oldValue = JSON.stringify({ stopLoss: tradeCard.stopLoss });
      await db.tradeCard.update({
        where: { id: tradeCard.id },
        data: { stopLoss: newSL },
      });
      systemContent = `${actorName} moved SL from ${tradeCard.stopLoss} → ${newSL}`;
      break;
    }

    case "CHANGE_TP": {
      if (!newValue) {
        throw new MessageServiceError("New targets value is required", "INVALID_INPUT", 400);
      }
      const newTargets = newValue.split(",").map((v) => parseFloat(v.trim())).filter((v) => !isNaN(v) && v > 0);
      if (newTargets.length === 0) {
        throw new MessageServiceError("Invalid target values", "INVALID_INPUT", 400);
      }
      oldValue = JSON.stringify({ targets: tradeCard.targets });
      await db.tradeCard.update({
        where: { id: tradeCard.id },
        data: { targets: newTargets },
      });
      systemContent = `${actorName} changed targets from [${tradeCard.targets.join(", ")}] → [${newTargets.join(", ")}]`;
      break;
    }

    case "CLOSE": {
      oldValue = JSON.stringify({ status: trade.status });
      const closePrice = newValue ? parseFloat(newValue) : undefined;
      await db.trade.update({
        where: { id: tradeId },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
        },
      });
      // Also record in legacy status history
      await db.tradeStatusHistory.create({
        data: {
          tradeId,
          fromStatus: trade.status,
          toStatus: "CLOSED",
          changedById: actorId,
          note: note || (closePrice ? `Closed at ${closePrice}` : undefined),
        },
      });
      systemContent = `${actorName} closed the trade${closePrice ? ` at ${closePrice}` : ""}`;
      break;
    }

    case "ADD_NOTE": {
      if (!note) {
        throw new MessageServiceError("Note text is required", "INVALID_INPUT", 400);
      }
      systemContent = `${actorName} added a note: ${note}`;
      break;
    }

    case "STATUS_CHANGE": {
      if (!newValue) {
        throw new MessageServiceError("New status is required", "INVALID_INPUT", 400);
      }
      const validStatuses: TradeStatus[] = ["OPEN", "TP1_HIT", "TP2_HIT", "SL_HIT", "BE", "CLOSED"];
      if (!validStatuses.includes(newValue as TradeStatus)) {
        throw new MessageServiceError("Invalid status", "INVALID_INPUT", 400);
      }
      oldValue = JSON.stringify({ status: trade.status });
      const closedStatuses: TradeStatus[] = ["SL_HIT", "CLOSED"];
      await db.trade.update({
        where: { id: tradeId },
        data: {
          status: newValue as TradeStatus,
          ...(closedStatuses.includes(newValue as TradeStatus) ? { closedAt: new Date() } : {}),
        },
      });
      // Also record in legacy status history
      await db.tradeStatusHistory.create({
        data: {
          tradeId,
          fromStatus: trade.status,
          toStatus: newValue as TradeStatus,
          changedById: actorId,
          note,
        },
      });
      systemContent = `${actorName} changed status from ${trade.status} → ${newValue}`;
      break;
    }

    default:
      throw new MessageServiceError("Unknown action type", "INVALID_ACTION", 400);
  }

  // Create TradeEvent record
  const event = await db.tradeEvent.create({
    data: {
      tradeId,
      actionType: actionType as TradeActionType,
      actorId,
      oldValue: oldValue || null,
      newValue: newValue || null,
      note: note || null,
    },
  });

  audit("trade_action.execute", "Trade", tradeId, actorId, {
    actionType,
    oldValue: oldValue || null,
    newValue: newValue || null,
  });

  // Create TRADE_ACTION system message in the same topic
  const topicId = tradeCard.message.topicId;
  let systemMessage = null;
  if (topicId) {
    systemMessage = await createMessage(
      clanId,
      actorId,
      systemContent,
      topicId,
      { type: "TRADE_ACTION" }
    );
  }

  return { event, systemMessage, trade, tradeCard };
}

export async function getTradeEvents(tradeId: string, clanId: string) {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    select: { clanId: true },
  });

  if (!trade || trade.clanId !== clanId) {
    throw new MessageServiceError("Trade not found", "NOT_FOUND", 404);
  }

  return db.tradeEvent.findMany({
    where: { tradeId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
