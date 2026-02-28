import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getR, type TradeRow } from "@/lib/trade-r";
import type {
  JournalData,
  JournalSummary,
  EquityCurvePoint,
  CalendarDayData,
  InstrumentStats,
  DirectionStats,
  TagStats,
  TimeSlotStats,
  StreakInfo,
  PeriodComparisonData,
} from "@/types/journal";

interface JournalOptions {
  clanId?: string;
  from?: Date;
  to?: Date;
  trackedOnly?: boolean;
  cardType?: "SIGNAL" | "ANALYSIS";
}

const TIMEZONE = "Asia/Tehran";

// ────────────────────────────────────────────
// Timezone helpers
// ────────────────────────────────────────────

function toDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(d);
}

function toDayOfWeek(d: Date): string {
  return d.toLocaleString("en-US", { timeZone: TIMEZONE, weekday: "short" });
}

function toMonthLabel(d: Date): string {
  return d.toLocaleString("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "short",
  });
}

// ────────────────────────────────────────────
// Summary computation
// ────────────────────────────────────────────

function computeSummary(
  trades: TradeRow[],
  rValues: (number | null)[]
): JournalSummary {
  let wins = 0;
  let losses = 0;
  let breakEven = 0;
  let unknownR = 0;

  const knownR: number[] = [];

  for (let i = 0; i < trades.length; i++) {
    const r = rValues[i];
    const status = trades[i].status;

    if (r === null) {
      unknownR++;
      continue;
    }

    knownR.push(r);

    if (status === "BE" || r === 0) {
      breakEven++;
    } else if (r > 0) {
      wins++;
    } else {
      losses++;
    }
  }

  const denominator = wins + losses;
  const winRate = denominator > 0 ? wins / denominator : 0;

  const sumWinR = knownR.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const sumLossR = Math.abs(
    knownR.filter((r) => r < 0).reduce((a, b) => a + b, 0)
  );
  // Use 9999 as sentinel for "infinity" since JSON.stringify(Infinity) → null
  const profitFactor =
    sumLossR === 0 ? (sumWinR > 0 ? 9999 : 0) : sumWinR / sumLossR;

  const totalR = knownR.reduce((a, b) => a + b, 0);
  const expectancy = knownR.length > 0 ? totalR / knownR.length : 0;
  const bestR = knownR.length > 0 ? Math.max(...knownR) : 0;
  const worstR = knownR.length > 0 ? Math.min(...knownR) : 0;

  return {
    totalTrades: trades.length,
    wins,
    losses,
    breakEven,
    closed: trades.length,
    unknownR,
    winRate,
    profitFactor,
    expectancy,
    totalR,
    bestR,
    worstR,
  };
}

// ────────────────────────────────────────────
// Equity curve
// ────────────────────────────────────────────

