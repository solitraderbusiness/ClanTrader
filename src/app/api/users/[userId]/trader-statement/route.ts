import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLiveOpenRisk, computeEffectiveRank } from "@/services/live-risk.service";
import { emptyMetrics } from "@/types/trader-statement";
import type { TraderStatementMetrics, StatementPageData } from "@/types/trader-statement";

/**
 * GET /api/users/[userId]/trader-statement
 *
 * Returns the 3-block statement page data:
 *   Block A: Official Closed Performance
 *   Block B: Live Open Risk
 *   Block C: Effective Rank View
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Block B: Live Open Risk
    const liveOpenRisk = await getLiveOpenRisk(userId, clanId);

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
