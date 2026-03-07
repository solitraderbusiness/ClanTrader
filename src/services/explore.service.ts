import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getR, type TradeRow } from "@/lib/trade-r";
import type { ExploreClanItem, ExploreClanPerf, SparklinePoint } from "@/types/explore";

export const EXPLORE_CACHE_KEY = "explore:clans";
const CACHE_TTL = 300; // 5 minutes

/** Invalidate the explore clans cache — call after any clan mutation */
export async function invalidateExploreCache() {
  try {
    await redis.del(EXPLORE_CACHE_KEY);
  } catch {
    // Redis unavailable — cache will expire naturally
  }
}

interface ExploreFilters {
  sort: "totalR" | "winRate" | "avgTradesPerWeek" | "followers";
  tradingFocus?: string;
  minWinRate?: number;
  q?: string;
  page: number;
  limit: number;
}

export async function getExploreClans(
  filters: ExploreFilters
): Promise<{ clans: ExploreClanItem[]; total: number }> {
  // Try cache for raw data
  let allClans: ExploreClanItem[];
  try {
    const cached = await redis.get(EXPLORE_CACHE_KEY);
    if (cached) {
      allClans = JSON.parse(cached);
    } else {
      allClans = await buildExploreData();
      await redis.set(EXPLORE_CACHE_KEY, JSON.stringify(allClans), "EX", CACHE_TTL);
    }
  } catch {
    allClans = await buildExploreData();
  }

  // Apply filters in memory
  let filtered = allClans;

  if (filters.tradingFocus) {
    filtered = filtered.filter(
      (c) => c.tradingFocus === filters.tradingFocus
    );
  }

  if (filters.minWinRate != null) {
    filtered = filtered.filter(
      (c) => c.perf.totalSignals > 0 && c.perf.winRate >= filters.minWinRate!
    );
  }

  if (filters.q) {
    const q = filters.q.toLowerCase();
    filtered = filtered.filter((c) => c.name.toLowerCase().includes(q));
  }

  // Sort — clans with 0 trades always at bottom
  filtered.sort((a, b) => {
    const aHasTrades = a.perf.totalSignals > 0 ? 1 : 0;
    const bHasTrades = b.perf.totalSignals > 0 ? 1 : 0;
    if (aHasTrades !== bHasTrades) return bHasTrades - aHasTrades;

    switch (filters.sort) {
      case "totalR":
        return b.perf.totalR - a.perf.totalR;
      case "winRate":
        return b.perf.winRate - a.perf.winRate;
      case "avgTradesPerWeek":
        return b.perf.avgTradesPerWeek - a.perf.avgTradesPerWeek;
      case "followers":
        return b.followerCount - a.followerCount;
      default:
        return b.perf.totalR - a.perf.totalR;
    }
  });

  const total = filtered.length;
  const start = (filters.page - 1) * filters.limit;
  const page = filtered.slice(start, start + filters.limit);

  return { clans: page, total };
}

// ────────────────────────────────────────────
// Build all clan data from DB
// ────────────────────────────────────────────

async function buildExploreData(): Promise<ExploreClanItem[]> {
  // 1. Fetch all public clans
  const clans = await db.clan.findMany({
    where: {
      isPublic: true,
      OR: [
        { visibilityOverride: null },
        { visibilityOverride: { not: "HIDDEN" } },
      ],
    },
    select: {
      id: true,
      name: true,
      avatar: true,
      tradingFocus: true,
      tier: true,
      _count: { select: { members: true } },
    },
  });

  if (clans.length === 0) return [];

  const clanIds = clans.map((c) => c.id);

  // 2. Batch follower counts
  const followerCounts = await db.follow.groupBy({
    by: ["followingId"],
    where: {
      followingType: "CLAN",
      followingId: { in: clanIds },
    },
    _count: true,
  });
  const followerMap = new Map(
    followerCounts.map((f) => [f.followingId, f._count])
  );

  // 3. Batch-fetch all eligible trades for all clans
  const trades = await db.trade.findMany({
    where: {
      clanId: { in: clanIds },
      status: { in: ["TP_HIT", "SL_HIT", "BE", "CLOSED"] },
      integrityStatus: "VERIFIED",
      statementEligible: true,
      cardType: "SIGNAL",
    },
    select: {
      id: true,
      clanId: true,
      status: true,
      finalRR: true,
      netProfit: true,
      closePrice: true,
      closedAt: true,
      createdAt: true,
      initialEntry: true,
      initialStopLoss: true,
      initialTakeProfit: true,
      initialRiskAbs: true,
      tradeCard: {
        select: {
          instrument: true,
          direction: true,
          entry: true,
          stopLoss: true,
          targets: true,
          tags: true,
        },
      },
      mtTradeMatches: {
        take: 1,
        select: { closePrice: true },
      },
    },
    orderBy: { closedAt: "asc" },
  });

  // Group trades by clan
  const tradesByClan = new Map<string, typeof trades>();
  for (const t of trades) {
    if (!t.clanId) continue;
    const list = tradesByClan.get(t.clanId) || [];
    list.push(t);
    tradesByClan.set(t.clanId, list);
  }

  // 4. Compute per-clan performance
  return clans.map((clan) => {
    const clanTrades = tradesByClan.get(clan.id) || [];
    const perf = computeClanPerf(clanTrades);
    return {
      id: clan.id,
      name: clan.name,
      avatar: clan.avatar,
      tradingFocus: clan.tradingFocus,
      tier: clan.tier,
      followerCount: followerMap.get(clan.id) ?? 0,
      memberCount: clan._count.members,
      perf,
    };
  });
}

