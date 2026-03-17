import { db } from "@/lib/db";
import { getIO } from "@/lib/socket-io-global";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { log } from "@/lib/audit";

export const CLOSE_TOLERANCE_PIPS = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeMessageForSocket(message: any, clanId: string) {
  const tc = message.tradeCard;
  const trade = tc?.trade;
  return {
    id: message.id,
    clanId,
    topicId: message.topicId || null,
    content: message.content,
    images: [],
    type: message.type || "TRADE_CARD",
    isPinned: message.isPinned,
    isEdited: message.isEdited,
    reactions: null,
    replyTo: message.replyTo,
    createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt,
    user: message.user,
    tradeCard: tc
      ? {
          id: tc.id,
          instrument: tc.instrument,
          direction: tc.direction,
          entry: tc.entry,
          stopLoss: tc.stopLoss,
          targets: tc.targets,
          timeframe: tc.timeframe,
          riskPct: tc.riskPct,
          note: tc.note,
          tags: tc.tags,
          cardType: tc.cardType,
          trade: trade
            ? {
                id: trade.id,
                status: trade.status,
                userId: trade.userId,
                mtLinked: trade.mtLinked,
                riskStatus: trade.riskStatus,
                initialRiskAbs: trade.initialRiskAbs,
                initialEntry: trade.initialEntry,
                officialEntryPrice: trade.officialEntryPrice,
                officialInitialRiskAbs: trade.officialInitialRiskAbs,
                officialInitialTargets: trade.officialInitialTargets,
                officialInitialStopLoss: trade.officialInitialStopLoss,
                statementEligible: trade.statementEligible,
                integrityStatus: trade.integrityStatus,
                cardType: trade.cardType,
                finalRR: trade.finalRR,
                netProfit: trade.netProfit,
                closePrice: trade.closePrice,
              }
            : null,
        }
      : null,
  };
}

export function topicRoom(clanId: string, topicId: string) {
  return `topic:${clanId}:${topicId}`;
}

export function clanRoom(clanId: string) {
  return `clan:${clanId}`;
}

export const messageInclude = {
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
      trade: {
        select: {
          id: true, status: true, userId: true, mtLinked: true,
          riskStatus: true, initialRiskAbs: true, initialEntry: true,
          officialEntryPrice: true, officialInitialRiskAbs: true, officialInitialTargets: true, officialInitialStopLoss: true,
          statementEligible: true, integrityStatus: true, cardType: true,
          finalRR: true, netProfit: true, closePrice: true,
        },
      },
    },
  },
} as const;

export async function createSystemMessage(
  clanId: string,
  topicId: string | null,
  userId: string,
  content: string,
  replyToId?: string
) {
  return db.message.create({
    data: {
      clanId,
      topicId,
      userId,
      content,
      type: "TRADE_ACTION",
      ...(replyToId ? { replyToId } : {}),
    },
    include: messageInclude,
  });
}

export async function broadcastMessages(
  clanId: string,
  topicId: string | null,
  systemMsg: Awaited<ReturnType<typeof createSystemMessage>>,
  tradeCardMessageId: string
) {
  const io = getIO();
  if (!io) return;

  const serialized = serializeMessageForSocket(systemMsg, clanId);

  // Broadcast to both topic and clan rooms for resilience
  // (client deduplicates if socket is in both rooms)
  if (topicId) {
    io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, serialized);
  }
  io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, serialized);

  // Re-fetch and emit MESSAGE_EDITED so clients update the trade card inline
  try {
    const updatedMessage = await db.message.findUnique({
      where: { id: tradeCardMessageId },
      include: messageInclude,
    });
    if (updatedMessage) {
      const editSerialized = serializeMessageForSocket(updatedMessage, clanId);
      if (topicId) {
        io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.MESSAGE_EDITED, editSerialized);
      }
      io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.MESSAGE_EDITED, editSerialized);
    }
  } catch (err) {
    log("ea_signal.broadcast_refetch_error", "ERROR", "EA", { error: String(err) });
  }
}
