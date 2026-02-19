import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, TrendingUp, Trophy, Search, CalendarDays, ArrowRight } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Fetch user's clans, recent trades, upcoming events in parallel
  const [memberships, recentTrades, upcomingEvents, activeSeason] = await Promise.all([
    db.clanMember.findMany({
      where: { userId },
      include: {
        clan: {
          include: { _count: { select: { members: true } } },
        },
      },
      orderBy: { joinedAt: "desc" },
    }),
    db.trade.findMany({
      where: { userId },
      include: {
        tradeCard: { select: { instrument: true, direction: true, tags: true } },
        clan: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.tradingEvent.findMany({
      where: { isActive: true, startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
      take: 3,
    }),
    db.season.findFirst({ where: { status: "ACTIVE" } }),
  ]);

  // Fetch leaderboard rank if season exists
  let myRank: number | null = null;
  if (activeSeason) {
    const entry = await db.leaderboardEntry.findUnique({
      where: {
        seasonId_entityType_entityId_lens: {
          seasonId: activeSeason.id,
          entityType: "TRADER",
          entityId: userId,
          lens: "composite",
        },
      },
    });
    myRank = entry?.rank ?? null;
  }

  // Count total signal trades this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const tradeCount = await db.trade.count({
    where: { userId, createdAt: { gte: monthStart } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name || "Trader"}.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">My Clans</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{memberships.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Trades This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tradeCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Season Rank</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {myRank ? `#${myRank}` : "Unranked"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Season</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium truncate">
              {activeSeason?.name || "No active season"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Clans */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">My Clans</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/clans">
                View all <ArrowRight className="ms-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {memberships.length === 0 ? (
              <div className="space-y-3 text-center py-4">
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t joined any clans yet.
                </p>
                <div className="flex justify-center gap-2">
                  <Button size="sm" asChild>
                    <Link href="/clans/create">Create Clan</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/discover?tab=clans">
                      <Search className="me-1 h-3 w-3" /> Discover
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {memberships.slice(0, 5).map((m) => (
                  <Link
                    key={m.clan.id}
                    href={`/clans/${m.clan.id}`}
                    className="flex items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-accent/50"
                  >
                    <div>
                      <p className="font-medium">{m.clan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.role} &middot; {m.clan._count.members} members
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Trades</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTrades.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No trades yet. Join a clan and start trading!
              </p>
            ) : (
              <div className="space-y-2">
                {recentTrades.map((trade) => (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {trade.tradeCard.direction} {trade.tradeCard.instrument}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {trade.clan.name}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        trade.status === "TP1_HIT" || trade.status === "TP2_HIT"
                          ? "bg-green-100 text-green-800"
                          : trade.status === "SL_HIT"
                            ? "bg-red-100 text-red-800"
                            : trade.status === "OPEN"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {trade.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.instrument} &middot; {event.impact} impact
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.startTime).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
