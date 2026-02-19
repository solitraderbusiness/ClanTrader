"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";

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
  const [clans, setClans] = useState<AdminClan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/clans")
      .then((r) => r.json())
      .then((data) => setClans(data.clans || []))
      .catch(() => toast.error("Failed to load clans"))
      .finally(() => setLoading(false));
  }, []);

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
      toast.success(`Clan ${isFeatured ? "featured" : "unfeatured"}`);
    } catch {
      toast.error("Failed to update clan");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading...</p>;
  }

  const featuredCount = clans.filter((c) => c.isFeatured).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Clan Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage clan visibility and featured status on the Discover page.{" "}
          <span className="font-medium">{featuredCount}</span> featured out of{" "}
          <span className="font-medium">{clans.length}</span> total clans.
        </p>
      </div>

      {clans.length === 0 ? (
        <p className="text-muted-foreground">No clans found</p>
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
                      Featured
                      <InfoTip side="left">
                        Featured clans appear at the top of the Discover page
                        with a special badge. Use this to promote high-quality
                        or trusted clans.
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
                  Created by{" "}
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
