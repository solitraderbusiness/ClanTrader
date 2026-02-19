import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flag, Shield, CreditCard, ScrollText, Users, MessageSquare } from "lucide-react";

export default async function AdminDashboardPage() {
  const [flagCount, ruleCount, planCount, logCount, userCount, clanCount] =
    await Promise.all([
      db.featureFlag.count(),
      db.paywallRule.count(),
      db.subscriptionPlan.count(),
      db.auditLog.count(),
      db.user.count(),
      db.clan.count(),
    ]);

  const recentLogs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const stats = [
    { label: "Feature Flags", value: flagCount, icon: Flag },
    { label: "Paywall Rules", value: ruleCount, icon: Shield },
    { label: "Plans", value: planCount, icon: CreditCard },
    { label: "Audit Logs", value: logCount, icon: ScrollText },
    { label: "Users", value: userCount, icon: Users },
    { label: "Clans", value: clanCount, icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between border-b pb-2 text-sm last:border-0"
                >
                  <div>
                    <span className="font-medium">{log.action}</span>
                    <span className="ms-2 text-muted-foreground">
                      {log.entityType}:{log.entityId.slice(0, 8)}
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
