import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { getClanPerformance } from "@/services/clan-performance.service";

const querySchema = z.object({
  period: z.enum(["all", "month", "30d"]).default("all"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;

    // Verify clan exists
    const clan = await db.clan.findUnique({
      where: { id: clanId },
      select: { id: true },
    });
    if (!clan) {
      return NextResponse.json({ error: "Clan not found" }, { status: 404 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      period: searchParams.get("period") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid parameters" },
        { status: 400 }
      );
    }

    const data = await getClanPerformance(clanId, parsed.data.period);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Clan performance error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
