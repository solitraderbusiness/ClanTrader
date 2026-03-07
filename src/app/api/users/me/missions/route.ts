import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [user, clanMembership, postCount, followCount] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
      },
    }),
    db.clanMember.findFirst({
      where: { userId },
      select: { clanId: true },
    }),
    db.channelPost.count({ where: { authorId: userId } }),
    db.follow.count({ where: { followerId: userId, followingType: "CLAN" } }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const hasClan = !!clanMembership;
  const firstClanId = clanMembership?.clanId;

  const missions = [
    {
      id: "explore",
      labelKey: "missions.explore",
      descriptionKey: "missions.exploreDesc",
      completed: followCount > 0 || hasClan,
      href: "/explore",
      icon: "Compass",
    },
    {
      id: "follow",
      labelKey: "missions.follow",
      descriptionKey: "missions.followDesc",
      completed: followCount > 0,
      href: "/explore",
      icon: "Eye",
    },
    {
      id: "clan",
      labelKey: "missions.joinClan",
      descriptionKey: "missions.joinClanDesc",
      completed: hasClan,
      href: "/explore",
      icon: "Users",
    },
    {
      id: "metatrader",
      labelKey: "missions.metatrader",
      descriptionKey: "missions.metatraderDesc",
      completed: user.role === "TRADER" || user.role === "ADMIN",
      href: "/settings/mt-accounts",
      icon: "BarChart3",
    },
    {
      id: "post",
      labelKey: "missions.post",
      descriptionKey: "missions.postDesc",
      completed: postCount > 0,
      href: firstClanId
        ? `/clans/${firstClanId}?tab=channel`
        : "/explore",
      icon: "Send",
    },
  ];

  return NextResponse.json({ missions });
}
