import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user, clanCount, postCount, followCount] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        bio: true,
        tradingStyle: true,
        preferredPairs: true,
        role: true,
      },
    }),
    db.clanMember.count({ where: { userId } }),
    db.channelPost.count({ where: { authorId: userId } }),
    db.follow.count({ where: { followerId: userId, followingType: "CLAN" } }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profileComplete =
    !!user.bio && !!user.tradingStyle && user.preferredPairs.length > 0;

  const missions = [
    {
      id: "profile",
      label: "Complete your profile",
      description: "Add your bio, trading style, and preferred pairs",
      completed: profileComplete,
      href: "/settings/profile",
    },
    {
      id: "clan",
      label: "Join a clan",
      description: "Find a team of traders to compete with",
      completed: clanCount > 0,
      href: "/explore",
    },
    {
      id: "metatrader",
      label: "Connect MetaTrader",
      description: "Become a Verified Trader with live trade data",
      completed: user.role === "TRADER" || user.role === "ADMIN",
      href: "/settings/mt-accounts",
    },
    {
      id: "post",
      label: "Make your first post",
      description: "Share a trade signal or insight with your clan",
      completed: postCount > 0,
      href: "/home",
    },
    {
      id: "follow",
      label: "Follow a clan",
      description: "Stay updated with trade signals and announcements",
      completed: followCount > 0,
      href: "/explore",
    },
  ];

  return NextResponse.json({ missions });
}
