import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { redis } from "@/lib/redis";
import type { Prisma, TradeStatus } from "@prisma/client";
import type {
  BadgeRequirements,
  RankBadgeRequirements,
  PerformanceBadgeRequirements,
  TrophyBadgeRequirements,
  UserBadgeResult,
  DryRunResult,
  DryRunEntry,
} from "@/types/badge";

// --- Valid Trade Counting ---

interface ValidTrade {
  tradeId: string;
  status: TradeStatus;
  entry: number;
  stopLoss: number;
  targets: number[];
  direction: string;
}

const RESOLVED_STATUSES: TradeStatus[] = [
  "TP_HIT",
  "SL_HIT",
  "BE",
  "CLOSED",
];

/**
 * Get valid closed trades for a user across all clans.
 * A trade is invalid if ANY TradeCardVersion exists AND the entry or stopLoss
 * was changed from original values (first version = original).
 * SET_BE/MOVE_SL via TradeEvent do NOT invalidate.
 */
export async function getValidClosedTrades(
  userId: string
): Promise<ValidTrade[]> {
  const trades = await db.trade.findMany({
    where: {
      userId,
      status: { in: RESOLVED_STATUSES },
      integrityStatus: "VERIFIED",
      statementEligible: true,
      cardType: "SIGNAL",
    },
    include: {
      tradeCard: {
        select: {
          entry: true,
          stopLoss: true,
          targets: true,
          direction: true,
          versions: {
            orderBy: { editedAt: "asc" },
            select: { entry: true, stopLoss: true },
          },
        },
      },
      events: {
        where: {
          actionType: { in: ["SET_BE", "MOVE_SL"] },
        },
        orderBy: { createdAt: "asc" },
        select: { actionType: true, oldValue: true },
      },
    },
  });

  const validTrades: ValidTrade[] = [];

  for (const trade of trades) {
    const card = trade.tradeCard;
    const versions = card.versions;

    // If versions exist, check if entry or stopLoss was edited
    if (versions.length > 0) {
      // First version is the snapshot BEFORE the first edit (= original values)
      const original = versions[0];
      const currentEntry = card.entry;
      const currentSL = card.stopLoss;

      // Check if the latest values differ from original due to user edit
      // We need to account for SET_BE/MOVE_SL which modify stopLoss via TradeEvent
      let slModifiedByAction = false;
      for (const evt of trade.events) {
        if (evt.actionType === "SET_BE" || evt.actionType === "MOVE_SL") {
          slModifiedByAction = true;
        }
      }

      // Entry was edited via TradeCardVersion (invalidates)
      if (original.entry !== currentEntry) {
        continue;
      }

      // SL changed — only invalid if NOT solely due to SET_BE/MOVE_SL
      if (original.stopLoss !== currentSL && !slModifiedByAction) {
        continue;
      }
    }

    // Recover original SL from first SET_BE/MOVE_SL event if applicable
    let effectiveSL = card.stopLoss;
    if (trade.events.length > 0) {
      const firstSlEvent = trade.events[0];
      if (firstSlEvent.oldValue) {
        try {
          const parsed = JSON.parse(firstSlEvent.oldValue);
          if (parsed.stopLoss !== undefined) {
            effectiveSL = parsed.stopLoss;
          }
        } catch {
          // Use current SL
        }
      }
    }

    validTrades.push({
      tradeId: trade.id,
      status: trade.status,
      entry: card.entry,
      stopLoss: effectiveSL,
      targets: card.targets,
      direction: card.direction,
    });
  }

  return validTrades;
}

// --- R-Multiple Calculation ---

