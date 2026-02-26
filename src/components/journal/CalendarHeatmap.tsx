"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarDayData } from "@/types/journal";
import { cn } from "@/lib/utils";

interface Props {
  data: CalendarDayData[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  // Convert Sunday=0 to Monday=0 format
  return day === 0 ? 6 : day - 1;
}

function getRColor(totalR: number): string {
  if (totalR > 2) return "bg-green-500";
  if (totalR > 0) return "bg-green-400/70";
  if (totalR === 0) return "bg-muted";
  if (totalR > -2) return "bg-red-400/70";
  return "bg-red-500";
}

export function CalendarHeatmap({ data }: Props) {
  const { t } = useTranslation();

  // Determine initial month from the latest data point
  const latestDate = data.length > 0 ? data[data.length - 1].date : new Date().toISOString().slice(0, 10);
  const [year, setYear] = useState(() => parseInt(latestDate.slice(0, 4)));
  const [month, setMonth] = useState(() => parseInt(latestDate.slice(5, 7)) - 1);

  const dataMap = useMemo(() => {
    const map = new Map<string, CalendarDayData>();
    for (const d of data) map.set(d.date, d);
    return map;
  }, [data]);

  const daysInMonth = getDaysInMonth(year, month);
  const offset = getFirstDayOffset(year, month);
  const monthLabel = new Date(year, month).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  return (
    <Card>
      <CardContent className="px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t("journal.calendar")}</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={prevMonth} className="h-7 w-7 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium">
              {monthLabel}
            </span>
            <Button variant="ghost" size="sm" onClick={nextMonth} className="h-7 w-7 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] text-muted-foreground font-medium"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Offset blanks */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`blank-${i}`} className="aspect-square" />
          ))}
          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayData = dataMap.get(dateStr);
            const hasData = !!dayData;

            return (
              <div
                key={day}
                title={
                  hasData
                    ? `${dateStr}: ${dayData.totalR > 0 ? "+" : ""}${dayData.totalR}R (${dayData.tradeCount} trades)`
                    : dateStr
                }
                className={cn(
                  "flex aspect-square items-center justify-center rounded text-[10px] tabular-nums",
                  hasData ? getRColor(dayData.totalR) : "bg-muted/30",
                  hasData && "text-white font-medium"
                )}
              >
                {day}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-red-500" />
            {t("journal.loss")}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-muted" />
            {t("journal.breakEven")}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-green-500" />
            {t("journal.win")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
