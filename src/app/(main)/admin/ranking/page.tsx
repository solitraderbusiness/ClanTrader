"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { RankingWeights } from "@/types/ranking";

interface RankingConfig {
  key: string;
  lenses: string[];
  weights: RankingWeights;
  minTrades: number;
}

export default function RankingConfigPage() {
  const [config, setConfig] = useState<RankingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/ranking-config")
      .then((r) => r.json())
      .then((data) => setConfig(data.config))
      .catch(() => toast.error("Failed to load config"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/ranking-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weights: config.weights,
          minTrades: config.minTrades,
        }),
      });

      if (!res.ok) throw new Error();
      toast.success("Ranking config saved");
    } catch {
      toast.error("Failed to save config");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ranking Config</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Composite Weights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(config.weights) as (keyof RankingWeights)[]).map(
            (key) => (
              <div key={key} className="flex items-center gap-3">
                <Label className="w-32 text-sm capitalize">
                  {key.replace("_", " ")}
                </Label>
                <Input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.weights[key]}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      weights: {
                        ...config.weights,
                        [key]: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="max-w-[100px]"
                />
              </div>
            )
          )}

          <div className="flex items-center gap-3 pt-2">
            <Label className="w-32 text-sm">Min Trades</Label>
            <Input
              type="number"
              value={config.minTrades}
              onChange={(e) =>
                setConfig({
                  ...config,
                  minTrades: parseInt(e.target.value) || 0,
                })
              }
              className="max-w-[100px]"
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="mt-4">
            {saving ? "Saving..." : "Save Config"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
