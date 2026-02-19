import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/me/chats
 * Returns the current user's clan chats with last message preview and unread count.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get all clan memberships
  const memberships = await db.clanMember.findMany({
    where: { userId },
    include: {
      clan: {
        select: {
          id: true,
          name: true,
          avatar: true,
          tradingFocus: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  if (memberships.length === 0) {
    return NextResponse.json({ chats: [] });
  }

  const clanIds = memberships.map((m) => m.clanId);

  // Get last message per clan (most recent message across all topics)
  const lastMessages = await db.message.findMany({
    where: { clanId: { in: clanIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["clanId"],
    select: {
      clanId: true,
      content: true,
      type: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  });

  const lastMessageMap = new Map(lastMessages.map((m) => [m.clanId, m]));

  // Compute unread counts per clan
  const unreadCounts = await Promise.all(
    memberships.map(async (m) => {
      if (!m.lastReadAt) {
        // Never read = count all messages
        const count = await db.message.count({
          where: { clanId: m.clanId },
        });
        return { clanId: m.clanId, count: Math.min(count, 99) };
      }
      const count = await db.message.count({
        where: {
          clanId: m.clanId,
          createdAt: { gt: m.lastReadAt },
          userId: { not: userId }, // Don't count own messages
        },
      });
      return { clanId: m.clanId, count: Math.min(count, 99) };
    })
  );

  const unreadMap = new Map(unreadCounts.map((u) => [u.clanId, u.count]));

  const chats = memberships
    .map((m) => {
      const lastMsg = lastMessageMap.get(m.clanId);
      return {
        clanId: m.clan.id,
        clanName: m.clan.name,
        clanAvatar: m.clan.avatar,
        tradingFocus: m.clan.tradingFocus,
        memberCount: m.clan._count.members,
        role: m.role,
        unreadCount: unreadMap.get(m.clanId) ?? 0,
        lastMessage: lastMsg
          ? {
              content:
                lastMsg.type === "TRADE_CARD"
                  ? "Shared a trade card"
                  : lastMsg.type === "TRADE_ACTION"
                    ? "Trade action"
                    : lastMsg.content?.slice(0, 80) ?? "",
              userName: lastMsg.user.name,
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : null,
        lastActivityAt: lastMsg?.createdAt.toISOString() ?? m.joinedAt.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());

  return NextResponse.json({ chats });
}

/**
 * POST /api/me/chats
 * Mark a clan chat as read.
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

  await db.clanMember.updateMany({
    where: { userId: session.user.id, clanId },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
