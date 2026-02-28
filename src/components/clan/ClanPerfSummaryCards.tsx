"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ClanPerfSummary } from "@/types/clan-performance";

interface Props {
  summary: ClanPerfSummary;
}

export function ClanPerfSummaryCards({ summary }: Props) {
  const { t } = useTranslation();

  const cards = [
    {
      label: t("clanPerf.totalSignals"),
      value: String(summary.totalSignals),
      color: "",
    },
    {
      label: t("clanPerf.winRate"),
      value: `${summary.winRate}%`,
      color: summary.winRate >= 50 ? "text-green-500" : "text-red-500",
    },
    {
      label: t("clanPerf.profitFactor"),
      value: summary.profitFactor >= 9999 ? "∞" : String(summary.profitFactor),
      color: summary.profitFactor >= 1 ? "text-green-500" : "text-red-500",
    },
    {
      label: t("clanPerf.avgR"),
      value: `${summary.avgR >= 0 ? "+" : ""}${summary.avgR}R`,
      color: summary.avgR >= 0 ? "text-green-500" : "text-red-500",
    },
    {
      label: t("clanPerf.totalR"),
      value: `${summary.totalR >= 0 ? "+" : ""}${summary.totalR}R`,
      color: summary.totalR >= 0 ? "text-green-500" : "text-red-500",
    },
    {
      label: t("clanPerf.bestWorstR"),
      value: `+${summary.bestR} / ${summary.worstR}R`,
      color: "",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="px-4 py-3">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className={cn("text-xl font-bold tabular-nums", card.color)}>
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {summary.totalSignals} {t("clanPerf.signals")}: {summary.wins}W / {summary.losses}L / {summary.breakEven}BE
      </p>
    </div>
  );
}
