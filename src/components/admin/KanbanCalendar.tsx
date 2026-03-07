"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KanbanTask } from "./KanbanCard";

interface Props {
  tasks: KanbanTask[];
  onTaskClick: (task: KanbanTask) => void;
}

const DAYS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MAX_VISIBLE = 4;

// Colored bars by category — visually distinct like a PM calendar
const CATEGORY_BAR: Record<string, string> = {
  FEATURE: "bg-blue-500 dark:bg-blue-600",
  BUG_FIX: "bg-red-500 dark:bg-red-600",
  IMPROVEMENT: "bg-emerald-500 dark:bg-emerald-600",
  MAINTENANCE: "bg-amber-500 dark:bg-amber-600",
  INFRASTRUCTURE: "bg-violet-500 dark:bg-violet-600",
  IDEA: "bg-yellow-500 dark:bg-yellow-600",
};

// Done tasks get a muted version
const CATEGORY_BAR_DONE: Record<string, string> = {
  FEATURE: "bg-blue-300/60 dark:bg-blue-800/50",
  BUG_FIX: "bg-red-300/60 dark:bg-red-800/50",
  IMPROVEMENT: "bg-emerald-300/60 dark:bg-emerald-800/50",
  MAINTENANCE: "bg-amber-300/60 dark:bg-amber-800/50",
  INFRASTRUCTURE: "bg-violet-300/60 dark:bg-violet-800/50",
  IDEA: "bg-yellow-300/60 dark:bg-yellow-800/50",
};

const COLUMN_SHORT: Record<string, string> = {
  BACKLOG: "BL",
  TODO: "TD",
  IN_PROGRESS: "IP",
  TESTING: "QA",
  DONE: "",
};

export function KanbanCalendar({ tasks, onTaskClick }: Props) {
  const { t } = useTranslation();
  const now = new Date();
  const todayKey = toDateKey(now);

  const [year, setYear] = useState(() => now.getFullYear());
  const [month, setMonth] = useState(() => now.getMonth());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Group ALL tasks (including DONE) by due date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, KanbanTask[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const d = new Date(task.dueDate);
      const key = toDateKey(d);
      const arr = map.get(key);
      if (arr) arr.push(task);
      else map.set(key, [task]);
    }
    // Sort each day: active tasks first (by priority), then done
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const aDone = a.column === "DONE" || a.column === "BUGS_FIXED";
        const bDone = b.column === "DONE" || b.column === "BUGS_FIXED";
        if (aDone && !bDone) return 1;
        if (!aDone && bDone) return -1;
        const prio: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
        return (prio[a.priority] ?? 2) - (prio[b.priority] ?? 2);
      });
    }
    return map;
  }, [tasks]);

  const daysInMonth = getDaysInMonth(year, month);
  const offset = getFirstDayOffset(year, month);
  const monthLabel = new Date(year, month).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = useCallback(() => {
    setExpandedDays(new Set());
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const nextMonth = useCallback(() => {
    setExpandedDays(new Set());
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const goToday = useCallback(() => {
    const n = new Date();
    setYear(n.getFullYear());
    setMonth(n.getMonth());
  }, []);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={prevMonth} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[180px] text-center text-base font-bold">
            {monthLabel}
          </h2>
          <Button variant="ghost" size="sm" onClick={nextMonth} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden items-center gap-2 text-[10px] sm:flex">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-5 rounded-sm bg-blue-500" />
              {t("admin.kanbanCategoryFeature")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-5 rounded-sm bg-red-500" />
              {t("admin.kanbanCategoryBugFix")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-5 rounded-sm bg-emerald-500" />
              {t("admin.kanbanCategoryImprovement")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-5 rounded-sm bg-amber-500" />
              {t("admin.kanbanCategoryMaintenance")}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-5 rounded-sm bg-violet-500" />
              {t("admin.kanbanCategoryInfrastructure")}
            </span>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>
            {t("admin.kanbanCalendarToday")}
          </Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {DAYS_EN.map((d) => (
          <div
            key={d}
            className="border-e px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground last:border-e-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Offset blanks */}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`blank-${i}`} className="min-h-[130px] border-b border-e bg-muted/5" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayTasks = tasksByDate.get(dateStr) || [];
          const isToday = dateStr === todayKey;
          const isPast = dateStr < todayKey;
          const hasOverdue = isPast && dayTasks.some((t) => t.column !== "DONE" && t.column !== "BUGS_FIXED");
          const isExpanded = expandedDays.has(dateStr);
          const visible = isExpanded ? dayTasks : dayTasks.slice(0, MAX_VISIBLE);
          const overflow = isExpanded ? 0 : dayTasks.length - MAX_VISIBLE;

          return (
            <div
              key={day}
              className={cn(
                "min-h-[130px] border-b border-e p-1.5 transition-colors",
                hasOverdue && "bg-red-50/50 dark:bg-red-950/10",
                isToday && "bg-blue-50/50 dark:bg-blue-950/15"
              )}
            >
              {/* Day number */}
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                    isToday
                      ? "bg-blue-500 font-bold text-white"
                      : isPast
                        ? "text-muted-foreground"
                        : "font-medium"
                  )}
                >
                  {day}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {dayTasks.filter((t) => t.column === "DONE" || t.column === "BUGS_FIXED").length}/{dayTasks.length}
                  </span>
                )}
              </div>

              {/* Task bars */}
              <div className="space-y-1">
                {visible.map((task) => {
                  const isDone = task.column === "DONE" || task.column === "BUGS_FIXED";
                  const barColor = isDone
                    ? CATEGORY_BAR_DONE[task.category] || "bg-gray-300/60 dark:bg-gray-700/50"
                    : CATEGORY_BAR[task.category] || "bg-gray-500";

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onTaskClick(task)}
                      className={cn(
                        "flex w-full items-center gap-1 rounded-[4px] px-1.5 py-[3px] text-start text-[11px] font-medium leading-tight transition-all hover:opacity-80 hover:shadow-sm",
                        barColor,
                        isDone ? "text-muted-foreground" : "text-white"
                      )}
                    >
                      {isDone && (
                        <Check className="h-3 w-3 shrink-0" />
                      )}
                      <span className={cn("min-w-0 flex-1 truncate", isDone && "line-through")}>
                        {task.title}
                      </span>
                      {!isDone && COLUMN_SHORT[task.column] && (
                        <span className="shrink-0 rounded bg-white/20 px-1 text-[9px]">
                          {COLUMN_SHORT[task.column]}
                        </span>
                      )}
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpandedDays((prev) => {
                      const next = new Set(prev);
                      next.add(dateStr);
                      return next;
                    })}
                    className="block px-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {t("admin.kanbanCalendarMore", { count: overflow })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
