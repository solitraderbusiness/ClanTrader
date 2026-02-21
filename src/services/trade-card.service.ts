import { db } from "@/lib/db";
import { MessageServiceError } from "@/services/message.service";
import { evaluateUserBadges } from "@/services/badge-engine.service";
import type { TradeDirection } from "@prisma/client";

const messageInclude = {
  user: { select: { id: true, name: true, avatar: true, role: true } },
  replyTo: {
    select: {
      id: true,
      content: true,
      user: { select: { id: true, name: true } },
    },
  },
  tradeCard: {
    include: {
      trade: {
        select: { id: true, status: true, userId: true },
      },
    },
  },
} as const;

interface TradeCardInput {
  instrument: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  targets: number[];
  timeframe: string;
  riskPct?: number;
  note?: string;
  tags?: string[];
}

export async function createTradeCardMessage(
  clanId: string,
  topicId: string,
  userId: string,
  data: TradeCardInput
) {
  const content = `${data.direction} ${data.instrument} @ ${data.entry}`;

  return db.message.create({
    data: {
      clanId,
      topicId,
      userId,
      content,
      type: "TRADE_CARD",
      tradeCard: {
        create: {
          instrument: data.instrument.toUpperCase(),
          direction: data.direction as TradeDirection,
          entry: data.entry,
          stopLoss: data.stopLoss,
          targets: data.targets,
          timeframe: data.timeframe,
          riskPct: data.riskPct ?? null,
          note: data.note ?? null,
          tags: data.tags ?? [],
        },
      },
    },
    include: messageInclude,
  });
}

export async function editTradeCard(
  messageId: string,
  clanId: string,
  userId: string,
  data: TradeCardInput
) {
  const message = await db.message.findUnique({
    where: { id: messageId },
    include: { tradeCard: true },
  });

  if (!message || message.clanId !== clanId) {
    throw new MessageServiceError("Message not found", "NOT_FOUND", 404);
  }

  if (message.userId !== userId) {
    throw new MessageServiceError(
      "You can only edit your own trade cards",
      "FORBIDDEN",
      403
    );
  }

  if (!message.tradeCard) {
    throw new MessageServiceError("Message has no trade card", "NO_TRADE_CARD", 400);
  }

  // Save version history
  await db.tradeCardVersion.create({
    data: {
      tradeCardId: message.tradeCard.id,
      instrument: message.tradeCard.instrument,
      direction: message.tradeCard.direction,
      entry: message.tradeCard.entry,
      stopLoss: message.tradeCard.stopLoss,
      targets: message.tradeCard.targets,
      timeframe: message.tradeCard.timeframe,
      riskPct: message.tradeCard.riskPct,
      note: message.tradeCard.note,
      tags: message.tradeCard.tags,
      editedById: userId,
    },
  });

  // Update trade card
  await db.tradeCard.update({
    where: { id: message.tradeCard.id },
    data: {
      instrument: data.instrument.toUpperCase(),
      direction: data.direction as TradeDirection,
      entry: data.entry,
      stopLoss: data.stopLoss,
      targets: data.targets,
      timeframe: data.timeframe,
      riskPct: data.riskPct ?? null,
      note: data.note ?? null,
      tags: data.tags ?? [],
    },
  });

  // Update message content summary
  const content = `${data.direction} ${data.instrument} @ ${data.entry}`;
  const result = await db.message.update({
    where: { id: messageId },
    data: { content, isEdited: true },
    include: messageInclude,
  });

  // Fire-and-forget badge re-evaluation if trade card has an associated trade
  const trade = await db.trade.findUnique({
    where: { tradeCardId: message.tradeCard.id },
    select: { userId: true },
  });
  if (trade) {
    evaluateUserBadges(trade.userId).catch((err) =>
      console.error("Badge evaluation error after card edit:", err)
    );
  }

  return result;
}

export async function getTradeCardWithVersions(messageId: string) {
  const message = await db.message.findUnique({
    where: { id: messageId },
    include: {
      ...messageInclude,
      tradeCard: {
        include: {
          versions: {
            orderBy: { editedAt: "desc" },
            take: 10,
          },
          trade: {
            include: {
              statusHistory: {
                orderBy: { createdAt: "desc" },
                take: 20,
              },
            },
          },
        },
      },
    },
  });

  if (!message) {
    throw new MessageServiceError("Message not found", "NOT_FOUND", 404);
  }

  return message;
}
