import type { Server, Socket } from "socket.io";
import type { SocketUser } from "./socket-auth";
import { redis } from "./redis";
import { sendMessageSchema, pinMessageSchema } from "./validators";
import {
  SOCKET_EVENTS,
  MESSAGE_RATE_LIMIT,
  MESSAGE_RATE_WINDOW,
  PRESENCE_TTL,
} from "./chat-constants";
import {
  createMessage,
  pinMessage,
  unpinMessage,
  requireClanMembership,
  MessageServiceError,
} from "@/services/message.service";

function getUser(socket: Socket): SocketUser {
  return (socket as Socket & { user: SocketUser }).user;
}

const presenceKey = (clanId: string) => `chat:presence:${clanId}`;
const rateLimitKey = (userId: string) => `chat:ratelimit:${userId}`;

export function registerSocketHandlers(io: Server, socket: Socket) {
  const user = getUser(socket);
  const joinedClans = new Set<string>();

  // --- JOIN CLAN CHAT ---
  socket.on(SOCKET_EVENTS.JOIN_CLAN, async (clanId: string) => {
    try {
      await requireClanMembership(user.id, clanId);

      socket.join(clanId);
      joinedClans.add(clanId);

      await redis.hset(
        presenceKey(clanId),
        user.id,
        JSON.stringify({ name: user.name, joinedAt: Date.now() })
      );
      await redis.expire(presenceKey(clanId), PRESENCE_TTL);

      const onlineUsers = await getOnlineUsers(clanId);
      io.to(clanId).emit(SOCKET_EVENTS.PRESENCE_UPDATE, onlineUsers);
    } catch (error) {
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
    socket.leave(clanId);
    joinedClans.delete(clanId);
    await removePresence(clanId, user.id);
    const onlineUsers = await getOnlineUsers(clanId);
    io.to(clanId).emit(SOCKET_EVENTS.PRESENCE_UPDATE, onlineUsers);
  });

  // --- SEND MESSAGE ---
  socket.on(
    SOCKET_EVENTS.SEND_MESSAGE,
    async (data: { clanId: string; content: string }) => {
      try {
        const parsed = sendMessageSchema.safeParse(data);
        if (!parsed.success) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.SEND_MESSAGE,
            message: "Invalid message",
          });
          return;
        }

        const { clanId, content } = parsed.data;

        const isLimited = await checkRateLimit(user.id);
        if (isLimited) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            event: SOCKET_EVENTS.SEND_MESSAGE,
            message: "You are sending messages too fast. Please slow down.",
          });
          return;
        }

        await requireClanMembership(user.id, clanId);

        const message = await createMessage(clanId, user.id, content);

        io.to(clanId).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, {
          id: message.id,
          clanId,
          content: message.content,
          isPinned: message.isPinned,
          createdAt: message.createdAt.toISOString(),
          user: message.user,
        });
      } catch (error) {
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
        io.to(parsed.data.clanId).emit(SOCKET_EVENTS.MESSAGE_PINNED, {
          id: pinned.id,
          clanId: parsed.data.clanId,
          content: pinned.content,
          isPinned: true,
          createdAt: pinned.createdAt.toISOString(),
          user: pinned.user,
        });
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

        await unpinMessage(
          parsed.data.messageId,
          parsed.data.clanId,
          user.id
        );
        io.to(parsed.data.clanId).emit(SOCKET_EVENTS.MESSAGE_UNPINNED, {
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
    socket.to(clanId).emit(SOCKET_EVENTS.USER_TYPING, {
      userId: user.id,
      name: user.name,
    });
  });

  // --- STOP TYPING ---
  socket.on(SOCKET_EVENTS.STOP_TYPING, (clanId: string) => {
    socket.to(clanId).emit(SOCKET_EVENTS.USER_STOP_TYPING, {
      userId: user.id,
    });
  });

  // --- DISCONNECT ---
  socket.on("disconnect", async () => {
    for (const clanId of joinedClans) {
      await removePresence(clanId, user.id);
      const onlineUsers = await getOnlineUsers(clanId);
      io.to(clanId).emit(SOCKET_EVENTS.PRESENCE_UPDATE, onlineUsers);
    }
  });
}

async function removePresence(clanId: string, userId: string) {
  await redis.hdel(presenceKey(clanId), userId);
}

async function getOnlineUsers(
  clanId: string
): Promise<Array<{ id: string; name: string | null }>> {
  const data = await redis.hgetall(presenceKey(clanId));
  return Object.entries(data).map(([userId, json]) => {
    const parsed = JSON.parse(json);
    return { id: userId, name: parsed.name };
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
