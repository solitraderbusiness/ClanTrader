import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    // Get active badges grouped by category
    const badges = await db.userBadge.findMany({
      where: {
        userId,
        isActive: true,
        badgeDefinition: { isDeleted: false },
      },
      include: {
        badgeDefinition: {
          select: {
            id: true,
            key: true,
            category: true,
            name: true,
            description: true,
            iconUrl: true,
            requirementsJson: true,
            displayOrder: true,
          },
        },
      },
      orderBy: {
        badgeDefinition: { displayOrder: "asc" },
      },
    });

    // Group by category
    const rank = badges.filter((b) => b.badgeDefinition.category === "RANK");
    const performance = badges.filter(
      (b) => b.badgeDefinition.category === "PERFORMANCE"
    );
    const trophy = badges.filter(
      (b) => b.badgeDefinition.category === "TROPHY"
    );

    // Calculate progress toward next rank badge
    let nextRank: {
      name: string;
      key: string;
      min_closed_trades: number;
      currentCount: number;
      progress: number;
    } | null = null;

    if (rank.length > 0) {
      const currentRank = rank[0];
      const currentOrder = currentRank.badgeDefinition.displayOrder;

      // Find next rank badge definition
      const nextRankDef = await db.badgeDefinition.findFirst({
        where: {
          category: "RANK",
          enabled: true,
          isDeleted: false,
          displayOrder: { gt: currentOrder },
        },
        orderBy: { displayOrder: "asc" },
      });

      if (nextRankDef) {
        const req = nextRankDef.requirementsJson as unknown as {
          min_closed_trades: number;
        };
        const metadata = currentRank.metadataJson as unknown as {
          validTradeCount?: number;
        };
        const currentCount = metadata?.validTradeCount ?? 0;

        nextRank = {
          name: nextRankDef.name,
          key: nextRankDef.key,
          min_closed_trades: req.min_closed_trades,
          currentCount,
          progress: Math.min(1, currentCount / req.min_closed_trades),
        };
      }
    } else {
      // User has no rank badge — show progress to first rank
      const firstRankDef = await db.badgeDefinition.findFirst({
        where: {
          category: "RANK",
          enabled: true,
          isDeleted: false,
        },
        orderBy: { displayOrder: "asc" },
      });

      if (firstRankDef) {
        const req = firstRankDef.requirementsJson as unknown as {
          min_closed_trades: number;
        };
        // Count user's valid closed trades
        const tradeCount = await db.trade.count({
          where: {
            userId,
            status: {
              in: ["TP_HIT", "SL_HIT", "BE", "CLOSED"],
            },
            integrityStatus: "VERIFIED",
            statementEligible: true,
          },
        });

        nextRank = {
          name: firstRankDef.name,
          key: firstRankDef.key,
          min_closed_trades: req.min_closed_trades,
          currentCount: tradeCount,
          progress: Math.min(1, tradeCount / req.min_closed_trades),
        };
      }
    }

    return NextResponse.json({
      rank,
      performance,
      trophy,
      nextRank,
    });
  } catch (error) {
    console.error("Get user badges error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
