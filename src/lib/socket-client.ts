import { io, Socket } from "socket.io-client";
import { SOCKET_EVENTS } from "./chat-constants";

let socket: Socket | null = null;

/**
 * Tracks rooms the socket is currently subscribed to, so we can
 * re-join them automatically after a reconnect (e.g. laptop wake).
 */
const joinedRooms: Map<string, { clanId: string; topicId?: string }> =
  new Map();

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/api/socketio",
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    // On every (re)connect, re-join all tracked rooms
    socket.on("connect", () => {
      joinedRooms.forEach((room) => {
        socket!.emit(SOCKET_EVENTS.JOIN_CLAN, room);
      });
    });

    // When the tab becomes visible after sleep/background, check connection
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && socket) {
          if (socket.disconnected) {
            socket.connect();
          }
        }
      });
    }
  }
  return socket;
}

/**
 * Call this instead of socket.emit(JOIN_CLAN) directly so the room
 * is tracked for automatic re-join on reconnect.
 */
export function joinRoom(clanId: string, topicId?: string) {
  const key = topicId ? `${clanId}:${topicId}` : clanId;
  joinedRooms.set(key, { clanId, topicId });
  const s = getSocket();
  s.emit(SOCKET_EVENTS.JOIN_CLAN, { clanId, topicId });
}

/**
 * Stop tracking a room (called on LEAVE_CLAN / unmount).
 */
export function leaveRoom(clanId: string, topicId?: string) {
  const key = topicId ? `${clanId}:${topicId}` : clanId;
  joinedRooms.delete(key);
}

export function disconnectSocket() {
  if (socket) {
    joinedRooms.clear();
    socket.disconnect();
    socket = null;
  }
}
