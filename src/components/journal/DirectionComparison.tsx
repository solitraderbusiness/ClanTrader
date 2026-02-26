"use client";

import { useTranslation } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { DirectionStats } from "@/types/journal";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  data: DirectionStats[];
}

export function DirectionComparison({ data }: Props) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("common.noResults")}
      </p>
    );
  }

  const longData = data.find((d) => d.direction === "LONG");
  const shortData = data.find((d) => d.direction === "SHORT");

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {longData && <DirectionCard data={longData} t={t} icon={TrendingUp} />}
      {shortData && (
        <DirectionCard data={shortData} t={t} icon={TrendingDown} />
      )}
    </div>
  );
}

function DirectionCard({
  data,
  t,
  icon: Icon,
}: {
  data: DirectionStats;
  t: (key: string, params?: Record<string, string | number>) => string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const isLong = data.direction === "LONG";

  return (
    <Card>
      <CardContent className="px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon
            className={cn(
              "h-5 w-5",
              isLong ? "text-green-500" : "text-red-500"
            )}
          />
          <span className="font-semibold">
            {isLong ? t("trade.long") : t("trade.short")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <Stat label={t("journal.tradesCount")} value={String(data.trades)} />
          <Stat
            label={t("journal.winRate")}
            value={`${(data.winRate * 100).toFixed(0)}%`}
          />
          <Stat
            label={t("journal.avgR")}
            value={`${data.avgR >= 0 ? "+" : ""}${data.avgR.toFixed(2)}R`}
            color={data.avgR >= 0 ? "text-green-500" : "text-red-500"}
          />
          <Stat
            label={t("journal.totalR")}
            value={`${data.totalR >= 0 ? "+" : ""}${data.totalR.toFixed(2)}R`}
            color={data.totalR >= 0 ? "text-green-500" : "text-red-500"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular-nums", color)}>{value}</p>
    </div>
  );
}
