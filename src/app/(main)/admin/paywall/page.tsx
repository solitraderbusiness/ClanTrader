"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface PaywallRule {
  id: string;
  resourceType: string;
  name: string;
  description: string | null;
  freePreview: Record<string, boolean> | null;
  enabled: boolean;
}

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
      <h1 className="text-2xl font-bold">Paywall Rules</h1>

      {rules.length === 0 ? (
        <p className="text-muted-foreground">
          No paywall rules configured. Seed data to create defaults.
        </p>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {rule.name}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {rule.resourceType}
                    </Badge>
                  </div>
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {rule.description && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    {rule.description}
                  </p>
                )}
                {rule.freePreview && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(rule.freePreview).map(([field, show]) => (
                      <Badge
                        key={field}
                        variant={show ? "secondary" : "destructive"}
                        className="text-[10px]"
                      >
                        {field}: {show ? "visible" : "hidden"}
                      </Badge>
                    ))}
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
