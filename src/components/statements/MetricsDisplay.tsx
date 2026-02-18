import { Badge } from "@/components/ui/badge";
import type { StatementMetrics } from "@/types/statement";

interface MetricsDisplayProps {
  metrics: StatementMetrics;
  compact?: boolean;
  verificationMethod?: string;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function MetricsDisplay({
  metrics,
  compact = false,
  verificationMethod,
}: MetricsDisplayProps) {
  const stats = [
    {
      label: "Net Profit",
      value: `$${formatNumber(metrics.totalNetProfit)}`,
      color: metrics.totalNetProfit >= 0 ? "text-green-600" : "text-red-600",
    },
    {
      label: "Win Rate",
      value: `${metrics.winRate}%`,
      color: metrics.winRate >= 50 ? "text-green-600" : "text-yellow-600",
    },
    {
      label: "Profit Factor",
      value: metrics.profitFactor.toFixed(2),
      color: metrics.profitFactor >= 1 ? "text-green-600" : "text-red-600",
    },
    {
      label: "Max Drawdown",
      value: `${metrics.maxDrawdownPercent}%`,
      color: metrics.maxDrawdownPercent <= 20 ? "text-green-600" : "text-red-600",
    },
    {
      label: "Total Trades",
      value: metrics.totalTrades.toString(),
      color: "text-foreground",
    },
    {
      label: "Gross Profit",
      value: `$${formatNumber(metrics.grossProfit)}`,
      color: "text-green-600",
      hideCompact: true,
    },
    {
      label: "Gross Loss",
      value: `$${formatNumber(metrics.grossLoss)}`,
      color: "text-red-600",
      hideCompact: true,
    },
    ...(metrics.sharpeRatio != null
      ? [
          {
            label: "Sharpe Ratio",
            value: metrics.sharpeRatio.toFixed(2),
            color: metrics.sharpeRatio >= 1 ? "text-green-600" : "text-yellow-600",
          },
        ]
      : []),
  ];

  const visibleStats = compact
    ? stats.filter((s) => !("hideCompact" in s && s.hideCompact))
    : stats;

  return (
    <div className="space-y-3">
      {verificationMethod && (
        <div className="flex items-center gap-2">
          <Badge variant={verificationMethod === "BROKER_VERIFIED" ? "default" : "secondary"}>
            {verificationMethod === "BROKER_VERIFIED" ? "Broker Verified" : "Self Reported"}
          </Badge>
        </div>
      )}
      <div className={`grid gap-3 ${compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
        {visibleStats.map((stat) => (
          <div key={stat.label} className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-sm font-semibold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>
      {!compact && metrics.tradingPeriodStart && metrics.tradingPeriodEnd && (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Trading Period</p>
          <p className="text-sm font-medium">
            {metrics.tradingPeriodStart} — {metrics.tradingPeriodEnd}
          </p>
        </div>
      )}
      {!compact && metrics.pairsTraded.length > 0 && (
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">Pairs Traded</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {metrics.pairsTraded.map((pair) => (
              <Badge key={pair} variant="outline" className="text-xs">
                {pair}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
