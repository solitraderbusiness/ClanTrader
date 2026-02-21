"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye } from "lucide-react";
import type { BadgeCategory } from "@prisma/client";

interface BadgeDef {
  id: string;
  key: string;
  category: BadgeCategory;
  name: string;
  requirementsJson: Record<string, unknown>;
}

interface DryRunEntry {
  userId: string;
  userName: string | null;
  currentValue: number | null;
}

interface DryRunResult {
  wouldGain: DryRunEntry[];
  wouldLose: DryRunEntry[];
  unchanged: number;
}

export function DryRunPreview() {
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<DryRunResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/badges?enabled=true")
      .then((r) => r.json())
      .then((data) => setBadges(data.badges || []))
      .catch(() => toast.error("Failed to load badges"));
  }, []);

  function handleBadgeSelect(id: string) {
    setSelectedId(id);
    const badge = badges.find((b) => b.id === id);
    if (badge) {
      setOverrides({ ...badge.requirementsJson });
    }
    setResult(null);
  }

  function updateOverride(key: string, value: unknown) {
    setOverrides((o) => ({ ...o, [key]: value }));
  }

  async function runDryRun() {
    if (!selectedId) {
      toast.error("Select a badge first");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/badges/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badgeId: selectedId,
          requirementsJson: overrides,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Dry run failed");
      }

      const data: DryRunResult = await res.json();
      setResult(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dry run failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3 pb-4">
          <CardTitle className="text-sm">Dry Run Preview</CardTitle>
          <p className="text-[10px] text-muted-foreground">
            Preview the impact of changing badge requirements. No data is
            modified.
          </p>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Badge</Label>
              <Select value={selectedId} onValueChange={handleBadgeSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select badge..." />
                </SelectTrigger>
                <SelectContent>
                  {badges.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Override inputs based on type */}
            {overrides.type === "rank" && (
              <div className="space-y-1">
                <Label className="text-xs">Min Closed Trades</Label>
                <Input
                  type="number"
                  min={1}
                  value={(overrides.min_closed_trades as number) ?? 10}
                  onChange={(e) =>
                    updateOverride(
                      "min_closed_trades",
                      parseInt(e.target.value) || 1
                    )
                  }
                />
              </div>
            )}

            {overrides.type === "performance" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Window</Label>
                  <Input
                    type="number"
                    min={1}
                    value={(overrides.window as number) ?? 50}
                    onChange={(e) =>
                      updateOverride("window", parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Value</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(overrides.value as number) ?? 0}
                    onChange={(e) =>
                      updateOverride("value", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
              </div>
            )}

            {overrides.type === "trophy" && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Rank Min</Label>
                  <Input
                    type="number"
                    min={1}
                    value={(overrides.rank_min as number) ?? 1}
                    onChange={(e) =>
                      updateOverride("rank_min", parseInt(e.target.value) || 1)
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rank Max</Label>
                  <Input
                    type="number"
                    min={1}
                    value={(overrides.rank_max as number) ?? 1}
                    onChange={(e) =>
                      updateOverride("rank_max", parseInt(e.target.value) || 1)
                    }
                  />
                </div>
              </div>
            )}

            <Button
              size="sm"
              onClick={runDryRun}
              disabled={loading || !selectedId}
            >
              <Eye className="me-2 h-3 w-3" />
              {loading ? "Running..." : "Preview Impact"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Results */}
      {result && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-green-200 dark:border-green-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-green-600">
                Would Gain ({result.wouldGain.length})
              </CardTitle>
              {result.wouldGain.length === 0 ? (
                <p className="text-xs text-muted-foreground">No users would gain this badge.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {result.wouldGain.map((u) => (
                    <div
                      key={u.userId}
                      className="flex items-center justify-between text-xs"
                    >
                      <span>{u.userName || u.userId}</span>
                      {u.currentValue != null && (
                        <span className="text-muted-foreground">
                          {u.currentValue.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardHeader>
          </Card>

          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-red-600">
                Would Lose ({result.wouldLose.length})
              </CardTitle>
              {result.wouldLose.length === 0 ? (
                <p className="text-xs text-muted-foreground">No users would lose this badge.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {result.wouldLose.map((u) => (
                    <div
                      key={u.userId}
                      className="flex items-center justify-between text-xs"
                    >
                      <span>{u.userName || u.userId}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardHeader>
          </Card>

          <div className="sm:col-span-2 text-xs text-muted-foreground">
            {result.unchanged} users unchanged.
          </div>
        </div>
      )}
    </div>
  );
}
