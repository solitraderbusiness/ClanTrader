import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getR, type TradeRow } from "@/lib/trade-r";
import type {
  ClanDigestData,
  DigestPeriod,
  DigestMemberStats,
  DigestMemberTrade,
  DigestSummary,
} from "@/types/clan-digest";

const CACHE_TTL = 90; // seconds

/**
 * Compute period start in the user's timezone, returned as a UTC Date.
 * @param tzOffset - minutes from getTimezoneOffset() (e.g. -210 for UTC+3:30 Iran)
 */
function getPeriodStart(period: DigestPeriod, tzOffset: number = 0): Date {
  const offsetMs = tzOffset * 60 * 1000;
  // Shift current UTC time to user's local (as a UTC timestamp for date math)
  const nowLocal = new Date(Date.now() - offsetMs);

  let localMidnight: Date;
  if (period === "today") {
    localMidnight = new Date(
      Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate())
    );
  } else if (period === "week") {
    const day = nowLocal.getUTCDay(); // 0=Sun
    const diff = day === 0 ? 6 : day - 1; // Monday=0
    localMidnight = new Date(
      Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate() - diff)
    );
  } else {
    // month
    localMidnight = new Date(
      Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), 1)
    );
  }

  // Convert back to UTC
  return new Date(localMidnight.getTime() + offsetMs);
}

export async function getClanDigest(
  clanId: string,
  period: DigestPeriod = "today",
  tzOffset: number = 0
): Promise<ClanDigestData> {
  const cacheKey = `clan-digest:${clanId}:${period}:${tzOffset}`;

  // Try cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable — continue without cache
  }

  const periodStart = getPeriodStart(period, tzOffset);

  const trades = await db.trade.findMany({
    where: {
      clanId,
      OR: [
        { createdAt: { gte: periodStart } },
        { closedAt: { gte: periodStart } },
      ],
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
      cardType: true,
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
    orderBy: { createdAt: "desc" },
  });

  // Flatten MtTrade closePrice into TradeRow shape
  const rows = trades.map((t) => ({
    ...t,
    mtClosePrice: t.mtTradeMatches[0]?.closePrice ?? null,
  }));

  // Compute R for closed trades only
  const closedStatuses = new Set(["TP_HIT", "SL_HIT", "BE", "CLOSED"]);
  const tradeRs = rows.map((row) => ({
    ...row,
    r: closedStatuses.has(row.status) ? getR(row as unknown as TradeRow) : null,
  }));

  // ─── Per-member aggregation ───
  const memberMap = new Map<
    string,
    {
      userId: string;
      name: string;
      avatar: string | null;
      signalCount: number;
      analysisCount: number;
      tpHit: number;
      slHit: number;
      be: number;
      openCount: number;
      wins: number;
      losses: number;
      totalR: number;
      countWithR: number;
      trades: DigestMemberTrade[];
    }
  >();

  for (const t of tradeRs) {
    let entry = memberMap.get(t.userId);
    if (!entry) {
      entry = {
        userId: t.userId,
        name: t.user.name ?? "Unknown",
        avatar: t.user.avatar,
        signalCount: 0,
        analysisCount: 0,
        tpHit: 0,
        slHit: 0,
        be: 0,
        openCount: 0,
        wins: 0,
        losses: 0,
        totalR: 0,
        countWithR: 0,
        trades: [],
      };
      memberMap.set(t.userId, entry);
    }

    // Count by card type
    if (t.cardType === "SIGNAL") entry.signalCount++;
    else entry.analysisCount++;

    // Count by status (labels only — separate from win/loss)
    if (t.status === "TP_HIT") entry.tpHit++;
    else if (t.status === "SL_HIT") entry.slHit++;
    else if (t.status === "BE") entry.be++;
    else if (t.status === "PENDING" || t.status === "OPEN") entry.openCount++;

    // Outcome-based win/loss from R (not status labels)
    if (t.r !== null) {
      if (t.r > 0) entry.wins++;
      else if (t.r < 0) entry.losses++;
    }

    // R accumulation (only for closed trades with R)
    if (t.r !== null) {
      entry.countWithR++;
      entry.totalR += t.r;
    }

    // Cap trades at 20 per member
    if (entry.trades.length < 20) {
      entry.trades.push({
        tradeId: t.id,
        instrument: t.tradeCard?.instrument ?? "",
        direction: t.tradeCard?.direction ?? "",
        status: t.status,
        r: t.r,
        cardType: t.cardType ?? "SIGNAL",
        createdAt: t.createdAt.toISOString(),
        closedAt: t.closedAt?.toISOString() ?? null,
      });
    }
  }

  // ─── Clan-wide summary (from raw member data, before capping) ───
  let totalSignals = 0;
  let totalAnalysis = 0;
  let tpHit = 0;
  let slHit = 0;
  let be = 0;
  let openCount = 0;
  let wins = 0;
  let losses = 0;
  let totalR = 0;
  let countWithR = 0;

  for (const m of memberMap.values()) {
    totalSignals += m.signalCount;
    totalAnalysis += m.analysisCount;
    tpHit += m.tpHit;
    slHit += m.slHit;
    be += m.be;
    openCount += m.openCount;
    wins += m.wins;
    losses += m.losses;
    totalR += m.totalR;
    countWithR += m.countWithR;
  }

  // Build member stats sorted by totalR desc
  const members: DigestMemberStats[] = Array.from(memberMap.values())
    .sort((a, b) => b.totalR - a.totalR)
    .map((e) => {
      const decided = e.wins + e.losses;
      return {
        userId: e.userId,
        name: e.name,
        avatar: e.avatar,
        signalCount: e.signalCount,
        analysisCount: e.analysisCount,
        tpHit: e.tpHit,
        slHit: e.slHit,
        be: e.be,
        openCount: e.openCount,
        winRate: decided > 0 ? Math.round((e.wins / decided) * 1000) / 10 : 0,
        totalR: Math.round(e.totalR * 100) / 100,
        avgR: e.countWithR > 0 ? Math.round((e.totalR / e.countWithR) * 100) / 100 : 0,
        trades: e.trades,
      };
    });

  const decided = wins + losses;
  const summary: DigestSummary = {
    totalCards: totalSignals + totalAnalysis,
    totalSignals,
    totalAnalysis,
    tpHit,
    slHit,
    be,
    openCount,
    winRate: decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0,
    totalR: Math.round(totalR * 100) / 100,
    avgR: countWithR > 0 ? Math.round((totalR / countWithR) * 100) / 100 : 0,
    activeMemberCount: members.length,
  };

  const result: ClanDigestData = { period, summary, members };

  // Cache result
  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);
  } catch {
    // Redis unavailable — continue without caching
  }

  return result;
}
