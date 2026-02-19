"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  entitlements: string[];
  isActive: boolean;
  sortOrder: number;
}

const ENTITLEMENT_TIPS: Record<string, string> = {
  VIEW_SIGNAL_DETAILS:
    "Access to full signal details (entry price, stop loss, take profit) in channel posts.",
  ADVANCED_FILTERS:
    "Access to advanced filtering and sorting options on the leaderboard and discover pages.",
  PRIORITY_SUPPORT: "Priority customer support with faster response times.",
  CUSTOM_ALERTS: "Ability to set custom price alerts and event notifications.",
  AI_ANALYSIS: "Access to AI-powered trade analysis and suggestions.",
  EXPORT_DATA: "Ability to export trade history, statements, and analytics as CSV/PDF.",
  UNLIMITED_CLANS: "Join or create unlimited clans (free users have a cap).",
  VIEW_TUTORIAL_DETAILS:
    "Access to full tutorial content including images and detailed text.",
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((data) => setPlans(data.plans || []))
      .catch(() => toast.error("Failed to load plans"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleActive(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/admin/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (!res.ok) throw new Error();

      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive } : p))
      );
      toast.success(`Plan ${isActive ? "activated" : "deactivated"}`);
    } catch {
      toast.error("Failed to update plan");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const activeCount = plans.filter((p) => p.isActive).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Subscription Plans</h1>
        <p className="text-sm text-muted-foreground">
          Manage subscription tiers and their entitlements. Active plans are
          visible to users on the pricing page.{" "}
          <span className="font-medium">
            {activeCount}/{plans.length}
          </span>{" "}
          active.
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="text-muted-foreground">
          No plans configured. Run seed to create defaults.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.isActive
                  ? "border-green-200 dark:border-green-900"
                  : "opacity-60"
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {plan.name}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {plan.slug}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {plan.isActive ? "Active" : "Inactive"}
                    </span>
                    <Switch
                      checked={plan.isActive}
                      onCheckedChange={(checked) =>
                        toggleActive(plan.id, checked)
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xl font-bold">
                  {plan.price.toLocaleString()} {plan.currency}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan.interval}
                  </span>
                </p>
                {plan.description && (
                  <p className="text-xs text-muted-foreground">
                    {plan.description}
                  </p>
                )}
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">
                    Entitlements:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(plan.entitlements as string[]).map((e) => (
                      <span key={e} className="inline-flex items-center gap-0.5">
                        <Badge variant="outline" className="text-[10px]">
                          {e.replace(/_/g, " ")}
                        </Badge>
                        {ENTITLEMENT_TIPS[e] && (
                          <InfoTip side="top">
                            {ENTITLEMENT_TIPS[e]}
                          </InfoTip>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
