import { type EventImpact, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import type { EaCalendarEventInput } from "@/lib/validators";

export interface EventFilters {
  impact?: EventImpact[];
  currency?: string[];
  limit?: number;
}

export async function getUpcomingEvents(filters?: EventFilters) {
  const where: Prisma.TradingEventWhereInput = {
    isActive: true,
    startTime: { gte: new Date() },
  };

  if (filters?.impact?.length) {
    where.impact = { in: filters.impact };
  }

  if (filters?.currency?.length) {
    where.currency = { in: filters.currency };
  }

  return db.tradingEvent.findMany({
    where,
    orderBy: { startTime: "asc" },
    take: filters?.limit ?? 50,
  });
}

export async function syncCalendarEvents(
  events: EaCalendarEventInput[],
  source: string,
) {
  let created = 0;
  let updated = 0;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const event of events) {
    const startTime = new Date(event.startTime);
    if (startTime < cutoff) continue;

    const result = await db.tradingEvent.upsert({
      where: {
        externalId_source: {
          externalId: event.externalId,
          source,
        },
      },
      create: {
        externalId: event.externalId,
        title: event.title,
        description: event.description,
        country: event.country,
        currency: event.currency,
        impact: event.impact,
        startTime,
        actual: event.actual,
        forecast: event.forecast,
        previous: event.previous,
        source,
        isActive: true,
      },
      update: {
        title: event.title,
        description: event.description,
        country: event.country,
        currency: event.currency,
        impact: event.impact,
        startTime,
        actual: event.actual,
        forecast: event.forecast,
        previous: event.previous,
      },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  return { synced: events.length, created, updated };
}

export async function getEventsInWindow(fromMs: number, toMs: number) {
  return db.tradingEvent.findMany({
    where: {
      isActive: true,
      startTime: {
        gte: new Date(fromMs),
        lte: new Date(toMs),
      },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function checkSyncRateLimit(accountId: string): Promise<boolean> {
  const key = `calendar-sync-limit:${accountId}`;
  const exists = await redis.exists(key);
  if (exists) return false;
  await redis.set(key, "1", "EX", 300); // 5 minute cooldown
  return true;
}
