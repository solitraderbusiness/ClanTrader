import type { Server, Socket } from "socket.io";
import type { SocketUser } from "./socket-auth";
import { log } from "./audit";
import { redis } from "./redis";
import {
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  pinMessageSchema,
  reactMessageSchema,
  editTradeCardSchema,
  updateTradeStatusSchema,
  tradeActionSchema,
} from "./validators";
import {
  SOCKET_EVENTS,
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW,
  PRESENCE_TTL,
  DM_CONTENT_MAX,
} from "./chat-constants";
import {
  createMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  pinMessage,
  unpinMessage,
  requireClanMembership,
  MessageServiceError,
} from "@/services/message.service";
import { getDefaultTopic } from "@/services/topic.service";
import { editTradeCard } from "@/services/trade-card.service";
import { trackTrade, updateTradeStatus } from "@/services/trade.service";
import { executeTradeAction } from "@/services/trade-action.service";
import type { TradeActionKey } from "@/lib/trade-action-constants";
import { db } from "@/lib/db";

function getUser(socket: Socket): SocketUser {
  return (socket as Socket & { user: SocketUser }).user;
}

const presenceKey = (clanId: string) => `chat:presence:${clanId}`;
const rateLimitKey = (userId: string) => `chat:ratelimit:${userId}`;
const clanRoom = (clanId: string) => `clan:${clanId}`;
const topicRoom = (clanId: string, topicId: string) => `topic:${clanId}:${topicId}`;

interface SerializableTradeCard {
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

interface SerializableMessage {
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

function serializeMessage(message: SerializableMessage, clanId: string) {
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
          trade: message.tradeCard.trade,
        }
      : null,
  };
}

