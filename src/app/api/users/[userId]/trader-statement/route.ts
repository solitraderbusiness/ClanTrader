import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getLiveOpenRisk, computeEffectiveRank } from "@/services/live-risk.service";
import { emptyMetrics } from "@/types/trader-statement";
import type { TraderStatementMetrics, StatementPageData } from "@/types/trader-statement";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * GET /api/users/[userId]/trader-statement
 *
 * Returns the 3-block statement page data (PUBLIC — no auth required):
 *   Block A: Official Closed Performance
 *   Block B: Live Open Risk (public-safe: NAV drawdown only, no equity internals)
 *   Block C: Effective Rank View + ranking status
 *
 * Query params:
 *   clanId (required) — which clan's statement
 *   periodType — MONTHLY | SEASONAL | ALL_TIME (default: ALL_TIME)
 *   periodKey — e.g., "2026-03", "all-time" (auto-inferred if omitted)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const limited = await rateLimit(`pub:statement:${getClientIp(request)}`, "PUBLIC_READ");
    if (limited) return limited;

    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const clanId = searchParams.get("clanId");

    if (!clanId) {
      return NextResponse.json(
        { error: "clanId is required", code: "MISSING_CLAN_ID" },
        { status: 400 }
      );
    }

    const periodType = (searchParams.get("periodType") ?? "ALL_TIME") as "MONTHLY" | "SEASONAL" | "ALL_TIME";
    const periodKey = searchParams.get("periodKey") ?? inferPeriodKey(periodType);

    // Block A: Official Closed Performance
    const statement = await db.traderStatement.findUnique({
      where: {
        userId_clanId_periodType_periodKey: {
          userId,
          clanId,
          periodType,
          periodKey,
        },
      },
    });

    const closedPerformance: TraderStatementMetrics = statement
      ? (statement.metrics as unknown as TraderStatementMetrics)
      : emptyMetrics();

    // Block B: Live Open Risk (public-safe — strip internal equity fields)
    const fullRisk = await getLiveOpenRisk(userId, clanId);
    const liveOpenRisk = {
      openOfficialCount: fullRisk.openOfficialCount,
      liveFloatingPnl: fullRisk.liveFloatingPnl,
      liveFloatingR: fullRisk.liveFloatingR,
      currentNavDrawdownPct: fullRisk.currentNavDrawdownPct,
      maxNavDrawdownPct: fullRisk.maxNavDrawdownPct,
      biggestOpenLoserR: fullRisk.biggestOpenLoserR,
      unprotectedCount: fullRisk.unprotectedCount,
      staleWarning: fullRisk.staleWarning,
      lastUpdate: fullRisk.lastUpdate,
      isEstimated: fullRisk.isEstimated,
    };

    // Block C: Effective Rank View
    const effectiveRank = await computeEffectiveRank(
      userId,
      clanId,
      closedPerformance.totalRMultiple
    );

    const data: StatementPageData = {
      closedPerformance,
      liveOpenRisk,
      effectiveRank,
      rankingStatus: (statement?.rankingStatus as "RANKED" | "PROVISIONAL" | "UNRANKED") ?? "RANKED",
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Trader statement error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

function inferPeriodKey(periodType: string): string {
  if (periodType === "ALL_TIME") return "all-time";
  if (periodType === "MONTHLY") {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return "unknown";
}
