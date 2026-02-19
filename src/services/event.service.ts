import { db } from "@/lib/db";

export async function getUpcomingEvents(limit = 20) {
  return db.tradingEvent.findMany({
    where: {
      isActive: true,
      startTime: { gte: new Date() },
    },
    orderBy: { startTime: "asc" },
    take: limit,
  });
}

export async function createEvent(data: {
  title: string;
  description?: string;
  instrument?: string;
  impact?: string;
  startTime: Date;
  endTime?: Date;
  source?: string;
}) {
  return db.tradingEvent.create({
    data: {
      title: data.title,
      description: data.description,
      instrument: data.instrument,
      impact: data.impact,
      startTime: data.startTime,
      endTime: data.endTime,
      source: data.source,
      isActive: true,
    },
  });
}
