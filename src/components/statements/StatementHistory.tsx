"use client";

import { TraderStatementCard } from "./TraderStatementCard";
import type { TraderStatementMetrics } from "@/types/trader-statement";

interface Statement {
  id: string;
  periodType: string;
  periodKey: string;
  tradeCount: number;
  metrics: TraderStatementMetrics;
  calculatedAt: string;
  user?: { id: string; name: string | null; avatar: string | null };
  clan?: { id: string; name: string; avatar: string | null };
}

interface StatementHistoryProps {
  statements: Statement[];
  showUser?: boolean;
}

export function StatementHistory({ statements, showUser = true }: StatementHistoryProps) {
  if (statements.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No statements calculated yet. Statements are generated from signal-tagged tracked trades.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {statements.map((stmt) => (
        <TraderStatementCard
          key={stmt.id}
          userName={
            showUser
              ? stmt.user?.name || "Unknown"
              : stmt.clan?.name || "Unknown"
          }
          periodKey={stmt.periodKey}
          periodType={stmt.periodType}
          tradeCount={stmt.tradeCount}
          metrics={stmt.metrics}
          calculatedAt={stmt.calculatedAt}
        />
      ))}
    </div>
  );
}
