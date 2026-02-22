import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getAdminReferralOverview,
  getTopReferrers,
  getDailyStats,
} from "@/services/referral.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link2, MousePointerClick, UserPlus, Percent } from "lucide-react";
import Link from "next/link";

export default async function AdminReferralsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/home");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [overview, topReferrers, dailyStats] = await Promise.all([
    getAdminReferralOverview(),
    getTopReferrers(20),
    getDailyStats(thirtyDaysAgo, new Date()),
  ]);

  const stats = [
    {
      label: "Link Shares",
      value: overview.shares,
      icon: Link2,
      desc: "Copy + native share",
    },
    {
      label: "Link Clicks",
      value: overview.clicks,
      icon: MousePointerClick,
      desc: "Visits to /join?ref=",
    },
    {
      label: "Signups",
      value: overview.signups,
      icon: UserPlus,
      desc: "Registered via referral",
    },
    {
      label: "Conversion",
      value: `${overview.conversionRate}%`,
      icon: Percent,
      desc: "Clicks \u2192 signups",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referral Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Track invite link performance and referral conversions.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Referrers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Referrers</CardTitle>
        </CardHeader>
        <CardContent>
          {topReferrers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No referral signups yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-muted-foreground">
                    <th className="pb-2 pe-4 text-start font-medium">User</th>
                    <th className="pb-2 pe-4 text-start font-medium">Shares</th>
                    <th className="pb-2 pe-4 text-start font-medium">Clicks</th>
                    <th className="pb-2 pe-4 text-start font-medium">Signups</th>
                    <th className="pb-2 text-start font-medium">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {topReferrers.map((referrer) => {
                    const initials = referrer.name
                      ? referrer.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : "?";

                    return (
                      <tr key={referrer.referrerId} className="border-b last:border-0">
                        <td className="py-2.5 pe-4">
                          <Link
                            href={`/profile/${referrer.username || referrer.referrerId}`}
                            className="flex items-center gap-2 hover:underline"
                          >
                            <Avatar className="h-7 w-7">
                              <AvatarImage
                                src={referrer.avatar || undefined}
                                alt={referrer.name || ""}
                              />
                              <AvatarFallback className="text-[10px]">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium leading-tight">
                                {referrer.name || "Unknown"}
                              </p>
                              {referrer.username && (
                                <p className="truncate text-xs text-muted-foreground">
                                  @{referrer.username}
                                </p>
                              )}
                            </div>
                          </Link>
                        </td>
                        <td className="py-2.5 pe-4">{referrer.shares}</td>
                        <td className="py-2.5 pe-4">{referrer.clicks}</td>
                        <td className="py-2.5 pe-4">
                          <Badge variant="secondary">{referrer.signups}</Badge>
                        </td>
                        <td className="py-2.5">{referrer.conversionRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Daily Activity (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dailyStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No referral activity in the last 30 days.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-muted-foreground">
                    <th className="pb-2 pe-4 text-start font-medium">Date</th>
                    <th className="pb-2 pe-4 text-start font-medium">Shares</th>
                    <th className="pb-2 pe-4 text-start font-medium">Clicks</th>
                    <th className="pb-2 text-start font-medium">Signups</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyStats.map((day) => (
                    <tr key={day.date} className="border-b last:border-0">
                      <td className="py-2 pe-4 font-mono text-xs">
                        {day.date}
                      </td>
                      <td className="py-2 pe-4">{day.shares}</td>
                      <td className="py-2 pe-4">{day.clicks}</td>
                      <td className="py-2">{day.signups}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
