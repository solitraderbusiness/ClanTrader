"use client";

import { useTranslation } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { TimeSlotStats } from "@/types/journal";
import { cn } from "@/lib/utils";

interface Props {
  dayOfWeek: TimeSlotStats[];
  monthly: TimeSlotStats[];
}

export function TimeAnalysis({ dayOfWeek, monthly }: Props) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Day of week */}
      <Card>
        <CardContent className="px-4 py-4">
          <h4 className="mb-3 text-sm font-semibold">
            {t("journal.dayOfWeek")}
          </h4>
          <div className="space-y-1.5">
            {dayOfWeek.map((row) => (
              <DayRow key={row.label} row={row} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly */}
      {monthly.length > 0 && (
        <Card>
          <CardContent className="px-4 py-4">
            <h4 className="mb-3 text-sm font-semibold">
              {t("journal.byMonth")}
            </h4>
            <div className="space-y-1.5">
              {monthly.map((row) => (
                <DayRow key={row.label} row={row} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DayRow({ row }: { row: TimeSlotStats }) {
  if (row.trades === 0) {
    return (
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="w-16 font-medium">{row.label}</span>
        <span className="text-xs">—</span>
      </div>
    );
  }

  const maxBarWidth = 100;
  const barWidth = Math.min(row.trades * 8, maxBarWidth);

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-16 flex-shrink-0 font-medium">{row.label}</span>
      <div className="flex-1">
        <div
          className={cn(
            "h-5 rounded",
            row.totalR >= 0 ? "bg-green-500/20" : "bg-red-500/20"
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums">
        <span className="text-muted-foreground">{row.trades}t</span>
        <span className="w-10 text-end">
          {(row.winRate * 100).toFixed(0)}%
        </span>
        <span
          className={cn(
            "w-14 text-end font-medium",
            row.totalR >= 0 ? "text-green-500" : "text-red-500"
          )}
        >
          {row.totalR > 0 ? "+" : ""}
          {row.totalR.toFixed(1)}R
        </span>
      </div>
    </div>
  );
}
