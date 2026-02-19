"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Subscription Plans</h1>

      {plans.length === 0 ? (
        <p className="text-muted-foreground">
          No plans configured. Seed data to create defaults.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {plan.name}
                  </CardTitle>
                  <Switch
                    checked={plan.isActive}
                    onCheckedChange={(checked) => toggleActive(plan.id, checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
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
                <div className="flex flex-wrap gap-1">
                  {(plan.entitlements as string[]).map((e) => (
                    <Badge key={e} variant="outline" className="text-[10px]">
                      {e}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