function buildEquityCurve(
  trades: TradeRow[],
  rValues: (number | null)[]
): EquityCurvePoint[] {
  // Filter to trades with closedAt and known R
  const items: { date: Date; r: number; instrument: string }[] = [];
  for (let i = 0; i < trades.length; i++) {
    if (trades[i].closedAt && rValues[i] !== null) {
      items.push({
        date: trades[i].closedAt!,
        r: rValues[i]!,
        instrument: trades[i].tradeCard.instrument,
      });
    }
  }

  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Downsample if >500
  if (items.length <= 500) {
    let cumR = 0;
    return items.map((item, idx) => {
      cumR += item.r;
      return {
        date: item.date.toISOString(),
        r: Math.round(item.r * 100) / 100,
        cumulativeR: Math.round(cumR * 100) / 100,
        instrument: item.instrument,
        tradeIndex: idx,
      };
    });
  }

  // Per-day aggregation
  const dayMap = new Map<string, { totalR: number; count: number }>();
  for (const item of items) {
    const ds = toDateString(item.date);
    const existing = dayMap.get(ds);
    if (existing) {
      existing.totalR += item.r;
      existing.count++;
    } else {
      dayMap.set(ds, { totalR: item.r, count: 1 });
    }
  }

  const sortedDays = Array.from(dayMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  let cumR = 0;
  return sortedDays.map(([date, data], idx) => {
    cumR += data.totalR;
    return {
      date,
      r: Math.round(data.totalR * 100) / 100,
      cumulativeR: Math.round(cumR * 100) / 100,
      instrument: "",
      tradeIndex: idx,
    };
  });
}

// ────────────────────────────────────────────
// Calendar heatmap
// ────────────────────────────────────────────

function buildCalendarData(
  trades: TradeRow[],
  rValues: (number | null)[]
): CalendarDayData[] {
  const dayMap = new Map<string, { totalR: number; tradeCount: number }>();

  for (let i = 0; i < trades.length; i++) {
    if (!trades[i].closedAt || rValues[i] === null) continue;
    const ds = toDateString(trades[i].closedAt!);
    const existing = dayMap.get(ds);
    if (existing) {
      existing.totalR += rValues[i]!;
      existing.tradeCount++;
    } else {
      dayMap.set(ds, { totalR: rValues[i]!, tradeCount: 1 });
    }
  }

  return Array.from(dayMap.entries())
    .map(([date, data]) => ({
      date,
      totalR: Math.round(data.totalR * 100) / 100,
      tradeCount: data.tradeCount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ────────────────────────────────────────────
// Breakdowns
// ────────────────────────────────────────────

interface BreakdownAccum {
  trades: number;
  wins: number;
  losses: number;
  rSum: number;
  rCount: number;
}

function emptyAccum(): BreakdownAccum {
  return { trades: 0, wins: 0, losses: 0, rSum: 0, rCount: 0 };
}

function accumTrade(acc: BreakdownAccum, r: number | null, status: string) {
  acc.trades++;
  if (r !== null) {
    acc.rSum += r;
    acc.rCount++;
    if (status === "BE" || r === 0) {
      /* BE — don't count as win or loss */
    } else if (r > 0) {
      acc.wins++;
    } else {
      acc.losses++;
    }
  }
}

function toStats(acc: BreakdownAccum) {
  const denom = acc.wins + acc.losses;
  return {
    trades: acc.trades,
    wins: acc.wins,
    losses: acc.losses,
    winRate: denom > 0 ? acc.wins / denom : 0,
    avgR: acc.rCount > 0 ? Math.round((acc.rSum / acc.rCount) * 100) / 100 : 0,
    totalR: Math.round(acc.rSum * 100) / 100,
  };
}

function buildInstrumentBreakdown(
  trades: TradeRow[],
  rValues: (number | null)[]
): InstrumentStats[] {
  const map = new Map<string, BreakdownAccum>();
  for (let i = 0; i < trades.length; i++) {
    const key = trades[i].tradeCard.instrument;
    if (!map.has(key)) map.set(key, emptyAccum());
    accumTrade(map.get(key)!, rValues[i], trades[i].status);
  }
  return Array.from(map.entries())
    .map(([instrument, acc]) => ({ instrument, ...toStats(acc) }))
    .sort((a, b) => b.trades - a.trades);
}

function buildDirectionBreakdown(
  trades: TradeRow[],
  rValues: (number | null)[]
): DirectionStats[] {
  const map = new Map<string, BreakdownAccum>();
  for (let i = 0; i < trades.length; i++) {
    const key = trades[i].tradeCard.direction;
    if (!map.has(key)) map.set(key, emptyAccum());
    accumTrade(map.get(key)!, rValues[i], trades[i].status);
  }
  return Array.from(map.entries())
    .map(([direction, acc]) => ({ direction, ...toStats(acc) }))
    .sort((a, b) => b.trades - a.trades);
}

function buildTagBreakdown(
  trades: TradeRow[],
  rValues: (number | null)[]
): TagStats[] {
  const map = new Map<string, BreakdownAccum>();
  for (let i = 0; i < trades.length; i++) {
    for (const tag of trades[i].tradeCard.tags) {
      if (!map.has(tag)) map.set(tag, emptyAccum());
      accumTrade(map.get(tag)!, rValues[i], trades[i].status);
    }
  }
  return Array.from(map.entries())
    .map(([tag, acc]) => ({ tag, ...toStats(acc) }))
    .sort((a, b) => b.trades - a.trades);
}

// ────────────────────────────────────────────
// Time analysis
// ────────────────────────────────────────────

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildDayOfWeekAnalysis(
  trades: TradeRow[],
  rValues: (number | null)[]
): TimeSlotStats[] {
  const map = new Map<string, BreakdownAccum>();
  for (const d of DAY_ORDER) map.set(d, emptyAccum());

  for (let i = 0; i < trades.length; i++) {
    if (!trades[i].closedAt) continue;
    const dow = toDayOfWeek(trades[i].closedAt!);
    if (!map.has(dow)) map.set(dow, emptyAccum());
    accumTrade(map.get(dow)!, rValues[i], trades[i].status);
  }

  return DAY_ORDER.map((label) => {
    const acc = map.get(label)!;
    const s = toStats(acc);
    return { label, trades: s.trades, winRate: s.winRate, avgR: s.avgR, totalR: s.totalR };
  });
}

function buildMonthAnalysis(
  trades: TradeRow[],
  rValues: (number | null)[]
): TimeSlotStats[] {
  const map = new Map<string, BreakdownAccum>();

  for (let i = 0; i < trades.length; i++) {
    if (!trades[i].closedAt) continue;
    const label = toMonthLabel(trades[i].closedAt!);
    if (!map.has(label)) map.set(label, emptyAccum());
    accumTrade(map.get(label)!, rValues[i], trades[i].status);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, acc]) => {
      const s = toStats(acc);
      return { label, trades: s.trades, winRate: s.winRate, avgR: s.avgR, totalR: s.totalR };
    });
}

// ────────────────────────────────────────────
// Streaks
// ────────────────────────────────────────────

function computeStreaks(
  trades: TradeRow[],
  rValues: (number | null)[]
): StreakInfo {
  // Sort by closedAt, fallback to createdAt
  const sorted = trades
    .map((t, i) => ({ trade: t, r: rValues[i] }))
    .filter((x) => x.r !== null && (x.r > 0 || x.r < 0))
    .sort(
      (a, b) =>
        (a.trade.closedAt?.getTime() ?? a.trade.createdAt.getTime()) -
        (b.trade.closedAt?.getTime() ?? b.trade.createdAt.getTime())
    );

  let maxWin = 0;
  let maxLoss = 0;
  let curWin = 0;
  let curLoss = 0;

  for (const item of sorted) {
    if (item.r! > 0) {
      curWin++;
      curLoss = 0;
      if (curWin > maxWin) maxWin = curWin;
    } else {
      curLoss++;
      curWin = 0;
      if (curLoss > maxLoss) maxLoss = curLoss;
    }
  }

  const currentStreak = curWin > 0 ? curWin : curLoss;
  const currentStreakType: "win" | "loss" | "none" =
    curWin > 0 ? "win" : curLoss > 0 ? "loss" : "none";

  return {
    currentStreak,
    currentStreakType,
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss,
  };
}

// ────────────────────────────────────────────
// Period comparison
// ────────────────────────────────────────────

async function buildPeriodComparison(
  userId: string,
  from: Date | undefined,
  to: Date | undefined,
  baseTrades: TradeRow[],
  baseR: (number | null)[],
  trackedOnly: boolean,
  clanId?: string
): Promise<PeriodComparisonData | null> {
  if (!from || !to) return null;

  const durationMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - durationMs);
  const prevTo = new Date(from.getTime());

  const prevTrades = await fetchTrades(userId, {
    clanId,
    from: prevFrom,
    to: prevTo,
    trackedOnly,
  });

  if (prevTrades.length === 0) return null;

  const prevR = prevTrades.map(getR);
  const prevSummary = computeSummary(prevTrades, prevR);
  const curSummary = computeSummary(baseTrades, baseR);

  const fmt = (d: Date) => toDateString(d);

  return {
    current: { label: `${fmt(from)} – ${fmt(to)}`, ...curSummary },
    previous: { label: `${fmt(prevFrom)} – ${fmt(prevTo)}`, ...prevSummary },
  };
}

// ────────────────────────────────────────────
// Data fetching
// ────────────────────────────────────────────

async function fetchTrades(
  userId: string,
  opts: JournalOptions
): Promise<TradeRow[]> {
  const { clanId, from, to, trackedOnly = true, cardType } = opts;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const where: any = {
    userId,
    status: { in: ["TP_HIT", "SL_HIT", "BE", "CLOSED"] },
  };

  if (clanId) where.clanId = clanId;

  if (from || to) {
    where.closedAt = {};
    if (from) where.closedAt.gte = from;
    if (to) where.closedAt.lte = to;
  }

  if (cardType === "ANALYSIS") {
    // Analysis tab: filter by cardType only, skip strict quality gates
    where.cardType = "ANALYSIS";
  } else if (trackedOnly) {
    where.integrityStatus = "VERIFIED";
    where.statementEligible = true;
    where.cardType = "SIGNAL";
    where.tradeCard = { tags: { hasSome: ["signal"] } };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const raw = await db.trade.findMany({
    where,
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
      mtTradeMatches: {
        select: { closePrice: true },
        orderBy: { openTime: "desc" as const },
        take: 1,
      },
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
    },
    orderBy: { closedAt: "asc" },
  });

  // Flatten MtTrade closePrice into TradeRow
  return raw.map((t) => ({
    ...t,
    mtClosePrice: t.mtTradeMatches[0]?.closePrice ?? null,
  })) as unknown as TradeRow[];
}

// ────────────────────────────────────────────
// Main entry point
// ────────────────────────────────────────────

export async function getJournalData(
  userId: string,
  opts: JournalOptions = {}
): Promise<JournalData> {
  const { clanId, from, to, trackedOnly = true, cardType } = opts;

  // Check cache
  const cacheKey = `journal:${userId}:${clanId || "all"}:${from?.toISOString() || ""}:${to?.toISOString() || ""}:${trackedOnly}:${cardType || ""}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable — proceed without cache
  }

  const trades = await fetchTrades(userId, opts);
  const rValues = trades.map(getR);

  const summary = computeSummary(trades, rValues);
  const equityCurve = buildEquityCurve(trades, rValues);
  const calendarData = buildCalendarData(trades, rValues);
  const instrumentBreakdown = buildInstrumentBreakdown(trades, rValues);
  const directionBreakdown = buildDirectionBreakdown(trades, rValues);
  const tagBreakdown = buildTagBreakdown(trades, rValues);
  const dayOfWeekAnalysis = buildDayOfWeekAnalysis(trades, rValues);
  const monthAnalysis = buildMonthAnalysis(trades, rValues);
  const streaks = computeStreaks(trades, rValues);
  const periodComparison = await buildPeriodComparison(
    userId,
    from,
    to,
    trades,
    rValues,
    trackedOnly,
    clanId
  );

  const result: JournalData = {
    summary,
    equityCurve,
    calendarData,
    instrumentBreakdown,
    directionBreakdown,
    tagBreakdown,
    dayOfWeekAnalysis,
    monthAnalysis,
    streaks,
    periodComparison,
  };

  // Cache for 60 seconds
  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", 60);
  } catch {
    // Redis unavailable — skip cache write
  }

  return result;
}
