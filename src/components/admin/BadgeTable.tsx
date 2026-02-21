"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { BadgeCategory } from "@prisma/client";

interface BadgeDef {
  id: string;
  key: string;
  category: BadgeCategory;
  name: string;
  description: string | null;
  iconUrl: string | null;
  requirementsJson: Record<string, unknown>;
  enabled: boolean;
  displayOrder: number;
  isDeleted: boolean;
  _count?: { userBadges: number };
}

interface BadgeTableProps {
  badges: BadgeDef[];
  onEdit: (badge: BadgeDef) => void;
  onRefresh: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  RANK: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  PERFORMANCE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  TROPHY: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  OTHER: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

function formatRequirements(req: Record<string, unknown>): string {
  switch (req.type) {
    case "rank":
      return `${req.min_closed_trades} trades`;
    case "performance":
      return `${req.metric} ${req.op} ${req.value} (${req.window} trades)`;
    case "trophy":
      return `Rank ${req.rank_min}-${req.rank_max} (${req.lens})`;
    case "manual":
      return "Manual";
    default:
      return "—";
  }
}

export function BadgeTable({ badges, onEdit, onRefresh }: BadgeTableProps) {
  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      const res = await fetch(`/api/admin/badges/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(enabled ? "Badge enabled" : "Badge disabled");
      onRefresh();
    } catch {
      toast.error("Failed to toggle badge");
    }
  }

  async function deleteBadge(id: string) {
    try {
      const res = await fetch(`/api/admin/badges/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Badge soft-deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete badge");
    }
  }

  async function restoreBadge(id: string) {
    try {
      const res = await fetch(`/api/admin/badges/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });
      if (!res.ok) throw new Error();
      toast.success("Badge restored (disabled)");
      onRefresh();
    } catch {
      toast.error("Failed to restore badge");
    }
  }

  if (badges.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No badges found. Create one to get started.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="px-2 py-2 text-start font-medium">Icon</th>
            <th className="px-2 py-2 text-start font-medium">Name / Key</th>
            <th className="px-2 py-2 text-start font-medium">Category</th>
            <th className="px-2 py-2 text-start font-medium">Requirements</th>
            <th className="px-2 py-2 text-center font-medium">Enabled</th>
            <th className="px-2 py-2 text-center font-medium">Holders</th>
            <th className="px-2 py-2 text-end font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {badges.map((badge) => (
            <tr
              key={badge.id}
              className={`border-b ${badge.isDeleted ? "opacity-50" : ""}`}
            >
              <td className="px-2 py-2">
                {badge.iconUrl ? (
                  <img
                    src={badge.iconUrl}
                    alt=""
                    className="h-8 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-bold text-muted-foreground">
                    {badge.name[0]}
                  </div>
                )}
              </td>
              <td className="px-2 py-2">
                <div className={badge.isDeleted ? "line-through" : ""}>
                  <p className="font-medium">{badge.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {badge.key}
                  </p>
                </div>
              </td>
              <td className="px-2 py-2">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[badge.category] ?? ""}`}
                >
                  {badge.category}
                </span>
              </td>
              <td className="px-2 py-2 text-xs text-muted-foreground">
                {formatRequirements(badge.requirementsJson)}
              </td>
              <td className="px-2 py-2 text-center">
                <Switch
                  checked={badge.enabled}
                  onCheckedChange={(checked) =>
                    toggleEnabled(badge.id, checked)
                  }
                  disabled={badge.isDeleted}
                />
              </td>
              <td className="px-2 py-2 text-center">
                <Badge variant="outline" className="text-[10px]">
                  {badge._count?.userBadges ?? 0}
                </Badge>
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center justify-end gap-1">
                  {badge.isDeleted ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => restoreBadge(badge.id)}
                      title="Restore"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onEdit(badge)}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => deleteBadge(badge.id)}
                        title="Soft Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
