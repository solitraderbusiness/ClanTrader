"use client";

import { useTranslation } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { PeriodComparisonData } from "@/types/journal";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface Props {
  data: PeriodComparisonData;
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (Math.abs(diff) < 0.001) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (diff > 0) {
    return <ArrowUp className="h-3.5 w-3.5 text-green-500" />;
  }
  return <ArrowDown className="h-3.5 w-3.5 text-red-500" />;
}

export function PeriodComparison({ data }: Props) {
  const { t } = useTranslation();
  const { current, previous } = data;

  const metrics = [
    {
      label: t("journal.winRate"),
      cur: `${(current.winRate * 100).toFixed(1)}%`,
      prev: `${(previous.winRate * 100).toFixed(1)}%`,
      curVal: current.winRate,
      prevVal: previous.winRate,
    },
    {
      label: t("journal.profitFactor"),
      cur: (current.profitFactor != null && isFinite(current.profitFactor) && current.profitFactor < 9999)
        ? current.profitFactor.toFixed(2)
        : "\u221E",
      prev: (previous.profitFactor != null && isFinite(previous.profitFactor) && previous.profitFactor < 9999)
        ? previous.profitFactor.toFixed(2)
        : "\u221E",
      curVal: current.profitFactor,
      prevVal: previous.profitFactor,
    },
    {
      label: t("journal.totalR"),
      cur: `${current.totalR >= 0 ? "+" : ""}${current.totalR.toFixed(2)}R`,
      prev: `${previous.totalR >= 0 ? "+" : ""}${previous.totalR.toFixed(2)}R`,
      curVal: current.totalR,
      prevVal: previous.totalR,
    },
    {
      label: t("journal.tradesCount"),
      cur: String(current.totalTrades),
      prev: String(previous.totalTrades),
      curVal: current.totalTrades,
      prevVal: previous.totalTrades,
    },
  ];

  return (
    <Card>
      <CardContent className="px-4 py-4">
        <h3 className="mb-3 text-sm font-semibold">
          {t("journal.periodComparison")}
        </h3>
        <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{current.label}</span>
          <span>vs</span>
          <span>{previous.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className="space-y-1">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    m.curVal > m.prevVal
                      ? "text-green-500"
                      : m.curVal < m.prevVal
                        ? "text-red-500"
                        : ""
                  )}
                >
                  {m.cur}
                </span>
                <Delta current={m.curVal} previous={m.prevVal} />
              </div>
              <p className="text-[10px] text-muted-foreground tabular-nums">
                {t("journal.previous")}: {m.prev}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
