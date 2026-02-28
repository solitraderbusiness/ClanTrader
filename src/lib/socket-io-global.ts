import type { Server } from "socket.io";

export function setIO(io: Server) {
  (globalThis as Record<string, unknown>).__socketio = io;
}

export function getIO(): Server | null {
  return ((globalThis as Record<string, unknown>).__socketio as Server) ?? null;
}
