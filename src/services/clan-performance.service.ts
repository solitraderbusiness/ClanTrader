import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getR, type TradeRow } from "@/lib/trade-r";
import type {
  ClanPerformanceData,
  ClanPerfSummary,
  ProviderStats,
  RecentSignal,
} from "@/types/clan-performance";
import type { InstrumentStats } from "@/types/journal";

type Period = "all" | "month" | "30d";

const CACHE_TTL = 120; // seconds

function getDateFilter(period: Period): { closedAt?: { gte: Date } } {
  if (period === "all") return {};
  const now = new Date();
  if (period === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { closedAt: { gte: start } };
  }
  // 30d
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { closedAt: { gte: start } };
}

export async function getClanPerformance(
  clanId: string,
  period: Period = "all"
): Promise<ClanPerformanceData> {
  const cacheKey = `clan-perf:${clanId}:${period}`;

  // Try cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable — continue without cache
  }

  const dateFilter = getDateFilter(period);

  const trades = await db.trade.findMany({
    where: {
      clanId,
      status: { in: ["TP_HIT", "SL_HIT", "BE", "CLOSED"] },
      integrityStatus: "VERIFIED",
      statementEligible: true,
      cardType: "SIGNAL",
      tradeCard: { tags: { hasSome: ["signal"] } },
      ...dateFilter,
    },
    select: {
      id: true,
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
      userId: true,
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
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
      mtTradeMatches: {
        take: 1,
        select: { closePrice: true },
      },
    },
    orderBy: { closedAt: "desc" },
  });

  // Flatten MtTrade closePrice into TradeRow shape
  const rows = trades.map((t) => ({
    ...t,
    mtClosePrice: t.mtTradeMatches[0]?.closePrice ?? null,
  })) as unknown as (TradeRow & {
    userId: string;
    user: { id: string; name: string | null; avatar: string | null };
  })[];

  // Compute R for each trade
  const tradeRs = rows.map((row) => ({
    ...row,
    r: getR(row),
  }));

  // ─── Summary ───
  const summary = buildSummary(tradeRs);

  // ─── Top Providers ───
  const topProviders = buildTopProviders(tradeRs);

  // ─── Recent Signals (already sorted by closedAt desc) ───
  const recentSignals: RecentSignal[] = tradeRs.slice(0, 10).map((t) => ({
    tradeId: t.id,
    instrument: t.tradeCard.instrument,
    direction: t.tradeCard.direction,
    r: t.r,
    status: t.status,
    closedAt: t.closedAt?.toISOString() ?? t.createdAt.toISOString(),
    providerName: t.user.name ?? "Unknown",
    providerAvatar: t.user.avatar,
    providerId: t.user.id,
  }));

  // ─── Instrument Breakdown ───
  const instrumentBreakdown = buildInstrumentBreakdown(tradeRs);

  const result: ClanPerformanceData = {
    summary,
    topProviders,
    recentSignals,
    instrumentBreakdown,
  };

  // Cache result
  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);
  } catch {
    // Redis unavailable — continue without caching
  }

  return result;
}

// ────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────

interface TradeWithR {
  id: string;
  status: string;
  r: number | null;
  userId: string;
  user: { id: string; name: string | null; avatar: string | null };
  closedAt: Date | null;
  createdAt: Date;
  tradeCard: {
    instrument: string;
    direction: string;
    entry: number;
    stopLoss: number;
    targets: number[];
    tags: string[];
  };
}

