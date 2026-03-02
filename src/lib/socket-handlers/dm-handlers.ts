import { log } from "../audit";
import { SOCKET_EVENTS, DM_CONTENT_MAX } from "../chat-constants";
import type { HandlerContext } from "./shared";
import { checkRateLimit } from "./shared";

export function registerDmHandlers(ctx: HandlerContext) {
  const { io, socket, user } = ctx;

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
}
