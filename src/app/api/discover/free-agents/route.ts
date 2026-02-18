import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tradingStyle = searchParams.get("tradingStyle") || undefined;
    const sessionPreference =
      searchParams.get("sessionPreference") || undefined;
    const sort = searchParams.get("sort") || "winRate";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const skip = (page - 1) * limit;

    // Find verified traders not in any clan
    const where = {
      // Has at least one verified statement
      statements: {
        some: { verificationStatus: "VERIFIED" as const },
      },
      // Not in any clan
      clanMemberships: {
        none: {},
      },
      ...(tradingStyle ? { tradingStyle } : {}),
      ...(sessionPreference ? { sessionPreference } : {}),
    };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          avatar: true,
          tradingStyle: true,
          sessionPreference: true,
          preferredPairs: true,
          statements: {
            where: { verificationStatus: "VERIFIED" },
            orderBy: { verifiedAt: "desc" },
            take: 1,
            select: {
              extractedMetrics: true,
              verifiedAt: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    // Map and sort by metrics
    const freeAgents = users
      .map((u) => {
        const metrics = (u.statements[0]?.extractedMetrics as Record<
          string,
          unknown
        >) || {};
        return {
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          tradingStyle: u.tradingStyle,
          sessionPreference: u.sessionPreference,
          preferredPairs: u.preferredPairs,
          metrics: {
            winRate: (metrics.winRate as number) || 0,
            profitFactor: (metrics.profitFactor as number) || 0,
            totalTrades: (metrics.totalTrades as number) || 0,
          },
          lastVerified: u.statements[0]?.verifiedAt,
        };
      })
      .sort((a, b) => {
        const key = sort as keyof typeof a.metrics;
        if (key in a.metrics) {
          return (b.metrics[key] || 0) - (a.metrics[key] || 0);
        }
        return 0;
      });

    return NextResponse.json({
      freeAgents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Discover free agents error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