async function sendInitialPnl(socket: Socket, clanId: string, topicId: string) {
  try {
    const openTrades = await db.trade.findMany({
      where: { clanId, status: "OPEN" },
      select: {
        id: true,
        initialEntry: true,
        initialRiskAbs: true,
        riskStatus: true,
        mtTradeMatches: {
          where: { isOpen: true },
          select: { symbol: true },
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

    // Collect MT symbols to look up cached prices
    const symbolSet = new Set<string>();
    for (const t of topicTrades) {
      const mtSymbol = t.mtTradeMatches[0]?.symbol?.toUpperCase();
      if (mtSymbol) symbolSet.add(mtSymbol);
    }

    // Read cached prices from Redis using the broker symbol (e.g. XAUUSD_L)
    const symbols = [...symbolSet];
    const priceMap = new Map<string, number>();
    if (symbols.length > 0) {
      const priceKeys = symbols.map((s) => `price:${s}`);
      const priceValues = await redis.mget(...priceKeys);
      for (let i = 0; i < symbols.length; i++) {
        if (priceValues[i]) {
          try {
            const parsed = JSON.parse(priceValues[i]!) as { price: number };
            priceMap.set(symbols[i], parsed.price);
          } catch { /* skip */ }
        }
      }
    }

    const updates: { tradeId: string; messageId: string; currentRR: number; currentPrice: number; targetRR: number | null; riskStatus: string }[] = [];

    for (const trade of topicTrades) {
      if (!trade.tradeCard) continue;

      // Compute risk: prefer initialRiskAbs, fall back to card entry/SL
      const entry = trade.initialEntry ?? trade.tradeCard.entry;
      const riskAbs = (trade.initialRiskAbs && trade.initialRiskAbs > 0)
        ? trade.initialRiskAbs
        : Math.abs(entry - trade.tradeCard.stopLoss);
      if (riskAbs <= 0) continue;

      // Look up cached price from Redis using broker symbol
      const mtSymbol = trade.mtTradeMatches[0]?.symbol?.toUpperCase();
      const currentPrice = mtSymbol ? priceMap.get(mtSymbol) : undefined;
      if (!currentPrice) continue;

      const dir = trade.tradeCard.direction === "LONG" ? 1 : -1;
      const currentRR = (dir * (currentPrice - entry)) / riskAbs;

      const tp = trade.tradeCard.targets[0];
      const targetRR = tp && tp > 0
        ? Math.round((Math.abs(tp - entry) / riskAbs) * 100) / 100
        : null;

      updates.push({
        tradeId: trade.id,
        messageId: trade.tradeCard.message.id,
        currentRR: Math.round(currentRR * 100) / 100,
        currentPrice,
        targetRR,
        riskStatus: trade.riskStatus,
      });
    }

    if (updates.length > 0) {
      socket.emit(SOCKET_EVENTS.TRADE_PNL_UPDATE, { updates });
    }
  } catch {
    // Non-critical — PnL will arrive on next heartbeat
  }
}

export function registerSocketHandlers(io: Server, socket: Socket) {
  const user = getUser(socket);
  const joinedClans = new Set<string>();
  const joinedTopics = new Map<string, string>(); // clanId -> topicId

  // Ensure Redis is connected (lazyConnect: true requires explicit connect)
  if (redis.status === "wait") {
    redis.connect().catch((err: unknown) => log("chat.redis_connect_error", "ERROR", "CHAT", { error: String(err) }));
  }

  // --- JOIN CLAN CHAT ---
  socket.on(SOCKET_EVENTS.JOIN_CLAN, async (data: string | { clanId: string; topicId?: string }) => {
    try {
      const clanId = typeof data === "string" ? data : data.clanId;
      const requestedTopicId = typeof data === "string" ? undefined : data.topicId;

      await requireClanMembership(user.id, clanId);

      // Join clan room
      socket.join(clanRoom(clanId));
      joinedClans.add(clanId);

      // Join default or requested topic room
      const topicId = requestedTopicId || (await getDefaultTopic(clanId)).id;
      socket.join(topicRoom(clanId, topicId));
      joinedTopics.set(clanId, topicId);

      await redis.hset(
        presenceKey(clanId),
        user.id,
        JSON.stringify({ name: user.name, role: user.role, joinedAt: Date.now() })
      );
      await redis.expire(presenceKey(clanId), PRESENCE_TTL);

      const onlineUsers = await getOnlineUsers(clanId);
      io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, onlineUsers);

      // Send initial PnL snapshot so trade cards show Live R:R immediately
      sendInitialPnl(socket, clanId, topicId).catch(() => {});
    } catch (error) {
      log("chat.join_clan_error", "ERROR", "CHAT", { error: String(error) }, user.id);
      socket.emit(SOCKET_EVENTS.ERROR, {
        event: SOCKET_EVENTS.JOIN_CLAN,
        message:
          error instanceof MessageServiceError
            ? error.message
            : "Failed to join chat",
      });
    }
  });

  // --- LEAVE CLAN CHAT ---
  socket.on(SOCKET_EVENTS.LEAVE_CLAN, async (clanId: string) => {
    socket.leave(clanRoom(clanId));
    // Leave topic room if any
    const currentTopicId = joinedTopics.get(clanId);
    if (currentTopicId) {
      socket.leave(topicRoom(clanId, currentTopicId));
      joinedTopics.delete(clanId);
    }
    joinedClans.delete(clanId);
    await removePresence(clanId, user.id);
    const onlineUsers = await getOnlineUsers(clanId);
    io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, onlineUsers);
  });

  // --- SWITCH TOPIC ---
  socket.on(
    SOCKET_EVENTS.SWITCH_TOPIC,
    async (data: { clanId: string; fromTopicId: string; toTopicId: string }) => {
      try {
        const { clanId, fromTopicId, toTopicId } = data;
        socket.leave(topicRoom(clanId, fromTopicId));
        socket.join(topicRoom(clanId, toTopicId));
        joinedTopics.set(clanId, toTopicId);

        sendInitialPnl(socket, clanId, toTopicId).catch(() => {});
      } catch (error) {
        log("chat.switch_topic_error", "ERROR", "CHAT", { error: String(error) }, user.id);
      }
    }
  );

  // --- SEND MESSAGE ---
  socket.on(
    SOCKET_EVENTS.SEND_MESSAGE,
    async (data: { clanId: string; topicId: string; content: string; replyToId?: string; images?: string[] }) => {
      try {
        const parsed = sendMessageSchema.safeParse(data);
        if (!parsed.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.SEND_MESSAGE,
            message: "Invalid message",
          });
          return;
        }

        const { clanId, topicId, content, replyToId, images } = parsed.data;

        const isLimited = await checkRateLimit(user.id);
        if (isLimited) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.SEND_MESSAGE,
            message: "You are sending messages too fast. Please slow down.",
          });
          return;
        }

        await requireClanMembership(user.id, clanId);

        const message = await createMessage(clanId, user.id, content, topicId, { replyToId, images });

        io.to(topicRoom(clanId, topicId)).emit(
          SOCKET_EVENTS.RECEIVE_MESSAGE,
          serializeMessage(message, clanId)
        );
      } catch (error) {
        log("chat.send_message_error", "ERROR", "CHAT", { error: String(error) }, user.id);
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.SEND_MESSAGE,
          message:
            error instanceof MessageServiceError
              ? error.message
              : "Failed to send message",
        });
      }
    }
  );

  // --- EDIT MESSAGE ---
  socket.on(
    SOCKET_EVENTS.EDIT_MESSAGE,
    async (data: { messageId: string; clanId: string; content: string }) => {
      try {
        const parsed = editMessageSchema.safeParse(data);
        if (!parsed.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.EDIT_MESSAGE,
            message: "Invalid request",
          });
          return;
        }

        const message = await editMessage(
          parsed.data.messageId,
          parsed.data.clanId,
          user.id,
          parsed.data.content
        );

        const tRoom = message.topicId
          ? topicRoom(parsed.data.clanId, message.topicId)
          : clanRoom(parsed.data.clanId);

        io.to(tRoom).emit(SOCKET_EVENTS.MESSAGE_EDITED, {
          id: message.id,
          clanId: parsed.data.clanId,
          content: message.content,
          isEdited: true,
        });
      } catch (error) {
        log("chat.edit_message_error", "ERROR", "CHAT", { error: String(error) }, user.id);
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.EDIT_MESSAGE,
          message:
            error instanceof MessageServiceError
              ? error.message
              : "Failed to edit message",
        });
      }
    }
  );

  // --- DELETE MESSAGE ---
  socket.on(
    SOCKET_EVENTS.DELETE_MESSAGE,
    async (data: { messageId: string; clanId: string }) => {
      try {
        const parsed = deleteMessageSchema.safeParse(data);
        if (!parsed.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.DELETE_MESSAGE,
            message: "Invalid request",
          });
          return;
        }

        const message = await deleteMessage(parsed.data.messageId, parsed.data.clanId, user.id);

        const tRoom = message.topicId
          ? topicRoom(parsed.data.clanId, message.topicId)
          : clanRoom(parsed.data.clanId);

        io.to(tRoom).emit(SOCKET_EVENTS.MESSAGE_DELETED, {
          id: parsed.data.messageId,
          clanId: parsed.data.clanId,
        });
      } catch (error) {
        log("chat.delete_message_error", "ERROR", "CHAT", { error: String(error) }, user.id);
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.DELETE_MESSAGE,
          message:
            error instanceof MessageServiceError
              ? error.message
              : "Failed to delete message",
        });
      }
    }
  );

  // --- REACT MESSAGE ---
  socket.on(
    SOCKET_EVENTS.REACT_MESSAGE,
    async (data: { messageId: string; clanId: string; emoji: string }) => {
      try {
        const parsed = reactMessageSchema.safeParse(data);
        if (!parsed.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.REACT_MESSAGE,
            message: "Invalid request",
          });
          return;
        }

        const message = await toggleReaction(
          parsed.data.messageId,
          parsed.data.clanId,
          user.id,
          parsed.data.emoji
        );

        const tRoom = message.topicId
          ? topicRoom(parsed.data.clanId, message.topicId)
          : clanRoom(parsed.data.clanId);

        io.to(tRoom).emit(SOCKET_EVENTS.MESSAGE_REACTED, {
          id: message.id,
          clanId: parsed.data.clanId,
          reactions: (message.reactions as Record<string, string[]>) || null,
        });
      } catch (error) {
        log("chat.react_message_error", "ERROR", "CHAT", { error: String(error) }, user.id);
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.REACT_MESSAGE,
          message:
            error instanceof MessageServiceError
              ? error.message
              : "Failed to react",
        });
      }
    }
  );

  // --- PIN MESSAGE ---
  socket.on(
    SOCKET_EVENTS.PIN_MESSAGE,
    async (data: { messageId: string; clanId: string }) => {
      try {
        const parsed = pinMessageSchema.safeParse(data);
        if (!parsed.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.PIN_MESSAGE,
            message: "Invalid request",
          });
          return;
        }

        const pinned = await pinMessage(
          parsed.data.messageId,
          parsed.data.clanId,
          user.id
        );

        const tRoom = pinned.topicId
          ? topicRoom(parsed.data.clanId, pinned.topicId)
          : clanRoom(parsed.data.clanId);

        io.to(tRoom).emit(
          SOCKET_EVENTS.MESSAGE_PINNED,
          serializeMessage(pinned, parsed.data.clanId)
        );
      } catch (error) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.PIN_MESSAGE,
          message:
            error instanceof MessageServiceError
              ? error.message
              : "Failed to pin message",
        });
      }
    }
  );

  // --- UNPIN MESSAGE ---
  socket.on(
    SOCKET_EVENTS.UNPIN_MESSAGE,
    async (data: { messageId: string; clanId: string }) => {
      try {
        const parsed = pinMessageSchema.safeParse(data);
        if (!parsed.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.UNPIN_MESSAGE,
            message: "Invalid request",
          });
          return;
        }

        const msg = await unpinMessage(
          parsed.data.messageId,
          parsed.data.clanId,
          user.id
        );

        const tRoom = msg.topicId
          ? topicRoom(parsed.data.clanId, msg.topicId)
          : clanRoom(parsed.data.clanId);

        io.to(tRoom).emit(SOCKET_EVENTS.MESSAGE_UNPINNED, {
          id: parsed.data.messageId,
          clanId: parsed.data.clanId,
        });
      } catch (error) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.UNPIN_MESSAGE,
          message:
            error instanceof MessageServiceError
              ? error.message
              : "Failed to unpin message",
        });
      }
    }
  );

  // --- EDIT TRADE CARD ---
  socket.on(SOCKET_EVENTS.EDIT_TRADE_CARD, async (data: unknown) => {
    try {
      const parsed = editTradeCardSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.EDIT_TRADE_CARD,
          message: "Invalid trade card data",
        });
        return;
      }

      const { messageId, clanId, ...tradeCardData } = parsed.data;

      await requireClanMembership(user.id, clanId);

      const message = await editTradeCard(messageId, clanId, user.id, tradeCardData);

      const tRoom = message.topicId
        ? topicRoom(clanId, message.topicId)
        : clanRoom(clanId);

      io.to(tRoom).emit(SOCKET_EVENTS.MESSAGE_EDITED, serializeMessage(message, clanId));
    } catch (error) {
      log("chat.edit_trade_card_error", "ERROR", "CHAT", { error: String(error) }, user.id);
      socket.emit(SOCKET_EVENTS.ERROR, {
        event: SOCKET_EVENTS.EDIT_TRADE_CARD,
        message:
          error instanceof MessageServiceError
            ? error.message
            : "Failed to edit trade card",
      });
    }
  });

  // --- TRACK TRADE ---
  socket.on(
    SOCKET_EVENTS.TRACK_TRADE,
    async (data: { messageId: string; clanId: string }) => {
      try {
        const { messageId, clanId } = data;
        if (!messageId || !clanId) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.TRACK_TRADE,
            message: "Invalid request",
          });
          return;
        }

        await requireClanMembership(user.id, clanId);

        const { trade, message } = await trackTrade(messageId, clanId, user.id);

        const tRoom = message.topicId
          ? topicRoom(clanId, message.topicId)
          : clanRoom(clanId);

        io.to(tRoom).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, {
          tradeId: trade.id,
          messageId: message.id,
          status: trade.status,
          trade: { id: trade.id, status: trade.status, userId: trade.userId },
        });
      } catch (error) {
        log("chat.track_trade_error", "ERROR", "CHAT", { error: String(error) }, user.id);
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.TRACK_TRADE,
          message:
            error instanceof MessageServiceError
              ? error.message
              : "Failed to track trade",
        });
      }
    }
  );

  // --- UPDATE TRADE STATUS ---
  socket.on(SOCKET_EVENTS.UPDATE_TRADE_STATUS, async (data: unknown) => {
    try {
      const parsed = updateTradeStatusSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.UPDATE_TRADE_STATUS,
          message: "Invalid request",
        });
        return;
      }

      const { tradeId, clanId, status, note } = parsed.data;

      await requireClanMembership(user.id, clanId);

      const result = await updateTradeStatus(tradeId, clanId, user.id, status, note);

      const tRoom = result.message.topicId
        ? topicRoom(clanId, result.message.topicId)
        : clanRoom(clanId);

      io.to(tRoom).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, {
        tradeId: result.trade.id,
        messageId: result.message.id,
        status: result.trade.status,
        trade: { id: result.trade.id, status: result.trade.status, userId: result.trade.userId },
        history: result.history,
      });
    } catch (error) {
      log("chat.update_trade_status_error", "ERROR", "CHAT", { error: String(error) }, user.id);
      socket.emit(SOCKET_EVENTS.ERROR, {
        event: SOCKET_EVENTS.UPDATE_TRADE_STATUS,
        message:
          error instanceof MessageServiceError
            ? error.message
            : "Failed to update trade status",
      });
    }
  });

  // --- EXECUTE TRADE ACTION ---
  socket.on(SOCKET_EVENTS.EXECUTE_TRADE_ACTION, async (data: unknown) => {
    try {
      const parsed = tradeActionSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.EXECUTE_TRADE_ACTION,
          message: "Invalid trade action data",
        });
        return;
      }

      const { tradeId, clanId, actionType, newValue, note } = parsed.data;

      await requireClanMembership(user.id, clanId);

      const result = await executeTradeAction(
        tradeId,
        clanId,
        user.id,
        actionType as TradeActionKey,
        newValue,
        note
      );

      // MT-linked pending action: emit pending event and return early
      if (result.mtPending && result.pendingAction) {
        const topicId = result.tradeCard.message.topicId;
        if (topicId) {
          io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.EA_ACTION_PENDING, {
            tradeId,
            actionType,
            actionId: result.pendingAction.id,
            expiresAt: result.pendingAction.expiresAt.toISOString(),
          });
        }
        return;
      }

      // Broadcast the TRADE_ACTION message to topic room
      if (result.systemMessage) {
        const topicId = result.tradeCard.message.topicId;
        if (topicId) {
          io.to(topicRoom(clanId, topicId)).emit(
            SOCKET_EVENTS.RECEIVE_MESSAGE,
            serializeMessage(result.systemMessage, clanId)
          );
        }
      }

      // Also emit trade status update if status changed
      if (actionType === "CLOSE" || actionType === "STATUS_CHANGE") {
        const topicId = result.tradeCard.message.topicId;
        if (topicId) {
          const updatedTrade = await (await import("@/services/trade.service")).getTradeById(tradeId);
          io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, {
            tradeId,
            messageId: result.tradeCard.message.id,
            status: updatedTrade.status,
            trade: { id: updatedTrade.id, status: updatedTrade.status, userId: updatedTrade.userId },
          });
        }
      }

      // Emit the action event
      const topicId = result.tradeCard.message.topicId;
      if (topicId) {
        io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.TRADE_ACTION_EXECUTED, {
          tradeId,
          actionType,
          event: result.event,
        });
      }
    } catch (error) {
      log("chat.execute_trade_action_error", "ERROR", "CHAT", { error: String(error) }, user.id);
      socket.emit(SOCKET_EVENTS.ERROR, {
        event: SOCKET_EVENTS.EXECUTE_TRADE_ACTION,
        message:
          error instanceof MessageServiceError
            ? error.message
            : "Failed to execute trade action",
      });
    }
  });

  // --- TYPING ---
  socket.on(SOCKET_EVENTS.TYPING, (clanId: string) => {
    socket.to(clanRoom(clanId)).emit(SOCKET_EVENTS.USER_TYPING, {
      userId: user.id,
      name: user.name,
    });
  });

  // --- STOP TYPING ---
  socket.on(SOCKET_EVENTS.STOP_TYPING, (clanId: string) => {
    socket.to(clanRoom(clanId)).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
      userId: user.id,
    });
  });

  // --- DM: JOIN DM ROOMS ---
  socket.on(SOCKET_EVENTS.JOIN_DM, async (recipientId: string) => {
    try {
      if (!recipientId) return;
      const sorted = [user.id, recipientId].sort();
      const roomName = `dm:${sorted[0]}:${sorted[1]}`;
      socket.join(roomName);
    } catch (error) {
      log("chat.join_dm_error", "ERROR", "CHAT", { error: String(error) }, user.id);
    }
  });

  // --- DM: SEND MESSAGE ---
  socket.on(
    SOCKET_EVENTS.SEND_DM,
    async (data: { recipientId: string; content: string; replyToId?: string; images?: string[] }) => {
      try {
        const { recipientId, content, replyToId, images } = data;
        if (!recipientId || (!content && (!images || images.length === 0)) || (content && content.length > DM_CONTENT_MAX)) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.SEND_DM,
            message: "Invalid message",
          });
          return;
        }

        const isLimited = await checkRateLimit(user.id);
        if (isLimited) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.SEND_DM,
            message: "You are sending messages too fast. Please slow down.",
          });
          return;
        }

        const {
          getOrCreateConversation,
          sendDirectMessage,
        } = await import("@/services/dm.service");

        const conversation = await getOrCreateConversation(user.id, recipientId);
        const message = await sendDirectMessage(
          conversation.id,
          user.id,
          content || "",
          replyToId,
          images
        );

        const sorted = [user.id, recipientId].sort();
        const roomName = `dm:${sorted[0]}:${sorted[1]}`;

        io.to(roomName).emit(SOCKET_EVENTS.RECEIVE_DM, {
          id: message.id,
          conversationId: conversation.id,
          content: message.content,
          senderId: message.senderId,
          isEdited: message.isEdited,
          isRead: message.isRead,
          replyTo: message.replyTo,
          images: message.images || [],
          createdAt: message.createdAt.toISOString(),
          sender: message.sender,
        });
      } catch (error) {
        log("chat.send_dm_error", "ERROR", "CHAT", { error: String(error) }, user.id);
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.SEND_DM,
          message: "Failed to send message",
        });
      }
    }
  );

  // --- DM: EDIT MESSAGE ---
  socket.on(
    SOCKET_EVENTS.EDIT_DM,
    async (data: { messageId: string; recipientId: string; content: string }) => {
      try {
        const { messageId, recipientId, content } = data;
        if (!messageId || !content || content.length > DM_CONTENT_MAX) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.EDIT_DM,
            message: "Invalid request",
          });
          return;
        }

        const { editDirectMessage } = await import("@/services/dm.service");
        const message = await editDirectMessage(messageId, user.id, content);

        const sorted = [user.id, recipientId].sort();
        const roomName = `dm:${sorted[0]}:${sorted[1]}`;

        io.to(roomName).emit(SOCKET_EVENTS.DM_EDITED, {
          id: message.id,
          content: message.content,
          isEdited: true,
        });
      } catch (error) {
        log("chat.edit_dm_error", "ERROR", "CHAT", { error: String(error) }, user.id);
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.EDIT_DM,
          message: "Failed to edit message",
        });
      }
    }
  );

  // --- DM: DELETE MESSAGE ---
  socket.on(
    SOCKET_EVENTS.DELETE_DM,
    async (data: { messageId: string; recipientId: string }) => {
      try {
        const { messageId, recipientId } = data;
        if (!messageId) return;

        const { deleteDirectMessage } = await import("@/services/dm.service");
        await deleteDirectMessage(messageId, user.id);

        const sorted = [user.id, recipientId].sort();
        const roomName = `dm:${sorted[0]}:${sorted[1]}`;

        io.to(roomName).emit(SOCKET_EVENTS.DM_DELETED, {
          id: messageId,
        });
      } catch (error) {
        log("chat.delete_dm_error", "ERROR", "CHAT", { error: String(error) }, user.id);
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.DELETE_DM,
          message: "Failed to delete message",
        });
      }
    }
  );

  // --- DM: TYPING ---
  socket.on(SOCKET_EVENTS.DM_TYPING, (recipientId: string) => {
    const sorted = [user.id, recipientId].sort();
    const roomName = `dm:${sorted[0]}:${sorted[1]}`;
    socket.to(roomName).emit(SOCKET_EVENTS.DM_USER_TYPING, {
      userId: user.id,
      name: user.name,
    });
  });

  // --- DM: STOP TYPING ---
  socket.on(SOCKET_EVENTS.DM_STOP_TYPING, (recipientId: string) => {
    const sorted = [user.id, recipientId].sort();
    const roomName = `dm:${sorted[0]}:${sorted[1]}`;
    socket.to(roomName).emit(SOCKET_EVENTS.DM_USER_STOP_TYPING, {
      userId: user.id,
    });
  });

  // --- DM: MARK READ ---
  socket.on(SOCKET_EVENTS.DM_READ, async (recipientId: string) => {
    try {
      const {
        getOrCreateConversation,
        markConversationRead,
      } = await import("@/services/dm.service");
      const conversation = await getOrCreateConversation(user.id, recipientId);
      await markConversationRead(conversation.id, user.id);

      const sorted = [user.id, recipientId].sort();
      const roomName = `dm:${sorted[0]}:${sorted[1]}`;
      io.to(roomName).emit(SOCKET_EVENTS.DM_MARKED_READ, {
        userId: user.id,
        conversationId: conversation.id,
      });
    } catch (error) {
      log("chat.dm_read_error", "ERROR", "CHAT", { error: String(error) }, user.id);
    }
  });

  // --- DISCONNECT ---
  socket.on("disconnect", async () => {
    for (const clanId of joinedClans) {
      await removePresence(clanId, user.id);
      const onlineUsers = await getOnlineUsers(clanId);
      io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, onlineUsers);
    }
  });
}

async function removePresence(clanId: string, userId: string) {
  await redis.hdel(presenceKey(clanId), userId);
}

async function getOnlineUsers(
  clanId: string
): Promise<Array<{ id: string; name: string | null; role?: string }>> {
  const data = await redis.hgetall(presenceKey(clanId));
  return Object.entries(data).map(([userId, json]) => {
    const parsed = JSON.parse(json);
    return { id: userId, name: parsed.name, role: parsed.role };
  });
}

async function checkRateLimit(userId: string): Promise<boolean> {
  const key = rateLimitKey(userId);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, MESSAGE_RATE_WINDOW);
  }
  return count > MESSAGE_RATE_LIMIT;
}
