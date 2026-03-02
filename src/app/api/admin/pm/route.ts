import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pmItemQuerySchema } from "@/lib/validators";
import type { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const query = pmItemQuerySchema.safeParse(Object.fromEntries(searchParams));

    const where: Prisma.PmItemWhereInput = {};

    if (query.success) {
      const q = query.data;
      if (q.workstream) where.workstream = q.workstream;
      if (q.phase) where.phase = q.phase;
      if (q.status) where.status = q.status;
      if (q.milestone) where.milestone = q.milestone;
      if (q.priority) where.priority = q.priority;
      if (q.owner) where.owner = q.owner;
      if (q.blockersOnly) where.isLaunchBlocker = true;
      if (q.search) {
        where.OR = [
          { title: { contains: q.search, mode: "insensitive" } },
          { description: { contains: q.search, mode: "insensitive" } },
          { epicTitle: { contains: q.search, mode: "insensitive" } },
        ];
      }
    }

    const items = await db.pmItem.findMany({
      where,
      orderBy: [
        { priority: "asc" },
        { phase: "asc" },
        { epicKey: "asc" },
        { title: "asc" },
      ],
    });

    // Stats
    const total = items.length;
    const byStatus: Record<string, number> = {};
    const byWorkstream: Record<string, number> = {};
    let blockers = 0;

    for (const item of items) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
      byWorkstream[item.workstream] = (byWorkstream[item.workstream] || 0) + 1;
      if (item.isLaunchBlocker) blockers++;
    }

    return NextResponse.json({ items, stats: { total, byStatus, byWorkstream, blockers } });
  } catch (error) {
    console.error("Get PM items error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
