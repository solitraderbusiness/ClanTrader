"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BadgeTable } from "@/components/admin/BadgeTable";
import { BadgeFormDialog } from "@/components/admin/BadgeFormDialog";
import { BadgeReorderList } from "@/components/admin/BadgeReorderList";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
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

export default function AdminBadgesPage() {
  const { t } = useTranslation();
  const [badges, setBadges] = useState<BadgeDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [enabledFilter, setEnabledFilter] = useState<string>("ALL");
  const [showDeleted, setShowDeleted] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editBadge, setEditBadge] = useState<BadgeDef | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);

  const fetchBadges = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      if (enabledFilter !== "ALL") params.set("enabled", enabledFilter);
      if (showDeleted) params.set("includeDeleted", "true");

      const res = await fetch(`/api/admin/badges?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBadges(data.badges || []);
    } catch {
      toast.error(t("admin.failedToLoadBadges"));
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, enabledFilter, showDeleted, t]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  function handleEdit(badge: BadgeDef) {
    setEditBadge(badge);
    setFormOpen(true);
  }

  function handleCreate() {
    setEditBadge(null);
    setFormOpen(true);
  }

  const rankBadges = badges.filter((b) => b.category === "RANK" && !b.isDeleted);

  if (loading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.badgesTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.badgesDesc")}{" "}
            <Link
              href="/admin/badges/recompute"
              className="text-primary hover:underline"
            >
              {t("admin.recomputeDryRun")}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          {rankBadges.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReorderOpen(true)}
            >
              <ArrowUpDown className="me-2 h-3.5 w-3.5" />
              {t("admin.reorderLadder")}
            </Button>
          )}
          <Button size="sm" onClick={handleCreate}>
            <Plus className="me-2 h-3.5 w-3.5" />
            {t("admin.createBadge")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            <SelectItem value="RANK">Rank</SelectItem>
            <SelectItem value="PERFORMANCE">Performance</SelectItem>
            <SelectItem value="TROPHY">Trophy</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select value={enabledFilter} onValueChange={setEnabledFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="true">Enabled</SelectItem>
            <SelectItem value="false">Disabled</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch checked={showDeleted} onCheckedChange={setShowDeleted} />
          <Label className="text-xs">{t("admin.showDeleted")}</Label>
        </div>
      </div>

      {/* Badge Table */}
      <BadgeTable
        badges={badges}
        onEdit={handleEdit}
        onRefresh={fetchBadges}
      />

      {/* Create/Edit Dialog */}
      <BadgeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        badge={editBadge}
        onSaved={fetchBadges}
      />

      {/* Reorder Dialog */}
      <Dialog open={reorderOpen} onOpenChange={setReorderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.reorderRankLadder")}</DialogTitle>
          </DialogHeader>
          <BadgeReorderList
            badges={rankBadges}
            onSaved={() => {
              setReorderOpen(false);
              fetchBadges();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
