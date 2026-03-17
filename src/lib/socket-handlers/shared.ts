import type { Server, Socket } from "socket.io";
import type { SocketUser } from "../socket-auth";
import { redis } from "../redis";
import { db } from "@/lib/db";
import { getDisplayPrices } from "@/services/price-pool.service";
import {
  SOCKET_EVENTS,
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW,
} from "../chat-constants";
import { getFrozenEntry, getFrozenRiskAbs, calculateTargetRR } from "@/lib/risk-utils";

export interface HandlerContext {
  io: Server;
  socket: Socket;
  user: SocketUser;
  joinedClans: Set<string>;
  joinedTopics: Map<string, string>;
}

export function getUser(socket: Socket): SocketUser {
  return (socket as Socket & { user: SocketUser }).user;
}

export const presenceKey = (clanId: string) => `chat:presence:${clanId}`;
const rateLimitKey = (userId: string) => `chat:ratelimit:${userId}`;
export const clanRoom = (clanId: string) => `clan:${clanId}`;
export const topicRoom = (clanId: string, topicId: string) => `topic:${clanId}:${topicId}`;

export interface SerializableTradeCard {
  id: string;
  instrument: string;
  direction: string;
  entry: number;
  stopLoss: number;
  targets: number[];
  timeframe: string;
  riskPct: number | null;
  note: string | null;
  tags: string[];
  cardType?: string;
  trade: {
    id: string;
    status: string;
    userId: string;
    mtLinked?: boolean;
    riskStatus?: string;
    finalRR?: number | null;
    netProfit?: number | null;
    closePrice?: number | null;
    initialRiskAbs?: number | null;
    initialEntry?: number | null;
    integrityStatus?: string;
    statementEligible?: boolean;
  } | null;
}

export interface SerializableMessage {
  id: string;
  content: string;
  images?: string[];
  type?: string;
  isPinned: boolean;
  isEdited: boolean;
  reactions: unknown;
  createdAt: Date;
  topicId?: string | null;
  replyTo: { id: string; content: string; user: { id: string; name: string | null } } | null;
  user: { id: string; name: string | null; username?: string | null; avatar: string | null; role?: string };
  tradeCard?: SerializableTradeCard | null;
}

export function serializeMessage(message: SerializableMessage, clanId: string) {
  return {
    id: message.id,
    clanId,
    topicId: message.topicId || null,
    content: message.content,
    images: message.images || [],
    type: message.type || "TEXT",
    isPinned: message.isPinned,
    isEdited: message.isEdited,
    reactions: (message.reactions as Record<string, string[]>) || null,
    replyTo: message.replyTo,
    createdAt: message.createdAt.toISOString(),
    user: message.user,
    tradeCard: message.tradeCard
      ? {
          id: message.tradeCard.id,
          instrument: message.tradeCard.instrument,
          direction: message.tradeCard.direction,
          entry: message.tradeCard.entry,
          stopLoss: message.tradeCard.stopLoss,
          targets: message.tradeCard.targets,
          timeframe: message.tradeCard.timeframe,
          riskPct: message.tradeCard.riskPct,
          note: message.tradeCard.note,
          tags: message.tradeCard.tags,
          cardType: message.tradeCard.cardType,
          trade: message.tradeCard.trade,
        }
      : null,
  };
}

