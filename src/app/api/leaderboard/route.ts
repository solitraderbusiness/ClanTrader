import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRankings } from "@/services/ranking.service";
import { db } from "@/lib/db";
import type { LeaderboardLens } from "@/types/ranking";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lens = (searchParams.get("lens") || "composite") as LeaderboardLens;
    const seasonId = searchParams.get("seasonId");
    const page = parseInt(searchParams.get("page") || "1");

    // If no seasonId provided, get the active season
    let activeSeasonId = seasonId;
    if (!activeSeasonId) {
      const activeSeason = await db.season.findFirst({
        where: { status: "ACTIVE" },
        select: { id: true },
      });
      if (!activeSeason) {
        return NextResponse.json({ entries: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } });
      }
      activeSeasonId = activeSeason.id;
    }

    const result = await getRankings(activeSeasonId, lens, page);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Get leaderboard error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