export function computeRMultiple(
  status: TradeStatus,
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

// --- Rank Badge Evaluation ---

export async function evaluateRankBadges(
  userId: string,
  validTradeCount: number
): Promise<string | null> {
  const rankDefs = await db.badgeDefinition.findMany({
    where: {
      category: "RANK",
      enabled: true,
      isDeleted: false,
    },
    orderBy: { displayOrder: "desc" },
  });

  if (rankDefs.length === 0) return null;

  // Find highest qualifying rank
  let highestQualifying: (typeof rankDefs)[0] | null = null;
  for (const def of rankDefs) {
    const req = def.requirementsJson as unknown as RankBadgeRequirements;
    if (req.type === "rank" && validTradeCount >= req.min_closed_trades) {
      highestQualifying = def;
      break; // Already sorted DESC by displayOrder
    }
  }

  // Transaction: deactivate all rank badges, activate highest qualifying
  await db.$transaction(async (tx) => {
    // Deactivate all active rank badges for this user
    const activeRankBadges = await tx.userBadge.findMany({
      where: {
        userId,
        isActive: true,
        badgeDefinition: { category: "RANK" },
      },
      select: { id: true, badgeDefinitionId: true },
    });

    for (const badge of activeRankBadges) {
      if (!highestQualifying || badge.badgeDefinitionId !== highestQualifying.id) {
        await tx.userBadge.update({
          where: { id: badge.id },
          data: { isActive: false, revokedAt: new Date(), evaluatedAt: new Date() },
        });
      }
    }

    // Activate highest qualifying
    if (highestQualifying) {
      await tx.userBadge.upsert({
        where: {
          userId_badgeDefinitionId: {
            userId,
            badgeDefinitionId: highestQualifying.id,
          },
        },
        create: {
          userId,
          badgeDefinitionId: highestQualifying.id,
          isActive: true,
          metadataJson: { validTradeCount } as unknown as Prisma.InputJsonValue,
          evaluatedAt: new Date(),
        },
        update: {
          isActive: true,
          revokedAt: null,
          metadataJson: { validTradeCount } as unknown as Prisma.InputJsonValue,
          evaluatedAt: new Date(),
        },
      });
    }
  });

  return highestQualifying?.key ?? null;
}

// --- Performance Badge Evaluation ---

export async function evaluatePerformanceBadges(
  userId: string,
  validTrades: ValidTrade[]
): Promise<string[]> {
  const perfDefs = await db.badgeDefinition.findMany({
    where: {
      category: "PERFORMANCE",
      enabled: true,
      isDeleted: false,
    },
  });

  const activeBadgeKeys: string[] = [];

  for (const def of perfDefs) {
    const req = def.requirementsJson as unknown as PerformanceBadgeRequirements;
    if (req.type !== "performance") continue;

    // Take most recent N valid trades
    const window = Math.min(req.window, validTrades.length);
    if (window === 0) {
      // Not enough trades — deactivate if active
      await deactivateUserBadge(userId, def.id);
      continue;
    }

    const recentTrades = validTrades.slice(-window);
    const rValues = recentTrades.map((t) =>
      computeRMultiple(t.status, t.entry, t.stopLoss, t.targets)
    );

    let metricValue: number;
    switch (req.metric) {
      case "net_r":
        metricValue = rValues.reduce((a, b) => a + b, 0);
        break;
      case "avg_r":
        metricValue = rValues.reduce((a, b) => a + b, 0) / rValues.length;
        break;
      case "max_drawdown_r": {
        // Max consecutive drawdown in R terms
        let maxDD = 0;
        let runningDD = 0;
        for (const r of rValues) {
          if (r < 0) {
            runningDD += Math.abs(r);
            maxDD = Math.max(maxDD, runningDD);
          } else {
            runningDD = 0;
          }
        }
        metricValue = maxDD;
        break;
      }
      case "win_rate": {
        const wins = rValues.filter((r) => r > 0).length;
        metricValue = wins / rValues.length;
        break;
      }
      default:
        continue;
    }

    // Check if user has enough trades for the window
    if (validTrades.length < req.window) {
      await deactivateUserBadge(userId, def.id);
      continue;
    }

    const qualifies = compareOp(metricValue, req.op, req.value);

    if (qualifies) {
      await db.userBadge.upsert({
        where: {
          userId_badgeDefinitionId: {
            userId,
            badgeDefinitionId: def.id,
          },
        },
        create: {
          userId,
          badgeDefinitionId: def.id,
          isActive: true,
          metadataJson: { metricValue, window } as unknown as Prisma.InputJsonValue,
          evaluatedAt: new Date(),
        },
        update: {
          isActive: true,
          revokedAt: null,
          metadataJson: { metricValue, window } as unknown as Prisma.InputJsonValue,
          evaluatedAt: new Date(),
        },
      });
      activeBadgeKeys.push(def.key);
    } else {
      await deactivateUserBadge(userId, def.id);
    }
  }

  return activeBadgeKeys;
}

// --- Trophy Badge Evaluation ---

export async function evaluateTrophyBadges(
  userId: string
): Promise<string[]> {
  const trophyDefs = await db.badgeDefinition.findMany({
    where: {
      category: "TROPHY",
      enabled: true,
      isDeleted: false,
    },
  });

  const activeBadgeKeys: string[] = [];

  for (const def of trophyDefs) {
    const req = def.requirementsJson as unknown as TrophyBadgeRequirements;
    if (req.type !== "trophy") continue;

    // Resolve season_id
    let seasonId = req.season_id;
    if (seasonId === "*") {
      const latestSeason = await db.season.findFirst({
        where: { status: { in: ["ACTIVE", "COMPLETED"] } },
        orderBy: { startDate: "desc" },
        select: { id: true },
      });
      if (!latestSeason) {
        await deactivateUserBadge(userId, def.id);
        continue;
      }
      seasonId = latestSeason.id;
    }

    // Check user's rank in leaderboard
    const entry = await db.leaderboardEntry.findUnique({
      where: {
        seasonId_entityType_entityId_lens: {
          seasonId,
          entityType: "TRADER",
          entityId: userId,
          lens: req.lens,
        },
      },
      select: { rank: true },
    });

    if (
      entry?.rank != null &&
      entry.rank >= req.rank_min &&
      entry.rank <= req.rank_max
    ) {
      await db.userBadge.upsert({
        where: {
          userId_badgeDefinitionId: {
            userId,
            badgeDefinitionId: def.id,
          },
        },
        create: {
          userId,
          badgeDefinitionId: def.id,
          isActive: true,
          metadataJson: {
            seasonId,
            rank: entry.rank,
          } as unknown as Prisma.InputJsonValue,
          evaluatedAt: new Date(),
        },
        update: {
          isActive: true,
          revokedAt: null,
          metadataJson: {
            seasonId,
            rank: entry.rank,
          } as unknown as Prisma.InputJsonValue,
          evaluatedAt: new Date(),
        },
      });
      activeBadgeKeys.push(def.key);
    } else {
      await deactivateUserBadge(userId, def.id);
    }
  }

  return activeBadgeKeys;
}

// --- Main Orchestrator ---

export async function evaluateUserBadges(
  userId: string
): Promise<UserBadgeResult> {
  const validTrades = await getValidClosedTrades(userId);
  const validTradeCount = validTrades.length;

  const [rankBadge, performanceBadges, trophyBadges] = await Promise.all([
    evaluateRankBadges(userId, validTradeCount),
    evaluatePerformanceBadges(userId, validTrades),
    evaluateTrophyBadges(userId),
  ]);

  const totalActive = await db.userBadge.count({
    where: { userId, isActive: true },
  });

  audit("badge.evaluate", "User", userId, undefined, {
    validTradeCount,
    rankBadge,
    performanceBadges,
    trophyBadges,
  }, { category: "SYSTEM" });

  return {
    userId,
    rankBadge,
    performanceBadges,
    trophyBadges,
    totalActive,
  };
}

// --- Recompute All ---

export async function recomputeAllBadges(
  jobId?: string
): Promise<{ processed: number; errors: number }> {
  // Get all users who have at least one trade
  const users = await db.user.findMany({
    where: {
      trades: { some: {} },
    },
    select: { id: true },
  });

  const total = users.length;
  let processed = 0;
  let errors = 0;

  if (jobId) {
    await redis.set(
      `badge:recompute:${jobId}`,
      JSON.stringify({ total, processed: 0, errors: 0, status: "running" }),
      "EX",
      3600
    );
  }

  for (const user of users) {
    try {
      await evaluateUserBadges(user.id);
      processed++;
    } catch (err) {
      console.error(`Badge recompute error for user ${user.id}:`, err);
      errors++;
    }

    if (jobId && processed % 10 === 0) {
      await redis.set(
        `badge:recompute:${jobId}`,
        JSON.stringify({ total, processed, errors, status: "running" }),
        "EX",
        3600
      );
    }
  }

  if (jobId) {
    await redis.set(
      `badge:recompute:${jobId}`,
      JSON.stringify({
        total,
        processed,
        errors,
        status: errors > 0 && processed === 0 ? "failed" : "completed",
      }),
      "EX",
      3600
    );
  }

  return { processed, errors };
}

export async function recomputeUserBadges(userId: string) {
  return evaluateUserBadges(userId);
}

export async function recomputeBadgeForAll(badgeId: string) {
  const badgeDef = await db.badgeDefinition.findUnique({
    where: { id: badgeId },
  });
  if (!badgeDef) throw new Error("Badge definition not found");

  // Get all users who have trades (for rank/performance) or leaderboard entries (for trophy)
  const users = await db.user.findMany({
    where: { trades: { some: {} } },
    select: { id: true },
  });

  let processed = 0;
  let errors = 0;

  for (const user of users) {
    try {
      await evaluateUserBadges(user.id);
      processed++;
    } catch {
      errors++;
    }
  }

  return { processed, errors };
}

// --- Dry Run ---

export async function dryRunBadge(
  badgeId: string,
  requirementsJson: BadgeRequirements
): Promise<DryRunResult> {
  const badgeDef = await db.badgeDefinition.findUnique({
    where: { id: badgeId },
    include: {
      userBadges: {
        where: { isActive: true },
        select: { userId: true },
      },
    },
  });

  if (!badgeDef) throw new Error("Badge definition not found");

  const currentHolders = new Set(badgeDef.userBadges.map((b) => b.userId));

  // Get all users with trades
  const users = await db.user.findMany({
    where: { trades: { some: {} } },
    select: { id: true, name: true },
  });

  const wouldGain: DryRunEntry[] = [];
  const wouldLose: DryRunEntry[] = [];
  let unchanged = 0;

  for (const user of users) {
    const qualifies = await wouldUserQualify(user.id, requirementsJson);
    const currentlyHas = currentHolders.has(user.id);

    if (qualifies && !currentlyHas) {
      wouldGain.push({
        userId: user.id,
        userName: user.name,
        currentValue: qualifies.value,
      });
    } else if (!qualifies && currentlyHas) {
      wouldLose.push({
        userId: user.id,
        userName: user.name,
        currentValue: null,
      });
    } else {
      unchanged++;
    }
    currentHolders.delete(user.id);
  }

  // Remaining current holders who weren't in user list
  // (users without trades but with badge — edge case)
  for (const holderId of currentHolders) {
    const user = await db.user.findUnique({
      where: { id: holderId },
      select: { name: true },
    });
    wouldLose.push({
      userId: holderId,
      userName: user?.name ?? null,
      currentValue: null,
    });
  }

  return { wouldGain, wouldLose, unchanged };
}

// --- Helpers ---

async function deactivateUserBadge(
  userId: string,
  badgeDefinitionId: string
) {
  const existing = await db.userBadge.findUnique({
    where: { userId_badgeDefinitionId: { userId, badgeDefinitionId } },
  });
  if (existing?.isActive) {
    await db.userBadge.update({
      where: { id: existing.id },
      data: { isActive: false, revokedAt: new Date(), evaluatedAt: new Date() },
    });
  }
}

function compareOp(value: number, op: string, threshold: number): boolean {
  switch (op) {
    case ">=":
      return value >= threshold;
    case "<=":
      return value <= threshold;
    case ">":
      return value > threshold;
    case "<":
      return value < threshold;
    default:
      return false;
  }
}

async function wouldUserQualify(
  userId: string,
  requirements: BadgeRequirements
): Promise<{ value: number } | false> {
  switch (requirements.type) {
    case "rank": {
      const trades = await getValidClosedTrades(userId);
      const count = trades.length;
      return count >= requirements.min_closed_trades
        ? { value: count }
        : false;
    }
    case "performance": {
      const trades = await getValidClosedTrades(userId);
      if (trades.length < requirements.window) return false;
      const recentTrades = trades.slice(-requirements.window);
      const rValues = recentTrades.map((t) =>
        computeRMultiple(t.status, t.entry, t.stopLoss, t.targets)
      );
      let metricValue: number;
      switch (requirements.metric) {
        case "net_r":
          metricValue = rValues.reduce((a, b) => a + b, 0);
          break;
        case "avg_r":
          metricValue = rValues.reduce((a, b) => a + b, 0) / rValues.length;
          break;
        case "max_drawdown_r": {
          let maxDD = 0;
          let runningDD = 0;
          for (const r of rValues) {
            if (r < 0) {
              runningDD += Math.abs(r);
              maxDD = Math.max(maxDD, runningDD);
            } else {
              runningDD = 0;
            }
          }
          metricValue = maxDD;
          break;
        }
        case "win_rate": {
          const wins = rValues.filter((r) => r > 0).length;
          metricValue = wins / rValues.length;
          break;
        }
        default:
          return false;
      }
      return compareOp(metricValue, requirements.op, requirements.value)
        ? { value: metricValue }
        : false;
    }
    case "trophy": {
      let seasonId = requirements.season_id;
      if (seasonId === "*") {
        const latest = await db.season.findFirst({
          where: { status: { in: ["ACTIVE", "COMPLETED"] } },
          orderBy: { startDate: "desc" },
          select: { id: true },
        });
        if (!latest) return false;
        seasonId = latest.id;
      }
      const entry = await db.leaderboardEntry.findUnique({
        where: {
          seasonId_entityType_entityId_lens: {
            seasonId,
            entityType: "TRADER",
            entityId: userId,
            lens: requirements.lens,
          },
        },
        select: { rank: true },
      });
      if (
        entry?.rank != null &&
        entry.rank >= requirements.rank_min &&
        entry.rank <= requirements.rank_max
      ) {
        return { value: entry.rank };
      }
      return false;
    }
    case "manual":
      return false;
    default:
      return false;
  }
}
