"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TraderStatementMetrics } from "@/types/trader-statement";

interface TraderStatementCardProps {
  userName: string;
  userAvatar?: string | null;
  periodKey: string;
  periodType: string;
  tradeCount: number;
  metrics: TraderStatementMetrics;
  calculatedAt: string;
}

export function TraderStatementCard({
  userName,
  periodKey,
  periodType,
  tradeCount,
  metrics,
  calculatedAt,
}: TraderStatementCardProps) {
  const winRatePct = (metrics.winRate * 100).toFixed(1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{userName}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {periodType}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {periodKey}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3 text-center text-xs">
          <div>
            <p className="text-muted-foreground">Signals</p>
            <p className="text-lg font-bold">{tradeCount}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Win Rate</p>
            <p className="text-lg font-bold text-green-600">{winRatePct}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Avg R</p>
            <p className="text-lg font-bold">
              {metrics.avgRMultiple.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Total R</p>
            <p className="text-lg font-bold">
              {metrics.totalRMultiple.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <div className="flex gap-3">
            <span className="text-green-600">W:{metrics.wins}</span>
            <span className="text-red-600">L:{metrics.losses}</span>
            <span className="text-yellow-600">BE:{metrics.breakEven}</span>
          </div>
          <span>
            Calculated {new Date(calculatedAt).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
