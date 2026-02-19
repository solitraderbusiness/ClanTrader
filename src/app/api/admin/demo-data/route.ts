import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateDemoClans, generateDemoTrades, generateDemoStatements } from "@/services/demo-data.service";
import { calculateRankings } from "@/services/ranking.service";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { clanCount = 2, tradesPerClan = 15, populateAll = false } = body;

    const clans = await generateDemoClans(clanCount);

    let totalTrades = 0;
    for (const { clan, user, topic } of clans) {
      const trades = await generateDemoTrades(clan.id, user.id, topic.id, tradesPerClan);
      totalTrades += trades.length;
      await generateDemoStatements(clan.id);
    }

    // If populateAll, also recalculate statements for ALL clans and build rankings
    let rankingsCount = 0;
    if (populateAll) {
      // Recalculate statements for all existing clans
      const allClans = await db.clan.findMany({ select: { id: true } });
      for (const c of allClans) {
        await generateDemoStatements(c.id).catch(() => {
          // ignore - clan may have no trades
        });
      }

      // Calculate rankings for all active seasons
      const seasons = await db.season.findMany({ where: { status: "ACTIVE" } });
      for (const season of seasons) {
        const entries = await calculateRankings(season.id);
        rankingsCount += entries.length;
      }
    }

    audit("demo_data.generate", "System", "demo", session.user.id, {
      clanCount: clans.length,
      totalTrades,
      populateAll,
      rankingsCount,
    });

    return NextResponse.json({
      clans: clans.map((c) => ({ id: c.clan.id, name: c.clan.name })),
      totalTrades,
      rankingsCount,
    });
  } catch (error) {
    console.error("Demo data generation error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