// ────────────────────────────────────────────
// Per-clan performance computation
// ────────────────────────────────────────────

function computeClanPerf(
  trades: Array<{
    id: string;
    status: string;
    finalRR: number | null;
    netProfit: number | null;
    closePrice: number | null;
    closedAt: Date | null;
    createdAt: Date;
    initialEntry: number | null;
    initialStopLoss: number | null;
    initialTakeProfit: number | null;
    initialRiskAbs: number | null;
    tradeCard: {
      instrument: string;
      direction: string;
      entry: number;
      stopLoss: number;
      targets: number[];
      tags: string[];
    };
    mtTradeMatches: Array<{ closePrice: number | null }>;
  }>
): ExploreClanPerf {
  if (trades.length === 0) {
    return {
      totalSignals: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalR: 0,
      avgR: 0,
      avgTradesPerWeek: 0,
      maxDrawdownR: 0,
      sparkline: [],
    };
  }

  // Compute R for each trade
  const rows = trades.map((t) => ({
    ...t,
    mtClosePrice: t.mtTradeMatches[0]?.closePrice ?? null,
  })) as unknown as TradeRow[];

  const tradeRs = rows.map((row) => ({
    row,
    r: getR(row),
    closedAt: row.closedAt ?? row.createdAt,
  }));

  // Summary
  let wins = 0;
  let losses = 0;
  let totalR = 0;
  let countWithR = 0;

  for (const { r, row } of tradeRs) {
    if (r !== null) {
      countWithR++;
      totalR += r;
      if (r > 0) wins++;
      else if (r < 0) losses++;
    } else {
      if (row.status === "TP_HIT") wins++;
      else if (row.status === "SL_HIT") losses++;
    }
  }

  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0;
  const avgR =
    countWithR > 0 ? Math.round((totalR / countWithR) * 100) / 100 : 0;

  // Avg trades per week
  const firstDate = tradeRs[0].closedAt;
  const lastDate = tradeRs[tradeRs.length - 1].closedAt;
  const msRange = lastDate.getTime() - firstDate.getTime();
  const weeksActive = Math.max(msRange / (7 * 24 * 60 * 60 * 1000), 1);
  const avgTradesPerWeek =
    Math.round((trades.length / weeksActive) * 10) / 10;

  // Max drawdown
  let cumR = 0;
  let peak = 0;
  let maxDrawdownR = 0;

  for (const { r } of tradeRs) {
    if (r !== null) cumR += r;
    if (cumR > peak) peak = cumR;
    const dd = peak - cumR;
    if (dd > maxDrawdownR) maxDrawdownR = dd;
  }

  // Sparkline — group by ISO week, cumulative R
  const weekMap = new Map<string, number>();
  let sparkCum = 0;
  for (const { r, closedAt } of tradeRs) {
    if (r !== null) sparkCum += r;
    const weekLabel = getISOWeekLabel(closedAt);
    weekMap.set(weekLabel, Math.round(sparkCum * 100) / 100);
  }

  const sparkline: SparklinePoint[] = Array.from(weekMap.entries())
    .map(([week, cumR]) => ({ week, cumR }))
    .slice(-30);

  return {
    totalSignals: trades.length,
    wins,
    losses,
    winRate,
    totalR: Math.round(totalR * 100) / 100,
    avgR,
    avgTradesPerWeek,
    maxDrawdownR: Math.round(maxDrawdownR * 100) / 100,
    sparkline,
  };
}

function getISOWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
