"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { BadgeIconUpload } from "./BadgeIconUpload";
import { toast } from "sonner";

interface BadgeFormData {
  id?: string;
  key: string;
  category: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  requirementsJson: Record<string, unknown>;
  enabled: boolean;
  displayOrder: number;
}

interface BadgeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge: BadgeFormData | null;
  onSaved: () => void;
}

const EMPTY_FORM: BadgeFormData = {
  key: "",
  category: "RANK",
  name: "",
  description: null,
  iconUrl: null,
  requirementsJson: { type: "rank", min_closed_trades: 10 },
  enabled: true,
  displayOrder: 0,
};

export function BadgeFormDialog({
  open,
  onOpenChange,
  badge,
  onSaved,
}: BadgeFormDialogProps) {
  const [form, setForm] = useState<BadgeFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = !!badge?.id;

  useEffect(() => {
    if (badge) {
      setForm(badge);
    } else {
      setForm(EMPTY_FORM);
    }
  }, [badge]);

  function updateReq(key: string, value: unknown) {
    setForm((f) => ({
      ...f,
      requirementsJson: { ...f.requirementsJson, [key]: value },
    }));
  }

  function handleCategoryChange(cat: string) {
    let req: Record<string, unknown>;
    switch (cat) {
      case "RANK":
        req = { type: "rank", min_closed_trades: 10 };
        break;
      case "PERFORMANCE":
        req = { type: "performance", metric: "net_r", window: 50, op: ">=", value: 10 };
        break;
      case "TROPHY":
        req = { type: "trophy", season_id: "*", lens: "composite", rank_min: 1, rank_max: 1 };
        break;
      default:
        req = { type: "manual" };
    }
    setForm((f) => ({ ...f, category: cat, requirementsJson: req }));
  }

  function autoSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const url = isEdit
        ? `/api/admin/badges/${badge!.id}`
        : "/api/admin/badges";
      const method = isEdit ? "PUT" : "POST";

      const body = isEdit
        ? {
            name: form.name,
            description: form.description || undefined,
            iconUrl: form.iconUrl,
            requirementsJson: form.requirementsJson,
            enabled: form.enabled,
            displayOrder: form.displayOrder,
          }
        : {
            key: form.key,
            category: form.category,
            name: form.name,
            description: form.description || undefined,
            iconUrl: form.iconUrl || undefined,
            requirementsJson: form.requirementsJson,
            enabled: form.enabled,
            displayOrder: form.displayOrder,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save badge");
      }

      toast.success(isEdit ? "Badge updated" : "Badge created");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Badge" : "Create Badge"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Key */}
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({
                  ...f,
                  name,
                  ...(!isEdit ? { key: autoSlug(name) } : {}),
                }));
              }}
              placeholder="e.g. Gold"
              required
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label>Key (slug)</Label>
              <Input
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="e.g. rank-gold"
                pattern="^[a-z0-9-]+$"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Lowercase with hyphens. Cannot be changed after creation.
              </p>
            </div>
          )}

          {/* Category */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RANK">Rank</SelectItem>
                  <SelectItem value="PERFORMANCE">Performance</SelectItem>
                  <SelectItem value="TROPHY">Trophy</SelectItem>
                  <SelectItem value="OTHER">Other / Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value || null }))
              }
              placeholder="Optional description"
              rows={2}
            />
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <BadgeIconUpload
              currentUrl={form.iconUrl}
              onUploaded={(url) => setForm((f) => ({ ...f, iconUrl: url }))}
            />
          </div>

          {/* Requirements builder */}
          <div className="space-y-2 rounded-lg border p-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Requirements
            </Label>

            {form.category === "RANK" && (
              <div className="space-y-2">
                <Label>Min Closed Trades</Label>
                <Input
                  type="number"
                  min={1}
                  value={(form.requirementsJson.min_closed_trades as number) ?? 10}
                  onChange={(e) =>
                    updateReq("min_closed_trades", parseInt(e.target.value) || 1)
                  }
                />
              </div>
            )}

            {form.category === "PERFORMANCE" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Metric</Label>
                    <Select
                      value={(form.requirementsJson.metric as string) ?? "net_r"}
                      onValueChange={(v) => updateReq("metric", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="net_r">Net R</SelectItem>
                        <SelectItem value="avg_r">Avg R</SelectItem>
                        <SelectItem value="max_drawdown_r">Max Drawdown R</SelectItem>
                        <SelectItem value="win_rate">Win Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Window (trades)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={(form.requirementsJson.window as number) ?? 50}
                      onChange={(e) =>
                        updateReq("window", parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Operator</Label>
                    <Select
                      value={(form.requirementsJson.op as string) ?? ">="}
                      onValueChange={(v) => updateReq("op", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=">=">&gt;=</SelectItem>
                        <SelectItem value="<=">&lt;=</SelectItem>
                        <SelectItem value=">">&gt;</SelectItem>
                        <SelectItem value="<">&lt;</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={(form.requirementsJson.value as number) ?? 0}
                      onChange={(e) =>
                        updateReq("value", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              </>
            )}

            {form.category === "TROPHY" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Season ID</Label>
                  <Input
                    value={(form.requirementsJson.season_id as string) ?? "*"}
                    onChange={(e) => updateReq("season_id", e.target.value)}
                    placeholder='* = most recent'
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lens</Label>
                  <Select
                    value={(form.requirementsJson.lens as string) ?? "composite"}
                    onValueChange={(v) => updateReq("lens", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="composite">Composite</SelectItem>
                      <SelectItem value="profit">Profit</SelectItem>
                      <SelectItem value="low_risk">Low Risk</SelectItem>
                      <SelectItem value="consistency">Consistency</SelectItem>
                      <SelectItem value="risk_adjusted">Risk Adjusted</SelectItem>
                      <SelectItem value="activity">Activity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Rank Min</Label>
                    <Input
                      type="number"
                      min={1}
                      value={(form.requirementsJson.rank_min as number) ?? 1}
                      onChange={(e) =>
                        updateReq("rank_min", parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rank Max</Label>
                    <Input
                      type="number"
                      min={1}
                      value={(form.requirementsJson.rank_max as number) ?? 1}
                      onChange={(e) =>
                        updateReq("rank_max", parseInt(e.target.value) || 1)
                      }
                    />
                  </div>
                </div>
              </>
            )}

            {form.category === "OTHER" && (
              <p className="text-xs text-muted-foreground">
                Manual badges are awarded/revoked by admin action only.
              </p>
            )}
          </div>

          {/* Display Order + Enabled */}
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Display Order</Label>
              <Input
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    displayOrder: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, enabled: checked }))
                }
              />
              <Label className="text-xs">Enabled</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
