import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const badgeDefinitionId = searchParams.get("badgeDefinitionId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const skip = (page - 1) * limit;

    const where = badgeDefinitionId ? { badgeDefinitionId } : {};

    const [changes, total] = await Promise.all([
      db.badgeAdminChange.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          adminUser: { select: { id: true, name: true } },
          badgeDefinition: { select: { id: true, key: true, name: true } },
        },
      }),
      db.badgeAdminChange.count({ where }),
    ]);

    return NextResponse.json({
      changes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get badge audit log error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
