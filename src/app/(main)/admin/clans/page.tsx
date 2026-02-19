"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Clan Management</h1>

      {clans.length === 0 ? (
        <p className="text-muted-foreground">No clans found</p>
      ) : (
        <div className="space-y-3">
          {clans.map((clan) => (
            <Card key={clan.id}>
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
                    <span className="text-xs text-muted-foreground">Featured</span>
                    <Switch
                      checked={clan.isFeatured}
                      onCheckedChange={(checked) =>
                        toggleFeatured(clan.id, checked)
                      }
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">
                  Created by {clan.createdBy.name || "Unknown"}
                  {clan.visibilityOverride && (
                    <span className="ms-2">
                      Visibility: {clan.visibilityOverride}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
