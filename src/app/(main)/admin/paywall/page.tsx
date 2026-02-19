"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";

interface PaywallRule {
  id: string;
  resourceType: string;
  name: string;
  description: string | null;
  freePreview: Record<string, boolean> | null;
  enabled: boolean;
}

const RULE_TIPS: Record<string, string> = {
  signal_details:
    "Controls what free users see on auto-posted signal cards in the public channel. When enabled, entry price, stop loss, and take profit values are hidden for non-Pro users.",
  tutorial_details:
    "Controls what free users see on tutorial posts. When enabled, images and detailed content are hidden for non-Pro users.",
};

const FIELD_LABELS: Record<string, string> = {
  showEntry: "Entry Price",
  showTargets: "Take Profit Targets",
  showStopLoss: "Stop Loss",
  showContent: "Text Content",
  showImages: "Images",
};

export default function PaywallPage() {
  const [rules, setRules] = useState<PaywallRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/paywall-rules")
      .then((r) => r.json())
      .then((data) => setRules(data.rules || []))
      .catch(() => toast.error("Failed to load rules"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleRule(id: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/admin/paywall-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) throw new Error();

      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled } : r))
      );
      toast.success(`Rule ${enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to toggle rule");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Paywall Rules</h1>
        <p className="text-sm text-muted-foreground">
          Control what free users can see vs. what requires a Pro subscription.
          Each rule defines which fields are visible or hidden for free users.
        </p>
      </div>

      {rules.length === 0 ? (
        <p className="text-muted-foreground">
          No paywall rules configured. Run seed to create defaults.
        </p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card
              key={rule.id}
              className={rule.enabled ? "border-amber-200 dark:border-amber-900" : ""}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {rule.name}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {rule.resourceType}
                    </Badge>
                    {RULE_TIPS[rule.resourceType] && (
                      <InfoTip>{RULE_TIPS[rule.resourceType]}</InfoTip>
                    )}
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {rule.description && (
                  <p className="text-xs text-muted-foreground">
                    {rule.description}
                  </p>
                )}
                {rule.freePreview && (
                  <div>
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">
                      Free user visibility:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(rule.freePreview).map(([field, show]) => (
                        <Badge
                          key={field}
                          variant={show ? "secondary" : "destructive"}
                          className="text-[10px]"
                        >
                          {FIELD_LABELS[field] || field}: {show ? "Visible" : "Hidden"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
