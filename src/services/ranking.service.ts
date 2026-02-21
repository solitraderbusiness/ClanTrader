import { db } from "@/lib/db";
import { DEFAULT_WEIGHTS, DEFAULT_LENSES } from "@/lib/ranking-constants";
import { evaluateTrophyBadges } from "@/services/badge-engine.service";
import type { Prisma } from "@prisma/client";
import type { TraderStatementMetrics } from "@/types/trader-statement";
import type { LeaderboardLens, RankingWeights } from "@/types/ranking";

interface RankingConfigData {
  lenses: LeaderboardLens[];
  weights: RankingWeights;
  minTrades: number;
}

async function getRankingConfig(): Promise<RankingConfigData> {
  const config = await db.rankingConfig.findUnique({
    where: { key: "default" },
  });

  if (!config) {
    return {
      lenses: DEFAULT_LENSES,
      weights: DEFAULT_WEIGHTS,
      minTrades: 10,
    };
  }

  return {
    lenses: config.lenses as unknown as LeaderboardLens[],
    weights: config.weights as unknown as RankingWeights,
    minTrades: config.minTrades,
  };
}

function normalizeValues(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 0.5);
  return values.map((v) => (v - min) / range);
}

export async function calculateRankings(seasonId: string) {
  const config = await getRankingConfig();

  // Get all statements for this period
  const statements = await db.traderStatement.findMany({
    where: { seasonId },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  // Filter eligible traders (minimum trades)
  const eligible = statements.filter((s) => s.tradeCount >= config.minTrades);

  if (eligible.length === 0) return [];

  // Extract metrics
  const metricsMap = eligible.map((s) => ({
    userId: s.userId,
    userName: s.user.name,
    metrics: s.metrics as unknown as TraderStatementMetrics,
  }));

  // Calculate per-lens scores
  const lensScores: Record<string, { userId: string; score: number }[]> = {};

  // Profit: totalRMultiple DESC
  const profitValues = metricsMap.map((m) => m.metrics.totalRMultiple);
  const normProfit = normalizeValues(profitValues);

  // Low Risk: worstRMultiple DESC (higher is better)
  const lowRiskValues = metricsMap.map((m) => m.metrics.worstRMultiple);
  const normLowRisk = normalizeValues(lowRiskValues);

  // Consistency: winRate DESC
  const consistencyValues = metricsMap.map((m) => m.metrics.winRate);
  const normConsistency = normalizeValues(consistencyValues);

  // Risk Adjusted: avgRMultiple DESC
  const riskAdjValues = metricsMap.map((m) => m.metrics.avgRMultiple);
  const normRiskAdj = normalizeValues(riskAdjValues);

  // Activity: signalCount DESC
  const activityValues = metricsMap.map((m) => m.metrics.signalCount);
  const normActivity = normalizeValues(activityValues);

  // Build per-lens rankings
  for (const lens of config.lenses) {
    const scored = metricsMap.map((m, i) => {
      let score: number;
      switch (lens) {
        case "profit":
          score = normProfit[i];
          break;
        case "low_risk":
          score = normLowRisk[i];
          break;
        case "consistency":
          score = normConsistency[i];
          break;
        case "risk_adjusted":
          score = normRiskAdj[i];
          break;
        case "activity":
          score = normActivity[i];
          break;
        case "composite":
          score =
            normProfit[i] * config.weights.profit +
            normLowRisk[i] * config.weights.low_risk +
            normConsistency[i] * config.weights.consistency +
            normRiskAdj[i] * config.weights.risk_adjusted +
            normActivity[i] * config.weights.activity;
          break;
        default:
          score = 0;
      }
      return { userId: m.userId, score };
    });

    scored.sort((a, b) => b.score - a.score);
    lensScores[lens] = scored;
  }

  // Upsert leaderboard entries
  const entries = [];
  for (const lens of config.lenses) {
    const scored = lensScores[lens];
    for (let i = 0; i < scored.length; i++) {
      const entry = scored[i];
      const trader = metricsMap.find((m) => m.userId === entry.userId)!;

      const result = await db.leaderboardEntry.upsert({
        where: {
          seasonId_entityType_entityId_lens: {
            seasonId,
            entityType: "TRADER",
            entityId: entry.userId,
            lens,
          },
        },
        create: {
          seasonId,
          entityType: "TRADER",
          entityId: entry.userId,
          lens,
          rank: i + 1,
          metrics: {
            score: entry.score,
            ...trader.metrics,
          } as unknown as Prisma.InputJsonValue,
        },
        update: {
          rank: i + 1,
          metrics: {
            score: entry.score,
            ...trader.metrics,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      entries.push(result);
    }
  }

  // Fire-and-forget trophy badge evaluation for ranked users
  const rankedUserIds = [...new Set(entries.map((e) => e.entityId))];
  for (const uid of rankedUserIds) {
    evaluateTrophyBadges(uid).catch((err) =>
      console.error("Trophy badge evaluation error:", err)
    );
  }

  return entries;
}

export async function getRankings(
  seasonId: string,
  lens: LeaderboardLens = "composite",
  page = 1,
  limit = 50
) {
  const skip = (page - 1) * limit;

  const [entries, total] = await Promise.all([
    db.leaderboardEntry.findMany({
      where: {
        seasonId,
        entityType: "TRADER",
        lens,
      },
      orderBy: { rank: "asc" },
      skip,
      take: limit,
    }),
    db.leaderboardEntry.count({
      where: {
        seasonId,
        entityType: "TRADER",
        lens,
      },
    }),
  ]);

  // Enrich with user data
  const userIds = entries.map((e) => e.entityId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, avatar: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const enriched = entries.map((entry) => ({
    ...entry,
    user: userMap.get(entry.entityId) || null,
  }));

  return {
    entries: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
