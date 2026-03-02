"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

interface AdminClan {
  id: string;
  name: string;
  tradingFocus: string | null;
  isPublic: boolean;
  isFeatured: boolean;
  visibilityOverride: string | null;
  adminNotes: string | null;
  tier: string;
  _count: { members: number };
  createdBy: { id: string; name: string | null };
}

export default function AdminClansPage() {
  const { t } = useTranslation();
  const [clans, setClans] = useState<AdminClan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/clans")
      .then((r) => r.json())
      .then((data) => setClans(data.clans || []))
      .catch(() => toast.error(t("admin.failedToLoadClans")))
      .finally(() => setLoading(false));
  }, [t]);

  async function toggleFeatured(clanId: string, isFeatured: boolean) {
    try {
      const res = await fetch(`/api/admin/clans/${clanId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFeatured }),
      });

      if (!res.ok) throw new Error();

      setClans((prev) =>
        prev.map((c) => (c.id === clanId ? { ...c, isFeatured } : c))
      );
      toast.success(isFeatured ? t("admin.clanFeatured") : t("admin.clanUnfeatured"));
    } catch {
      toast.error(t("admin.failedToUpdateClan"));
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  const featuredCount = clans.filter((c) => c.isFeatured).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t("admin.clanManagement")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("admin.manageClanVisibility")}{" "}
          <span className="font-medium">{featuredCount}</span> featured out of{" "}
          <span className="font-medium">{clans.length}</span> total clans.
        </p>
      </div>

      {clans.length === 0 ? (
        <p className="text-muted-foreground">{t("admin.noClansFound")}</p>
      ) : (
        <div className="space-y-3">
          {clans.map((clan) => (
            <Card
              key={clan.id}
              className={
                clan.isFeatured
                  ? "border-amber-200 dark:border-amber-900"
                  : ""
              }
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">
                      {clan.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-[10px]">
                      {clan.tier}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {clan._count.members} members
                    </Badge>
                    {clan.tradingFocus && (
                      <Badge variant="outline" className="text-[10px]">
                        {clan.tradingFocus}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {t("admin.featuredLabel")}
                      <InfoTip side="left">
                        {t("admin.featuredTip")}
                      </InfoTip>
                    </span>
                    <Switch
                      checked={clan.isFeatured}
                      onCheckedChange={(checked) =>
                        toggleFeatured(clan.id, checked)
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {t("admin.createdBy")}{" "}
                  <span className="font-medium">
                    {clan.createdBy.name || "Unknown"}
                  </span>
                  {clan.isPublic ? (
                    <Badge
                      variant="outline"
                      className="ms-2 text-[10px] text-green-600"
                    >
                      Public
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="ms-2 text-[10px] text-yellow-600"
                    >
                      Private
                    </Badge>
                  )}
                </p>
                {clan.visibilityOverride && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    Visibility override:{" "}
                    <Badge variant="destructive" className="text-[10px]">
                      {clan.visibilityOverride}
                    </Badge>
                    <InfoTip side="right">
                      Admin visibility override hides or force-shows this clan
                      on Discover regardless of its public/private setting. Used
                      for moderation.
                    </InfoTip>
                  </p>
                )}
                {clan.adminNotes && (
                  <p className="text-xs italic text-muted-foreground">
                    Note: {clan.adminNotes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
