"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LENS_LABELS } from "@/lib/ranking-constants";
import { toast } from "sonner";
import { BarChart3 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { LeaderboardLens } from "@/types/ranking";
import type { TraderStatementMetrics } from "@/types/trader-statement";

interface LeaderboardEntry {
  id: string;
  entityId: string;
  rank: number | null;
  lens: string;
  metrics: TraderStatementMetrics & { score: number };
  user: { id: string; name: string | null; avatar: string | null } | null;
}

const LENSES: LeaderboardLens[] = [
  "composite",
  "profit",
  "consistency",
  "risk_adjusted",
  "low_risk",
  "activity",
];

export function LeaderboardClient() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lens, setLens] = useState<LeaderboardLens>("composite");

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leaderboard?lens=${lens}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      toast.error("Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [lens]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const isSpectator = session?.user?.role === "SPECTATOR";

  return (
    <div className="space-y-4">
      {isSpectator && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <BarChart3 className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">
              {t("leaderboard.viewerHint")}
            </p>
          </div>
          <Button asChild size="sm" variant="default">
            <Link href="/settings/mt-accounts">{t("leaderboard.connectMt")}</Link>
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {LENSES.map((l) => (
          <Button
            key={l}
            variant={lens === l ? "default" : "outline"}
            size="sm"
            onClick={() => setLens(l)}
          >
            {LENS_LABELS[l]}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : (
        <LeaderboardTable entries={entries} lens={lens} />
      )}
    </div>
  );
}
