"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { KanbanTask } from "./KanbanCard";

interface DashboardData {
  currentPhase: string;
  latestCompleted: KanbanTask | null;
  overdueTasks: KanbanTask[];
  todayTasks: KanbanTask[];
  thisWeekTasks: KanbanTask[];
  suggestedNext: KanbanTask[];
  stats: {
    total: number;
    done: number;
    inProgress: number;
    overdue: number;
    launchBlockers: number;
    byPhase: Record<string, { total: number; done: number }>;
  };
}

interface KanbanDashboardProps {
  dashboard: DashboardData;
  onTaskClick: (task: KanbanTask) => void;
}

const PHASES = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];

const PHASE_BAR_COLOR: Record<string, string> = {
  W1: "bg-emerald-500",
  W2: "bg-blue-500",
  W3: "bg-amber-500",
  W4: "bg-violet-500",
  W5: "bg-rose-500",
  W6: "bg-cyan-500",
  W7: "bg-teal-500",
  W8: "bg-orange-500",
};

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function KanbanDashboard({ dashboard, onTaskClick }: KanbanDashboardProps) {
  const { t } = useTranslation();

  const focusTasks = [...dashboard.overdueTasks, ...dashboard.todayTasks];

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      {/* Phase Progress Bar */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("admin.kanbanDashboardPhaseProgress")}
        </h3>
        <div className="flex gap-1">
          {PHASES.map((phase) => {
            const data = dashboard.stats.byPhase[phase] ?? { total: 0, done: 0 };
            const pct = data.total > 0 ? (data.done / data.total) * 100 : 0;
            const isActive = phase === dashboard.currentPhase;

            return (
              <div
                key={phase}
                className={cn(
                  "flex-1 overflow-hidden rounded",
                  isActive && "ring-2 ring-primary ring-offset-1"
                )}
              >
                <div className="mb-0.5 text-center text-[10px] font-semibold text-muted-foreground">
                  {phase}
                </div>
                <div className="h-2 w-full rounded bg-muted">
                  <div
                    className={cn("h-full rounded", PHASE_BAR_COLOR[phase])}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-0.5 text-center text-[9px] text-muted-foreground">
                  {data.done}/{data.total}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-2">
        <StatCard
          label={t("admin.kanbanDashboardTotal")}
          value={dashboard.stats.total}
        />
        <StatCard
          label={t("admin.kanbanDashboardDone")}
          value={dashboard.stats.done}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          label={t("admin.kanbanDashboardInProgress")}
          value={dashboard.stats.inProgress}
          accent="text-amber-600 dark:text-amber-400"
        />
        <StatCard
          label={t("admin.kanbanDashboardOverdue")}
          value={dashboard.stats.overdue}
          accent={dashboard.stats.overdue > 0 ? "text-red-600 dark:text-red-400" : undefined}
        />
        <StatCard
          label={t("admin.kanbanDashboardBlockers")}
          value={dashboard.stats.launchBlockers}
          accent={dashboard.stats.launchBlockers > 0 ? "text-red-600 dark:text-red-400" : undefined}
        />
      </div>

      {/* Today's Focus + Latest Completed + Suggested Next */}
      <div className="grid gap-3 md:grid-cols-3">
        {/* Today's Focus */}
        <div className="rounded-md border bg-muted/20 p-3">
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
            {t("admin.kanbanDashboardTodayFocus")}
          </h4>
          {focusTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("admin.kanbanDashboardNoToday")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {focusTasks.slice(0, 5).map((task) => {
                const isOverdue =
                  task.dueDate &&
                  new Date(task.dueDate) < new Date(new Date().toDateString());
                const daysDiff = task.dueDate
                  ? Math.ceil(
                      (new Date(new Date().toDateString()).getTime() -
                        new Date(task.dueDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0;

                return (
                  <li
                    key={task.id}
                    className="flex cursor-pointer items-center gap-2 rounded p-1 text-xs hover:bg-muted/50"
                    onClick={() => onTaskClick(task)}
                  >
                    <span className="truncate font-medium">{task.title}</span>
                    <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px]">
                      {task.phase}
                    </span>
                    {isOverdue && daysDiff > 0 && (
                      <span className="shrink-0 text-[9px] font-medium text-red-500">
                        {daysDiff}d
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Latest Completed */}
        <div className="rounded-md border bg-muted/20 p-3">
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
            {t("admin.kanbanDashboardLatestCompleted")}
          </h4>
          {dashboard.latestCompleted ? (
            <div
              className="cursor-pointer rounded p-1 hover:bg-muted/50"
              onClick={() => onTaskClick(dashboard.latestCompleted!)}
            >
              <p className="text-xs font-medium">{dashboard.latestCompleted.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="rounded bg-muted px-1 py-0.5 text-[9px]">
                  {dashboard.latestCompleted.phase}
                </span>
                {dashboard.latestCompleted.completedAt && (
                  <span className="text-[9px] text-muted-foreground">
                    {relativeTime(dashboard.latestCompleted.completedAt)}
                  </span>
                )}
              </div>
              {dashboard.latestCompleted.result && (
                <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                  {dashboard.latestCompleted.result}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">—</p>
          )}
        </div>

        {/* Suggested Next */}
        <div className="rounded-md border bg-muted/20 p-3">
          <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
            {t("admin.kanbanDashboardSuggestedNext")}
          </h4>
          {dashboard.suggestedNext.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("admin.kanbanDashboardNoSuggestions")}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {dashboard.suggestedNext.map((task) => (
                <li
                  key={task.id}
                  className="flex cursor-pointer items-center gap-2 rounded p-1 text-xs hover:bg-muted/50"
                  onClick={() => onTaskClick(task)}
                >
                  <span className="truncate font-medium">{task.title}</span>
                  <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px]">
                    {task.priority}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-2.5 text-center">
      <p className={cn("text-xl font-bold", accent)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
