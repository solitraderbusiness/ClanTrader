import { db } from "@/lib/db";
import type { Prisma, StatementPeriod } from "@prisma/client";
import type { TraderStatementMetrics } from "@/types/trader-statement";

export async function getEligibleTrades(
  userId: string,
  clanId: string,
  from?: Date,
  to?: Date
) {
  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = from;
  if (to) dateFilter.lte = to;

  return db.trade.findMany({
    where: {
      userId,
      clanId,
      status: { in: ["TP_HIT", "SL_HIT", "BE", "CLOSED"] },
      integrityStatus: "VERIFIED",
      statementEligible: true,
      tradeCard: {
        tags: { hasSome: ["signal"] },
      },
      ...(Object.keys(dateFilter).length > 0
        ? { createdAt: dateFilter }
        : {}),
    },
    include: {
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
  });
}

function calculateRMultiple(
  status: string,
  entry: number,
  stopLoss: number,
  targets: number[]
): number {
  const risk = Math.abs(entry - stopLoss);
  if (risk === 0) return 0;

  switch (status) {
    case "TP_HIT":
      return Math.abs((targets[0] ?? entry) - entry) / risk;
    case "SL_HIT":
      return -1;
    case "BE":
      return 0;
    case "CLOSED":
      return 0;
    default:
      return 0;
  }
}

export async function calculateStatement(
  userId: string,
  clanId: string,
  periodType: StatementPeriod,
  periodKey: string,
  from?: Date,
  to?: Date,
  seasonId?: string
) {
  const trades = await getEligibleTrades(userId, clanId, from, to);

  const metrics: TraderStatementMetrics = {
    signalCount: trades.length,
    wins: 0,
    losses: 0,
    breakEven: 0,
    closed: 0,
    open: 0,
    winRate: 0,
    avgRMultiple: 0,
    bestRMultiple: -Infinity,
    worstRMultiple: Infinity,
    totalRMultiple: 0,
    instrumentDistribution: {},
    directionDistribution: {},
    tagDistribution: {},
  };

  const rValues: number[] = [];

  for (const trade of trades) {
    const card = trade.tradeCard;

    // Distribution tracking
    metrics.instrumentDistribution[card.instrument] =
      (metrics.instrumentDistribution[card.instrument] || 0) + 1;
    metrics.directionDistribution[card.direction] =
      (metrics.directionDistribution[card.direction] || 0) + 1;
    for (const tag of card.tags) {
      metrics.tagDistribution[tag] = (metrics.tagDistribution[tag] || 0) + 1;
    }

    if (trade.status === "OPEN" || trade.status === "PENDING") {
      metrics.open++;
      continue;
    }

    const r = calculateRMultiple(
      trade.status,
      card.entry,
      card.stopLoss,
      card.targets
    );

    rValues.push(r);
    metrics.totalRMultiple += r;

    if (r > metrics.bestRMultiple) metrics.bestRMultiple = r;
    if (r < metrics.worstRMultiple) metrics.worstRMultiple = r;

    switch (trade.status) {
      case "TP_HIT":
        metrics.wins++;
        break;
      case "SL_HIT":
        metrics.losses++;
        break;
      case "BE":
        metrics.breakEven++;
        break;
      case "CLOSED":
        metrics.closed++;
        break;
    }
  }

  const resolved = metrics.wins + metrics.losses + metrics.breakEven + metrics.closed;
  metrics.winRate = resolved > 0 ? metrics.wins / resolved : 0;
  metrics.avgRMultiple = rValues.length > 0
    ? metrics.totalRMultiple / rValues.length
    : 0;

  if (metrics.bestRMultiple === -Infinity) metrics.bestRMultiple = 0;
  if (metrics.worstRMultiple === Infinity) metrics.worstRMultiple = 0;

  // Upsert the statement
  const statement = await db.traderStatement.upsert({
    where: {
      userId_clanId_periodType_periodKey: {
        userId,
        clanId,
        periodType,
        periodKey,
      },
    },
    create: {
      userId,
      clanId,
      periodType,
      periodKey,
      seasonId: seasonId || null,
      metrics: metrics as unknown as Prisma.InputJsonValue,
      tradeCount: trades.length,
    },
    update: {
      metrics: metrics as unknown as Prisma.InputJsonValue,
      tradeCount: trades.length,
      calculatedAt: new Date(),
    },
  });

  return statement;
}

export async function recalculateAll(
  clanId: string,
  periodType: StatementPeriod,
  from?: Date,
  to?: Date,
  seasonId?: string
) {
  // Get all members with trades in this clan
  const members = await db.clanMember.findMany({
    where: { clanId },
    select: { userId: true },
  });

  const periodKey = getPeriodKey(periodType, from, seasonId);
  const results = [];

  for (const member of members) {
    const statement = await calculateStatement(
      member.userId,
      clanId,
      periodType,
      periodKey,
      from,
      to,
      seasonId
    );
    results.push(statement);
  }

  return results;
}

function getPeriodKey(
  periodType: StatementPeriod,
  from?: Date,
  seasonId?: string
): string {
  switch (periodType) {
    case "MONTHLY": {
      const d = from || new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    case "SEASONAL":
      return `season-${seasonId || "unknown"}`;
    case "ALL_TIME":
      return "all-time";
    default:
      return "unknown";
  }
}

export async function getClanStatements(
  clanId: string,
  periodType?: StatementPeriod
) {
  return db.traderStatement.findMany({
    where: {
      clanId,
      ...(periodType ? { periodType } : {}),
    },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { calculatedAt: "desc" },
  });
}

export async function getUserStatements(
  userId: string,
  periodType?: StatementPeriod
) {
  return db.traderStatement.findMany({
    where: {
      userId,
      ...(periodType ? { periodType } : {}),
    },
    include: {
      clan: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { calculatedAt: "desc" },
  });
}
