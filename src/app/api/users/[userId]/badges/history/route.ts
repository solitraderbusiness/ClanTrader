import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const skip = (page - 1) * limit;

    const [badges, total] = await Promise.all([
      db.userBadge.findMany({
        where: {
          userId,
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
            },
          },
        },
        orderBy: { awardedAt: "desc" },
        skip,
        take: limit,
      }),
      db.userBadge.count({
        where: {
          userId,
          badgeDefinition: { isDeleted: false },
        },
      }),
    ]);

    return NextResponse.json({
      badges,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user badge history error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
