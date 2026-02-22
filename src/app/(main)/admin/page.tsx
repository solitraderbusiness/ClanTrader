import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Flag,
  Shield,
  CreditCard,
  ScrollText,
  Users,
  MessageSquare,
  TrendingUp,
  Link2,
} from "lucide-react";

export default async function AdminDashboardPage() {
  const [
    flagCount,
    enabledFlagCount,
    ruleCount,
    planCount,
    logCount,
    userCount,
    clanCount,
    tradeCount,
    referralSignups,
  ] = await Promise.all([
    db.featureFlag.count(),
    db.featureFlag.count({ where: { enabled: true } }),
    db.paywallRule.count(),
    db.subscriptionPlan.count(),
    db.auditLog.count(),
    db.user.count(),
    db.clan.count(),
    db.trade.count(),
    db.referralEvent.count({ where: { type: "SIGNUP" } }),
  ]);

  const recentLogs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const stats = [
    {
      label: "Users",
      value: userCount,
      icon: Users,
      desc: "Registered accounts",
    },
    {
      label: "Clans",
      value: clanCount,
      icon: MessageSquare,
      desc: "Active clans",
    },
    {
      label: "Trades",
      value: tradeCount,
      icon: TrendingUp,
      desc: "Total trades tracked",
    },
    {
      label: "Feature Flags",
      value: `${enabledFlagCount}/${flagCount}`,
      icon: Flag,
      desc: "Enabled / total",
    },
    {
      label: "Paywall Rules",
      value: ruleCount,
      icon: Shield,
      desc: "Content access rules",
    },
    {
      label: "Plans",
      value: planCount,
      icon: CreditCard,
      desc: "Subscription tiers",
    },
    {
      label: "Audit Logs",
      value: logCount.toLocaleString(),
      icon: ScrollText,
      desc: "Activity entries",
    },
    {
      label: "Referrals",
      value: referralSignups,
      icon: Link2,
      desc: "Signups from invites",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Platform overview and recent activity.
        </p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No activity yet. Actions like toggling feature flags, generating
              demo data, and managing clans will appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between border-b pb-2 text-sm last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {log.action}
                    </Badge>
                    <span className="text-muted-foreground">
                      {log.entityType}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {log.entityId.slice(0, 8)}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
