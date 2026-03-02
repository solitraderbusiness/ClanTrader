import type { Server, Socket } from "socket.io";
import { log } from "../audit";
import { redis } from "../redis";
import { getUser } from "./shared";
import { registerChatHandlers } from "./chat-handlers";
import { registerDmHandlers } from "./dm-handlers";
import { registerTradeHandlers } from "./trade-handlers";

export function registerSocketHandlers(io: Server, socket: Socket) {
  const user = getUser(socket);
  const joinedClans = new Set<string>();
  const joinedTopics = new Map<string, string>();

  // Ensure Redis is connected (lazyConnect: true requires explicit connect)
  if (redis.status === "wait") {
    redis.connect().catch((err: unknown) => log("chat.redis_connect_error", "ERROR", "CHAT", { error: String(err) }));
  }

  const ctx = { io, socket, user, joinedClans, joinedTopics };

  registerChatHandlers(ctx);
  registerTradeHandlers(ctx);
  registerDmHandlers(ctx);
}
