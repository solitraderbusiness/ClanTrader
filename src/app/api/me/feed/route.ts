import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/me/feed
 * Returns an aggregated feed of latest channel posts from clans the user follows or belongs to.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1");
  const limit = 20;

  // Get clan IDs from follows and memberships
  const [follows, memberships] = await Promise.all([
    db.follow.findMany({
      where: { followerId: userId, followingType: "CLAN" },
      select: { followingId: true },
    }),
    db.clanMember.findMany({
      where: { userId },
      select: { clanId: true },
    }),
  ]);

  const clanIds = [
    ...new Set([
      ...follows.map((f) => f.followingId),
      ...memberships.map((m) => m.clanId),
    ]),
  ];

  if (clanIds.length === 0) {
    return NextResponse.json({
      posts: [],
      pagination: { page: 1, total: 0, totalPages: 0 },
    });
  }

  const [posts, total] = await Promise.all([
    db.channelPost.findMany({
      where: { clanId: { in: clanIds } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        images: true,
        isPremium: true,
        viewCount: true,
        reactions: true,
        sourceType: true,
        createdAt: true,
        clanId: true,
        clan: { select: { name: true, avatar: true } },
        author: { select: { id: true, name: true, avatar: true } },
        tradeCard: {
          select: {
            instrument: true,
            direction: true,
            entry: true,
            tags: true,
          },
        },
      },
    }),
    db.channelPost.count({ where: { clanId: { in: clanIds } } }),
  ]);

  return NextResponse.json({
    posts: posts.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
    pagination: {
      page,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
