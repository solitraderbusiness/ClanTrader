"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { LENS_LABELS } from "@/lib/ranking-constants";
import { toast } from "sonner";
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

  return (
    <div className="space-y-4">
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
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <LeaderboardTable entries={entries} lens={lens} />
      )}
    </div>
  );
}
