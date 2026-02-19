import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { calculateRankings } from "@/services/ranking.service";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { seasonId } = body;

    if (!seasonId) {
      return NextResponse.json(
        { error: "seasonId is required" },
        { status: 400 }
      );
    }

    const entries = await calculateRankings(seasonId);

    audit("ranking.calculate", "LeaderboardEntry", seasonId, session.user.id, {
      entriesCount: entries.length,
    });

    return NextResponse.json({
      count: entries.length,
    });
  } catch (error) {
    console.error("Ranking calculation error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
