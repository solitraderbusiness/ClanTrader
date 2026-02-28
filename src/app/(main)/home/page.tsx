import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { HomeFeed } from "@/components/home/HomeFeed";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Get active season for widget
  const activeSeason = await db.season.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  // Get user stats for quick glance
  const [clanCount, followCount, user] = await Promise.all([
    db.clanMember.count({ where: { userId } }),
    db.follow.count({ where: { followerId: userId, followingType: "CLAN" } }),
    db.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);

  return (
    <HomeFeed
      userId={userId}
      userName={session.user.name || "Trader"}
      activeSeason={
        activeSeason
          ? {
              name: activeSeason.name,
              startDate: activeSeason.startDate.toISOString(),
              endDate: activeSeason.endDate.toISOString(),
            }
          : null
      }
      clanCount={clanCount}
      followCount={followCount}
      hasEmail={!!user?.email}
      role={session.user.role}
    />
  );
}
