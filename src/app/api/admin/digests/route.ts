import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type"); // MORNING | EVENING | null (all)
    const cursor = url.searchParams.get("cursor"); // ISO date string for pagination
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    const where: Record<string, unknown> = {};
    if (type === "MORNING" || type === "EVENING") {
      where.type = type;
    }
    if (cursor) {
      where.createdAt = { lt: new Date(cursor) };
    }

    const digests = await db.digestRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1, // fetch one extra to determine if there's a next page
    });

    const hasMore = digests.length > limit;
    const items = hasMore ? digests.slice(0, limit) : digests;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    return NextResponse.json({ digests: items, nextCursor });
  } catch (error) {
    console.error("Digests API error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
