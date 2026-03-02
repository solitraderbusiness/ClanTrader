import { log } from "../audit";
import {
  sendTradeCardSchema,
  editTradeCardSchema,
  updateTradeStatusSchema,
  tradeActionSchema,
} from "../validators";
import { SOCKET_EVENTS } from "../chat-constants";
import {
  requireClanMembership,
  MessageServiceError,
} from "@/services/message.service";
import { createTradeCardMessage, editTradeCard } from "@/services/trade-card.service";
import { trackTrade, updateTradeStatus } from "@/services/trade.service";
import { maybeAutoPost } from "@/services/auto-post.service";
import { executeTradeAction } from "@/services/trade-action.service";
import type { TradeActionKey } from "@/lib/trade-action-constants";
import { db } from "@/lib/db";
import type { HandlerContext, SerializableMessage } from "./shared";
import {
  clanRoom,
  topicRoom,
  serializeMessage,
  checkRateLimit,
} from "./shared";

export function registerTradeHandlers(ctx: HandlerContext) {
  const { io, socket, user } = ctx;

  // --- SEND TRADE CARD ---
  socket.on(SOCKET_EVENTS.SEND_TRADE_CARD, async (data: unknown) => {
    try {
      const parsed = sendTradeCardSchema.safeParse(data);
      if (!parsed.success) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.SEND_TRADE_CARD,
          message: "Invalid trade card data",
        });
        return;
      }

      const { clanId: tcClanId, topicId: tcTopicId, cardType: tcCardType, ...cardData } = parsed.data;

      const isLimited = await checkRateLimit(user.id);
      if (isLimited) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.SEND_TRADE_CARD,
          message: "You are sending messages too fast. Please slow down.",
        });
        return;
      }

      const membership = await requireClanMembership(user.id, tcClanId);

      // Permission: ANALYSIS → any member; SIGNAL → leaders only
      if (tcCardType === "SIGNAL" && !["LEADER", "CO_LEADER"].includes(membership.role)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.SEND_TRADE_CARD,
          message: "Only leaders can send signal cards",
        });
        return;
      }

      const message = await createTradeCardMessage(tcClanId, tcTopicId, user.id, {
        ...cardData,
        cardType: tcCardType,
      });

      if (!message.tradeCard) return;

      // Auto-create Trade record (manual — not statement-eligible)
      await db.trade.create({
        data: {
          tradeCardId: message.tradeCard.id,
          clanId: tcClanId,
          userId: user.id,
          status: "OPEN",
          integrityStatus: "UNVERIFIED",
          resolutionSource: "MANUAL",
          statementEligible: false,
          cardType: tcCardType,
          lastEvaluatedAt: new Date(),
          initialEntry: cardData.entry,
          initialStopLoss: cardData.stopLoss,
          initialTakeProfit: cardData.targets[0] ?? 0,
          initialRiskAbs: cardData.stopLoss > 0 ? Math.abs(cardData.entry - cardData.stopLoss) : 0,
          initialRiskMissing: cardData.stopLoss <= 0,
        },
      });

      // Re-fetch message with trade included
      const fullMessage = await db.message.findUnique({
        where: { id: message.id },
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
              trade: { select: { id: true, status: true, userId: true } },
            },
          },
        },
      });

      if (fullMessage) {
        io.to(topicRoom(tcClanId, tcTopicId)).emit(
          SOCKET_EVENTS.RECEIVE_MESSAGE,
          serializeMessage(fullMessage as unknown as SerializableMessage, tcClanId)
        );
      }

      // Auto-post only for SIGNAL cards
      if (tcCardType !== "ANALYSIS") {
        maybeAutoPost(message.tradeCard.id, tcClanId, user.id).catch(() => {});
      }
    } catch (error) {
      log("chat.send_trade_card_error", "ERROR", "CHAT", { error: String(error) }, user.id);
      socket.emit(SOCKET_EVENTS.ERROR, {
        event: SOCKET_EVENTS.SEND_TRADE_CARD,
        message:
          error instanceof MessageServiceError
            ? error.message
            : "Failed to send trade card",
      });
    }
  });

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
}
