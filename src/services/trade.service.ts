import { db } from "@/lib/db";
import { MessageServiceError, requireClanMembership } from "@/services/message.service";
import type { TradeStatus } from "@prisma/client";

export async function trackTrade(messageId: string, clanId: string, userId: string) {
  const message = await db.message.findUnique({
    where: { id: messageId },
    include: { tradeCard: { include: { trade: true } } },
  });

  if (!message || message.clanId !== clanId) {
    throw new MessageServiceError("Message not found", "NOT_FOUND", 404);
  }

  if (!message.tradeCard) {
    throw new MessageServiceError("Message has no trade card", "NO_TRADE_CARD", 400);
  }

  if (message.tradeCard.trade) {
    throw new MessageServiceError("Trade is already being tracked", "ALREADY_TRACKED", 409);
  }

  const trade = await db.trade.create({
    data: {
      tradeCardId: message.tradeCard.id,
      clanId,
      userId,
      status: "OPEN",
    },
  });

  return { trade, message };
}

export async function updateTradeStatus(
  tradeId: string,
  clanId: string,
  userId: string,
  status: string,
  note?: string
) {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: {
      tradeCard: {
        include: { message: true },
      },
    },
  });

  if (!trade || trade.clanId !== clanId) {
    throw new MessageServiceError("Trade not found", "NOT_FOUND", 404);
  }

  // Only the trade creator or clan leaders can update status
  if (trade.userId !== userId) {
    const membership = await requireClanMembership(userId, clanId);
    if (!["LEADER", "CO_LEADER"].includes(membership.role)) {
      throw new MessageServiceError(
        "Only the trade creator or clan leaders can update status",
        "FORBIDDEN",
        403
      );
    }
  }

  const fromStatus = trade.status;

  // Create status history entry
  const history = await db.tradeStatusHistory.create({
    data: {
      tradeId,
      fromStatus,
      toStatus: status as TradeStatus,
      changedById: userId,
      note,
    },
  });

  // Update trade
  const closedStatuses: TradeStatus[] = ["SL_HIT", "CLOSED"];
  const updatedTrade = await db.trade.update({
    where: { id: tradeId },
    data: {
      status: status as TradeStatus,
      ...(closedStatuses.includes(status as TradeStatus) ? { closedAt: new Date() } : {}),
    },
  });

  return {
    trade: updatedTrade,
    message: trade.tradeCard.message,
    history,
  };
}

export async function getTrades(
  clanId: string,
  filters: {
    status?: string;
    instrument?: string;
    direction?: string;
    userId?: string;
    cursor?: string;
    limit?: number;
  } = {}
) {
  const limit = Math.min(filters.limit || 20, 50);

  const where: Record<string, unknown> = { clanId };
  if (filters.status) where.status = filters.status;
  if (filters.userId) where.userId = filters.userId;

  const tradeCardWhere: Record<string, unknown> = {};
  if (filters.instrument) tradeCardWhere.instrument = filters.instrument;
  if (filters.direction) tradeCardWhere.direction = filters.direction;

  if (Object.keys(tradeCardWhere).length > 0) {
    where.tradeCard = tradeCardWhere;
  }

  const trades = await db.trade.findMany({
    where,
    include: {
      tradeCard: {
        include: {
          message: {
            include: {
              user: { select: { id: true, name: true, avatar: true, role: true } },
            },
          },
        },
      },
      user: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = trades.length > limit;
  if (hasMore) trades.pop();

  return { trades, hasMore, nextCursor: hasMore ? trades[trades.length - 1]?.id : null };
}

export async function getTradeById(tradeId: string) {
  const trade = await db.trade.findUnique({
    where: { id: tradeId },
    include: {
      tradeCard: {
        include: {
          message: {
            include: {
              user: { select: { id: true, name: true, avatar: true, role: true } },
            },
          },
          versions: {
            orderBy: { editedAt: "desc" },
            take: 10,
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      user: { select: { id: true, name: true } },
    },
  });

  if (!trade) {
    throw new MessageServiceError("Trade not found", "NOT_FOUND", 404);
  }

  return trade;
}
