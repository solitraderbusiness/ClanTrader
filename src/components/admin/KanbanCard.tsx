"use client";

import { Draggable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { KanbanPriority } from "@prisma/client";

export interface KanbanTask {
  id: string;
  title: string;
  description: string | null;
  phase: string;
  priority: KanbanPriority;
  column: string;
  position: number;
  notes: string | null;
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
  P1: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  P2: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  P3: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  P4: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  P5: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  P6: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  P7: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  P8: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

export function KanbanCard({ task, index, onClick }: KanbanCardProps) {
  const { t } = useTranslation();

  const priorityLabel =
    task.priority === "CRITICAL"
      ? t("admin.kanbanCritical")
      : task.priority === "HIGH"
        ? t("admin.kanbanHigh")
        : null;

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
            PRIORITY_BORDER[task.priority] || "border-s-transparent",
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
            {priorityLabel && (
              <span className="text-[10px] text-muted-foreground">
                {priorityLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
