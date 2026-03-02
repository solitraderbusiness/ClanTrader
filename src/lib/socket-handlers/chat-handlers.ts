import { redis } from "../redis";
import { log } from "../audit";
import {
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  pinMessageSchema,
  reactMessageSchema,
} from "../validators";
import { SOCKET_EVENTS, PRESENCE_TTL } from "../chat-constants";
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
import type { HandlerContext } from "./shared";
import {
  presenceKey,
  clanRoom,
  topicRoom,
  serializeMessage,
  sendInitialPnl,
  removePresence,
  getOnlineUsers,
  checkRateLimit,
} from "./shared";

export function registerChatHandlers(ctx: HandlerContext) {
  const { io, socket, user, joinedClans, joinedTopics } = ctx;

  // --- JOIN CLAN CHAT ---
  socket.on(SOCKET_EVENTS.JOIN_CLAN, async (data: string | { clanId: string; topicId?: string }) => {
    try {
      const clanId = typeof data === "string" ? data : data.clanId;
      const requestedTopicId = typeof data === "string" ? undefined : data.topicId;

      await requireClanMembership(user.id, clanId);

      socket.join(clanRoom(clanId));
      joinedClans.add(clanId);

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

  // --- DISCONNECT ---
  socket.on("disconnect", async () => {
    for (const clanId of joinedClans) {
      await removePresence(clanId, user.id);
      const onlineUsers = await getOnlineUsers(clanId);
      io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.PRESENCE_UPDATE, onlineUsers);
    }
  });
}
