"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  updatedAt: string;
}

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/feature-flags")
      .then((r) => r.json())
      .then((data) => setFlags(data.flags || []))
      .catch(() => toast.error("Failed to load flags"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleFlag(key: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/admin/feature-flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      if (!res.ok) throw new Error();

      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled } : f))
      );
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to toggle flag");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Feature Flags</h1>

      {flags.length === 0 ? (
        <p className="text-muted-foreground">
          No feature flags configured. Seed data to create default flags.
        </p>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => (
            <Card key={flag.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {flag.name}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {flag.key}
                    </Badge>
                  </div>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={(checked) => toggleFlag(flag.key, checked)}
                  />
                </div>
              </CardHeader>
              {flag.description && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground">
                    {flag.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
