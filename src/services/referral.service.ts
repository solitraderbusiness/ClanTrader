import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type ReferralEventType =
  | "LINK_COPIED"
  | "LINK_SHARED"
  | "LINK_CLICKED"
  | "SIGNUP"
  | "SUBSCRIPTION";

export function trackEvent(
  type: ReferralEventType,
  referrerId: string,
  referredId?: string,
  metadata?: Record<string, unknown>
) {
  // Fire and forget
  db.referralEvent
    .create({
      data: {
        type,
        referrerId,
        referredId: referredId || null,
        metadata: (metadata || undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch((err) => {
      console.error("Referral event tracking error:", err);
    });
}

export async function getReferralStats(referrerId: string) {
  const counts = await db.referralEvent.groupBy({
    by: ["type"],
    where: { referrerId },
    _count: { id: true },
  });

  const result: Record<string, number> = {};
  for (const row of counts) {
    result[row.type] = row._count.id;
  }

  return {
    shares: (result.LINK_COPIED || 0) + (result.LINK_SHARED || 0),
    clicks: result.LINK_CLICKED || 0,
    signups: result.SIGNUP || 0,
    subscriptions: result.SUBSCRIPTION || 0,
  };
}

export async function getAdminReferralOverview(from?: Date, to?: Date) {
  const where: Prisma.ReferralEventWhereInput = {};
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const counts = await db.referralEvent.groupBy({
    by: ["type"],
    where,
    _count: { id: true },
  });

  const byType: Record<string, number> = {};
  for (const row of counts) {
    byType[row.type] = row._count.id;
  }

  const shares = (byType.LINK_COPIED || 0) + (byType.LINK_SHARED || 0);
  const clicks = byType.LINK_CLICKED || 0;
  const signups = byType.SIGNUP || 0;
  const subscriptions = byType.SUBSCRIPTION || 0;
  const conversionRate = clicks > 0 ? ((signups / clicks) * 100).toFixed(1) : "0.0";

  return {
    shares,
    clicks,
    signups,
    subscriptions,
    conversionRate,
    totalEvents: Object.values(byType).reduce((a, b) => a + b, 0),
  };
}

export async function getTopReferrers(limit = 20) {
  const topBySignups = await db.referralEvent.groupBy({
    by: ["referrerId"],
    where: { type: "SIGNUP" },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  if (topBySignups.length === 0) return [];

  const referrerIds = topBySignups.map((r) => r.referrerId);

  // Get all event counts for these referrers
  const allCounts = await db.referralEvent.groupBy({
    by: ["referrerId", "type"],
    where: { referrerId: { in: referrerIds } },
    _count: { id: true },
  });

  // Get user info
  const users = await db.user.findMany({
    where: { id: { in: referrerIds } },
    select: { id: true, name: true, username: true, avatar: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Build per-referrer stats
  const statsMap = new Map<string, Record<string, number>>();
  for (const row of allCounts) {
    if (!statsMap.has(row.referrerId)) {
      statsMap.set(row.referrerId, {});
    }
    statsMap.get(row.referrerId)![row.type] = row._count.id;
  }

  return topBySignups.map((row) => {
    const counts = statsMap.get(row.referrerId) || {};
    const user = userMap.get(row.referrerId);
    const clicks = counts.LINK_CLICKED || 0;
    const signups = counts.SIGNUP || 0;

    return {
      referrerId: row.referrerId,
      name: user?.name || null,
      username: user?.username || null,
      avatar: user?.avatar || null,
      shares: (counts.LINK_COPIED || 0) + (counts.LINK_SHARED || 0),
      clicks,
      signups,
      subscriptions: counts.SUBSCRIPTION || 0,
      conversionRate: clicks > 0 ? ((signups / clicks) * 100).toFixed(1) : "0.0",
    };
  });
}

export async function getReferrerDetail(referrerId: string) {
  const [stats, referredUsers] = await Promise.all([
    getReferralStats(referrerId),
    db.user.findMany({
      where: { referredBy: referrerId },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        isPro: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { stats, referredUsers };
}

export async function getDailyStats(from: Date, to: Date) {
  const events = await db.referralEvent.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { type: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by day
  const dailyMap = new Map<string, Record<string, number>>();

  for (const event of events) {
    const day = event.createdAt.toISOString().split("T")[0];
    if (!dailyMap.has(day)) {
      dailyMap.set(day, {});
    }
    const counts = dailyMap.get(day)!;
    counts[event.type] = (counts[event.type] || 0) + 1;
  }

  return Array.from(dailyMap.entries()).map(([date, counts]) => ({
    date,
    shares: (counts.LINK_COPIED || 0) + (counts.LINK_SHARED || 0),
    clicks: counts.LINK_CLICKED || 0,
    signups: counts.SIGNUP || 0,
    subscriptions: counts.SUBSCRIPTION || 0,
  }));
}