export async function sendInitialPnl(socket: Socket, clanId: string, topicId: string) {
  try {
    const openTrades = await db.trade.findMany({
      where: { clanId, status: "OPEN" },
      select: {
        id: true,
        initialEntry: true,
        initialRiskAbs: true,
        officialEntryPrice: true,
        officialInitialRiskAbs: true,
        riskStatus: true,
        mtTradeMatches: {
          where: { isOpen: true },
          select: { symbol: true, profit: true, commission: true, swap: true },
          take: 1,
        },
        tradeCard: {
          select: {
            entry: true,
            stopLoss: true,
            direction: true,
            instrument: true,
            targets: true,
            message: { select: { id: true, topicId: true } },
          },
        },
      },
    });

    const topicTrades = openTrades.filter(
      (t) => t.tradeCard?.message?.topicId === topicId
    );
    if (topicTrades.length === 0) return;

    // Collect MT symbols + card instruments to look up cached prices
    const symbolSet = new Set<string>();
    for (const t of topicTrades) {
      const mtSymbol = t.mtTradeMatches[0]?.symbol?.toUpperCase();
      if (mtSymbol) symbolSet.add(mtSymbol);
      const cardInstrument = t.tradeCard?.instrument?.toUpperCase();
      if (cardInstrument) symbolSet.add(cardInstrument);
    }

    // DISPLAY-GRADE: Read cached prices via display API (cross-source OK for initial load)
    const symbols = [...symbolSet];
    const priceMap = new Map<string, number>();
    if (symbols.length > 0) {
      const resolvedPrices = await getDisplayPrices(symbols);
      for (const [sym, resolved] of resolvedPrices) {
        if (resolved.price) priceMap.set(sym, resolved.price);
      }
    }

    const updates: { tradeId: string; messageId: string; currentRR: number | null; currentPrice: number; targetRR: number | null; riskStatus: string; pricePnl: number; mtProfit?: number }[] = [];

    for (const trade of topicTrades) {
      if (!trade.tradeCard) continue;

      const entry = getFrozenEntry(trade, trade.tradeCard.entry);
      const riskAbs = getFrozenRiskAbs(trade, trade.tradeCard.entry, trade.tradeCard.stopLoss);

      const mtSymbol = trade.mtTradeMatches[0]?.symbol?.toUpperCase();
      const cardSymbol = trade.tradeCard.instrument?.toUpperCase();
      const currentPrice = (mtSymbol ? priceMap.get(mtSymbol) : undefined)
        ?? (cardSymbol ? priceMap.get(cardSymbol) : undefined);
      if (!currentPrice) continue;

      const dir = trade.tradeCard.direction === "LONG" ? 1 : -1;
      const pricePnl = dir * (currentPrice - entry);
      const isUnprotected = trade.riskStatus === "UNPROTECTED";
      const currentRR = (!isUnprotected && riskAbs > 0)
        ? Math.round(((dir * (currentPrice - entry)) / riskAbs) * 100) / 100
        : null;

      const targetRR = (!isUnprotected && riskAbs > 0)
        ? calculateTargetRR(trade.tradeCard.targets[0], entry, riskAbs)
        : null;

      // Get actual MT dollar profit if linked
      const mtMatch = trade.mtTradeMatches[0];
      const mtProfit = mtMatch
        ? Math.round(((mtMatch.profit ?? 0) + (mtMatch.commission ?? 0) + (mtMatch.swap ?? 0)) * 100) / 100
        : undefined;

      updates.push({
        tradeId: trade.id,
        messageId: trade.tradeCard.message.id,
        currentRR,
        currentPrice,
        targetRR,
        riskStatus: trade.riskStatus,
        pricePnl,
        ...(mtProfit != null ? { mtProfit } : {}),
      });
    }

    if (updates.length > 0) {
      socket.emit(SOCKET_EVENTS.TRADE_PNL_UPDATE, { updates });
    }
  } catch {
    // Non-critical — PnL will arrive on next heartbeat
  }
}

export async function removePresence(clanId: string, userId: string) {
  await redis.hdel(presenceKey(clanId), userId);
}

export async function getOnlineUsers(
  clanId: string
): Promise<Array<{ id: string; name: string | null; role?: string }>> {
  const data = await redis.hgetall(presenceKey(clanId));
  return Object.entries(data).map(([userId, json]) => {
    const parsed = JSON.parse(json);
    return { id: userId, name: parsed.name, role: parsed.role };
  });
}

export async function checkRateLimit(userId: string): Promise<boolean> {
  const key = rateLimitKey(userId);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, MESSAGE_RATE_WINDOW);
  }
  return count > MESSAGE_RATE_LIMIT;
}
