"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { TraderStatementMetrics } from "@/types/trader-statement";

interface LeaderboardEntry {
  id: string;
  entityId: string;
  rank: number | null;
  lens: string;
  metrics: TraderStatementMetrics & { score: number };
  user: { id: string; name: string | null; avatar: string | null } | null;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  lens?: string;
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No rankings available yet. Rankings are calculated from signal-tagged trades.
      </p>
    );
  }

  return (
    <div className="rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-start">#</th>
            <th className="px-3 py-2 text-start">Trader</th>
            <th className="px-3 py-2 text-end">Score</th>
            <th className="hidden px-3 py-2 text-end sm:table-cell">Win Rate</th>
            <th className="hidden px-3 py-2 text-end sm:table-cell">Total R</th>
            <th className="hidden px-3 py-2 text-end md:table-cell">Signals</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b last:border-0">
              <td className="px-3 py-2">
                {entry.rank && entry.rank <= 3 ? (
                  <Badge
                    variant={
                      entry.rank === 1
                        ? "default"
                        : entry.rank === 2
                          ? "secondary"
                          : "outline"
                    }
                    className="text-xs"
                  >
                    #{entry.rank}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">#{entry.rank}</span>
                )}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage
                      src={entry.user?.avatar || undefined}
                      alt={entry.user?.name || ""}
                    />
                    <AvatarFallback className="text-[10px]">
                      {(entry.user?.name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {entry.user?.name || "Unknown"}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2 text-end font-mono">
                {entry.metrics.score?.toFixed(2) || "0.00"}
              </td>
              <td className="hidden px-3 py-2 text-end sm:table-cell">
                {((entry.metrics.winRate || 0) * 100).toFixed(0)}%
              </td>
              <td className="hidden px-3 py-2 text-end sm:table-cell">
                {(entry.metrics.totalRMultiple || 0).toFixed(1)}R
              </td>
              <td className="hidden px-3 py-2 text-end md:table-cell">
                {entry.metrics.signalCount || 0}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
