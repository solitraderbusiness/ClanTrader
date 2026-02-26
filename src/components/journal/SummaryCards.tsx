"use client";

import { useTranslation } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { JournalSummary } from "@/types/journal";
import { cn } from "@/lib/utils";

interface Props {
  summary: JournalSummary;
}

function formatR(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPF(value: number | null): string {
  if (value == null) return "\u221E";
  if (!isFinite(value) || value >= 9999) return "\u221E";
  return value.toFixed(2);
}

export function SummaryCards({ summary }: Props) {
  const { t } = useTranslation();

  const cards = [
    {
      label: t("journal.winRate"),
      value: formatPct(summary.winRate),
      color: summary.winRate >= 0.5 ? "text-green-500" : "text-red-500",
    },
    {
      label: t("journal.profitFactor"),
      value: formatPF(summary.profitFactor),
      color: summary.profitFactor >= 1 ? "text-green-500" : "text-red-500",
    },
    {
      label: t("journal.expectancy"),
      value: formatR(summary.expectancy),
      color: summary.expectancy >= 0 ? "text-green-500" : "text-red-500",
    },
    {
      label: t("journal.totalR"),
      value: formatR(summary.totalR),
      color: summary.totalR >= 0 ? "text-green-500" : "text-red-500",
    },
    {
      label: t("journal.bestR"),
      value: formatR(summary.bestR),
      color: "text-green-500",
    },
    {
      label: t("journal.worstR"),
      value: formatR(summary.worstR),
      color: "text-red-500",
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
      <p className="text-xs text-muted-foreground text-center">
        {t("journal.tradeBreakdown", {
          total: summary.totalTrades,
          wins: summary.wins,
          losses: summary.losses,
          be: summary.breakEven,
        })}
        {summary.unknownR > 0 &&
          ` · ${t("journal.unknownR", { count: summary.unknownR })}`}
      </p>
    </div>
  );
}
