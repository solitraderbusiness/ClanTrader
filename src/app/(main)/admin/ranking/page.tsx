"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";
import type { RankingWeights } from "@/types/ranking";

interface RankingConfig {
  key: string;
  lenses: string[];
  weights: RankingWeights;
  minTrades: number;
}

const WEIGHT_TIPS: Record<string, string> = {
  profit:
    "How much total R-multiple (cumulative profit relative to risk) matters in the composite score. Higher = more reward for big winners.",
  low_risk:
    "Rewards traders whose worst single trade wasn't catastrophic. Higher = more reward for protecting downside.",
  consistency:
    "Rewards high win-rate traders. A trader who wins 8/10 trades scores better here than one who wins 5/10.",
  risk_adjusted:
    "Rewards traders with the best average R-multiple per trade. Favors quality over quantity.",
  activity:
    "Rewards traders who post more signals. Higher = more credit for being active. Keeps the leaderboard from being dominated by traders with just 1-2 lucky trades.",
};

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

  const totalWeight = Object.values(config.weights).reduce(
    (sum, v) => sum + v,
    0
  );
  const isValid = Math.abs(totalWeight - 1) < 0.01;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Ranking Config</h1>
        <p className="text-sm text-muted-foreground">
          Configure how the composite leaderboard score is calculated. Each
          weight controls how much a particular metric contributes to the final
          ranking. Weights should add up to 1.0.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Composite Weights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(Object.keys(config.weights) as (keyof RankingWeights)[]).map(
            (key) => (
              <div key={key} className="flex items-center gap-3">
                <Label className="w-36 text-sm capitalize flex items-center gap-1.5">
                  {key.replace("_", " ")}
                  {WEIGHT_TIPS[key] && (
                    <InfoTip side="right">{WEIGHT_TIPS[key]}</InfoTip>
                  )}
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

          <div className="pt-2 text-xs">
            <span
              className={
                isValid
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }
            >
              Total: {totalWeight.toFixed(2)}{" "}
              {isValid ? "(valid)" : "(should be 1.00)"}
            </span>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t">
            <Label className="w-36 text-sm flex items-center gap-1.5">
              Min Trades
              <InfoTip side="right">
                Minimum number of signal trades a trader must have before
                appearing on the leaderboard. Prevents ranking traders with too
                few trades where luck dominates skill.
              </InfoTip>
            </Label>
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

          <Button onClick={handleSave} disabled={saving || !isValid} className="mt-4">
            {saving ? "Saving..." : "Save Config"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