function buildSummary(trades: TradeWithR[]): ClanPerfSummary {
  const totalSignals = trades.length;
  let wins = 0;
  let losses = 0;
  let breakEven = 0;
  let totalPositiveR = 0;
  let totalNegativeR = 0;
  let totalR = 0;
  let bestR = 0;
  let worstR = 0;
  let countWithR = 0;

  for (const t of trades) {
    if (t.r !== null) {
      countWithR++;
      totalR += t.r;
      if (t.r > bestR) bestR = t.r;
      if (t.r < worstR) worstR = t.r;
      if (t.r > 0) {
        wins++;
        totalPositiveR += t.r;
      } else if (t.r < 0) {
        losses++;
        totalNegativeR += Math.abs(t.r);
      } else {
        breakEven++;
      }
    } else {
      // Status-based fallback
      if (t.status === "TP_HIT") wins++;
      else if (t.status === "SL_HIT") losses++;
      else if (t.status === "BE") breakEven++;
    }
  }

  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0;
  const profitFactor =
    totalNegativeR > 0
      ? Math.round((totalPositiveR / totalNegativeR) * 100) / 100
      : totalPositiveR > 0
        ? 9999
        : 0;
  const avgR = countWithR > 0 ? Math.round((totalR / countWithR) * 100) / 100 : 0;

  return {
    totalSignals,
    wins,
    losses,
    breakEven,
    winRate,
    profitFactor,
    avgR,
    totalR: Math.round(totalR * 100) / 100,
    bestR: Math.round(bestR * 100) / 100,
    worstR: Math.round(worstR * 100) / 100,
  };
}

// ────────────────────────────────────────────
// Top Providers
// ────────────────────────────────────────────

function buildTopProviders(trades: TradeWithR[]): ProviderStats[] {
  const map = new Map<
    string,
    {
      userId: string;
      name: string;
      avatar: string | null;
      signals: number;
      wins: number;
      losses: number;
      totalR: number;
      countWithR: number;
    }
  >();

  for (const t of trades) {
    let entry = map.get(t.userId);
    if (!entry) {
      entry = {
        userId: t.userId,
        name: t.user.name ?? "Unknown",
        avatar: t.user.avatar,
        signals: 0,
        wins: 0,
        losses: 0,
        totalR: 0,
        countWithR: 0,
      };
      map.set(t.userId, entry);
    }
    entry.signals++;
    if (t.r !== null) {
      entry.countWithR++;
      entry.totalR += t.r;
      if (t.r > 0) entry.wins++;
      else if (t.r < 0) entry.losses++;
    } else {
      if (t.status === "TP_HIT") entry.wins++;
      else if (t.status === "SL_HIT") entry.losses++;
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.totalR - a.totalR)
    .slice(0, 5)
    .map((e) => {
      const decided = e.wins + e.losses;
      return {
        userId: e.userId,
        name: e.name,
        avatar: e.avatar,
        signals: e.signals,
        wins: e.wins,
        losses: e.losses,
        winRate: decided > 0 ? Math.round((e.wins / decided) * 1000) / 10 : 0,
        totalR: Math.round(e.totalR * 100) / 100,
        avgR: e.countWithR > 0 ? Math.round((e.totalR / e.countWithR) * 100) / 100 : 0,
      };
    });
}

// ────────────────────────────────────────────
// Instrument Breakdown
// ────────────────────────────────────────────

function buildInstrumentBreakdown(trades: TradeWithR[]): InstrumentStats[] {
  const map = new Map<
    string,
    { trades: number; wins: number; losses: number; totalR: number; countWithR: number }
  >();

  for (const t of trades) {
    const inst = t.tradeCard.instrument;
    let entry = map.get(inst);
    if (!entry) {
      entry = { trades: 0, wins: 0, losses: 0, totalR: 0, countWithR: 0 };
      map.set(inst, entry);
    }
    entry.trades++;
    if (t.r !== null) {
      entry.countWithR++;
      entry.totalR += t.r;
      if (t.r > 0) entry.wins++;
      else if (t.r < 0) entry.losses++;
    } else {
      if (t.status === "TP_HIT") entry.wins++;
      else if (t.status === "SL_HIT") entry.losses++;
    }
  }

  return Array.from(map.entries())
    .map(([instrument, e]) => {
      const decided = e.wins + e.losses;
      return {
        instrument,
        trades: e.trades,
        wins: e.wins,
        losses: e.losses,
        winRate: decided > 0 ? Math.round((e.wins / decided) * 1000) / 10 : 0,
        avgR: e.countWithR > 0 ? Math.round((e.totalR / e.countWithR) * 100) / 100 : 0,
        totalR: Math.round(e.totalR * 100) / 100,
      };
    })
    .sort((a, b) => b.trades - a.trades);
}
