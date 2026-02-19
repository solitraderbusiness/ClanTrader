import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/me/channels
 * Returns channels the user follows or belongs to, with last post and unread count.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get clan IDs from follows and memberships
  const [follows, memberships] = await Promise.all([
    db.follow.findMany({
      where: { followerId: userId, followingType: "CLAN" },
      select: { followingId: true, lastReadAt: true },
    }),
    db.clanMember.findMany({
      where: { userId },
      select: { clanId: true },
    }),
  ]);

  const followedIds = follows.map((f) => f.followingId);
  const memberIds = memberships.map((m) => m.clanId);
  // Unique clan IDs from both sources
  const allClanIds = [...new Set([...followedIds, ...memberIds])];

  if (allClanIds.length === 0) {
    return NextResponse.json({ channels: [] });
  }

  // Fetch clan details
  const clans = await db.clan.findMany({
    where: { id: { in: allClanIds } },
    select: {
      id: true,
      name: true,
      avatar: true,
      tradingFocus: true,
      _count: { select: { members: true } },
    },
  });

  // Get last channel post per clan
  const lastPosts = await db.channelPost.findMany({
    where: { clanId: { in: allClanIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["clanId"],
    select: {
      clanId: true,
      title: true,
      content: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  const lastPostMap = new Map(lastPosts.map((p) => [p.clanId, p]));
  const followMap = new Map(follows.map((f) => [f.followingId, f]));
  const memberSet = new Set(memberIds);

  // Compute unread counts per channel
  const unreadCounts = await Promise.all(
    allClanIds.map(async (clanId) => {
      const follow = followMap.get(clanId);
      const lastReadAt = follow?.lastReadAt;
      if (!lastReadAt) {
        const count = await db.channelPost.count({ where: { clanId } });
        return { clanId, count: Math.min(count, 99) };
      }
      const count = await db.channelPost.count({
        where: {
          clanId,
          createdAt: { gt: lastReadAt },
        },
      });
      return { clanId, count: Math.min(count, 99) };
    })
  );

  const unreadMap = new Map(unreadCounts.map((u) => [u.clanId, u.count]));

  const channels = clans
    .map((clan) => {
      const lastPost = lastPostMap.get(clan.id);
      return {
        clanId: clan.id,
        clanName: clan.name,
        clanAvatar: clan.avatar,
        tradingFocus: clan.tradingFocus,
        memberCount: clan._count.members,
        isMember: memberSet.has(clan.id),
        isFollowing: followMap.has(clan.id),
        unreadCount: unreadMap.get(clan.id) ?? 0,
        lastPost: lastPost
          ? {
              title: lastPost.title,
              preview: lastPost.title || lastPost.content?.slice(0, 80) || "",
              authorName: lastPost.author.name,
              createdAt: lastPost.createdAt.toISOString(),
            }
          : null,
        lastActivityAt:
          lastPost?.createdAt.toISOString() ?? new Date(0).toISOString(),
      };
    })
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());

  return NextResponse.json({ channels });
}

/**
 * POST /api/me/channels
 * Mark a channel as read.
 * Body: { clanId: string }
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clanId } = await req.json();
  if (!clanId) {
    return NextResponse.json({ error: "clanId required" }, { status: 400 });
  }

  // Update follow record's lastReadAt
  await db.follow.updateMany({
    where: {
      followerId: session.user.id,
      followingType: "CLAN",
      followingId: clanId,
    },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
