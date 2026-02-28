"use client";

import { useTranslation } from "@/lib/i18n";

interface MtAccountStatsProps {
  accountId: string;
  stats: {
    totalTrades: number;
    winRate: number;
    totalProfit: number;
    avgDuration: string;
    topInstruments: string[];
    matchedSignals: number;
    currency: string;
  };
}

export function MtAccountStats({ stats }: MtAccountStatsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard label={t("settings.totalTrades")} value={String(stats.totalTrades)} />
      <StatCard
        label={t("settings.winRate")}
        value={`${stats.winRate.toFixed(1)}%`}
      />
      <StatCard
        label={t("settings.totalProfit")}
        value={`${stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toLocaleString()} ${stats.currency}`}
      />
      <StatCard label={t("settings.avgDuration")} value={stats.avgDuration} />
      <StatCard
        label={t("settings.topPairs")}
        value={stats.topInstruments.slice(0, 3).join(", ") || "\u2014"}
      />
      <StatCard
        label={t("settings.matchedSignals")}
        value={String(stats.matchedSignals)}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
