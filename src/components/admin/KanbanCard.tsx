"use client";

import { Draggable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { AlertTriangle } from "lucide-react";
import type { KanbanPriority, TaskCategory } from "@prisma/client";

export interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  phase: string;
  priority: KanbanPriority;
  column: string;
  position: number;
  notes: string | null;
  category: TaskCategory;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  result: string | null;
  // PM roadmap fields
  key: string | null;
  epicKey: string | null;
  epicTitle: string | null;
  workstream: string | null;
  milestone: string | null;
  pmStatus: string | null;
  owner: string | null;
  isLaunchBlocker: boolean;
  acceptanceCriteria: string | null;
  risks: string | null;
  dependencies: string[] | null;
  evidence: Record<string, unknown> | null;
  estimateBest: number | null;
  estimateLikely: number | null;
  estimateWorst: number | null;
  lastVerifiedAt: string | null;
  discoveredFromId: string | null;
  discoveredFrom: { id: string; title: string } | null;
}

interface KanbanCardProps {
  task: KanbanTask;
  index: number;
  onClick: (task: KanbanTask) => void;
}

const PRIORITY_BORDER: Record<string, string> = {
  CRITICAL: "border-s-red-500",
  HIGH: "border-s-orange-500",
  NORMAL: "border-s-transparent",
  LOW: "border-s-muted-foreground/30",
};

const PHASE_COLOR: Record<string, string> = {
  W1: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  W2: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  W3: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  W4: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  W5: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  W6: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  W7: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  W8: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

const CATEGORY_DOT: Record<string, string> = {
  FEATURE: "bg-blue-500",
  BUG_FIX: "bg-red-500",
  IMPROVEMENT: "bg-green-500",
  MAINTENANCE: "bg-gray-400",
  INFRASTRUCTURE: "bg-gray-400",
  IDEA: "bg-yellow-500",
};

function getDueDateInfo(dueDate: string | null, column: string) {
  if (!dueDate || column === "DONE" || column === "BUGS_FIXED") return null;

  const due = new Date(dueDate);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  if (due < todayStart) {
    const diffDays = Math.ceil((todayStart.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return { type: "overdue" as const, days: diffDays };
  }
  if (due < tomorrowStart) {
    return { type: "today" as const, days: 0 };
  }
  return { type: "future" as const, days: 0, date: due };
}

export function KanbanCard({ task, index, onClick }: KanbanCardProps) {
  const { t } = useTranslation();

  const priorityLabel =
    task.priority === "CRITICAL"
      ? t("admin.kanbanCritical")
      : task.priority === "HIGH"
        ? t("admin.kanbanHigh")
        : null;

  const dueInfo = getDueDateInfo(task.dueDate, task.column);
  const isOverdue = dueInfo?.type === "overdue";

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={cn(
            "cursor-pointer rounded-md border border-s-4 bg-card p-2.5 text-sm shadow-sm transition-shadow hover:shadow-md",
            isOverdue
              ? "border-s-red-500 bg-red-50/50 dark:bg-red-950/20"
              : PRIORITY_BORDER[task.priority] || "border-s-transparent",
            snapshot.isDragging && "shadow-lg ring-2 ring-primary/30"
          )}
        >
          <p className="line-clamp-2 font-medium leading-snug">{task.title}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                PHASE_COLOR[task.phase] || "bg-muted text-muted-foreground"
              )}
            >
              {task.phase}
            </span>
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                CATEGORY_DOT[task.category] || "bg-gray-400"
              )}
              title={task.category}
            />
            {priorityLabel && (
              <span className="text-[10px] text-muted-foreground">
                {priorityLabel}
              </span>
            )}
            {task.isLaunchBlocker && (
              <AlertTriangle className="h-3 w-3 text-red-500" />
            )}
            {task.owner && (
              <span className="truncate rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                {task.owner}
              </span>
            )}
          </div>
          {dueInfo && (
            <p
              className={cn(
                "mt-1 text-[10px]",
                isOverdue
                  ? "font-medium text-red-600 dark:text-red-400"
                  : dueInfo.type === "today"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
              )}
            >
              {dueInfo.type === "overdue"
                ? t("admin.kanbanOverdue", { days: dueInfo.days })
                : dueInfo.type === "today"
                  ? t("admin.kanbanDueToday")
                  : t("admin.kanbanDueOn", {
                      date: dueInfo.date!.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      }),
                    })}
            </p>
          )}
        </div>
      )}
    </Draggable>
  );
}
