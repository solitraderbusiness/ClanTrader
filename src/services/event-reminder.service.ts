import type { Server } from "socket.io";
import { redis } from "@/lib/redis";
import { getEventsInWindow } from "@/services/event.service";
import { SOCKET_EVENTS } from "@/lib/chat-constants";

type ReminderType = "1_HOUR" | "1_MINUTE";

async function emitReminders(
  io: Server,
  fromMs: number,
  toMs: number,
  reminderType: ReminderType,
) {
  const events = await getEventsInWindow(fromMs, toMs);

  for (const event of events) {
    const key = `event-reminder:${reminderType}:${event.id}`;
    const already = await redis.exists(key);
    if (already) continue;

    io.emit(SOCKET_EVENTS.EVENT_REMINDER, {
      event: {
        id: event.id,
        title: event.title,
        impact: event.impact,
        currency: event.currency,
        startTime: event.startTime.toISOString(),
      },
      reminderType,
    });

    await redis.set(key, "1", "EX", 7200); // 2h TTL
  }
}

export async function checkEventReminders(io: Server) {
  const now = Date.now();

  // 1-hour window: events starting in 59–61 minutes
  await emitReminders(io, now + 59 * 60_000, now + 61 * 60_000, "1_HOUR");

  // 1-minute window: events starting in 0–2 minutes
  await emitReminders(io, now, now + 2 * 60_000, "1_MINUTE");
}
