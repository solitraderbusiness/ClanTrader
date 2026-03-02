"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { KanbanCard, type KanbanTask } from "@/components/admin/KanbanCard";
import { KanbanTaskDialog } from "@/components/admin/KanbanTaskDialog";
import { cn } from "@/lib/utils";

const COLUMNS = ["BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "DONE"] as const;
const PHASES = ["ALL", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];

const COLUMN_STYLE: Record<string, string> = {
  BACKLOG: "border-t-muted-foreground/40",
  TODO: "border-t-blue-500",
  IN_PROGRESS: "border-t-amber-500",
  TESTING: "border-t-violet-500",
  DONE: "border-t-emerald-500",
};

type ColumnMap = Record<string, KanbanTask[]>;

function groupByColumn(tasks: KanbanTask[]): ColumnMap {
  const map: ColumnMap = {};
  for (const col of COLUMNS) map[col] = [];
  for (const t of tasks) {
    if (map[t.column]) map[t.column].push(t);
    else map[COLUMNS[0]] = [...(map[COLUMNS[0]] || []), t];
  }
  return map;
}

export default function AdminKanbanPage() {
  const { t } = useTranslation();
  const [allTasks, setAllTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<KanbanTask | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/kanban");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAllTasks(data.tasks || []);
    } catch {
      toast.error(t("admin.kanbanLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered =
    phaseFilter === "ALL"
      ? allTasks
      : allTasks.filter((t) => t.phase === phaseFilter);

  const columns = groupByColumn(filtered);

  function columnLabel(col: string) {
    const key = `admin.kanbanCol${col.charAt(0) + col.slice(1).toLowerCase().replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}`;
    return t(key) || col;
  }

  function handleCardClick(task: KanbanTask) {
    setEditTask(task);
    setDialogOpen(true);
  }

  function handleCreate() {
    setEditTask(null);
    setDialogOpen(true);
  }

  async function reorderColumn(column: string, taskIds: string[]) {
    const res = await fetch("/api/admin/kanban/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column, taskIds }),
    });
    if (!res.ok) throw new Error("Reorder failed");
  }

  async function onDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    // Optimistic update
    const prev = [...allTasks];
    const taskIdx = allTasks.findIndex((t) => t.id === draggableId);
    if (taskIdx === -1) return;

    const movedTask = { ...allTasks[taskIdx], column: destination.droppableId };

    // Remove from source
    const srcCol = columns[source.droppableId].filter(
      (t) => t.id !== draggableId
    );
    // Insert into destination
    const dstCol =
      source.droppableId === destination.droppableId
        ? srcCol
        : [...columns[destination.droppableId]];
    if (source.droppableId !== destination.droppableId) {
      // Already removed from src
    }
    dstCol.splice(destination.index, 0, movedTask);

    // Build new full task list
    const updatedTasks = allTasks.map((t) => {
      if (t.id === draggableId) return movedTask;
      return t;
    });

    // Reorder positions
    const srcIds = srcCol.map((t) => t.id);
    const dstIds = dstCol.map((t) => t.id);

    setAllTasks(updatedTasks);

    try {
      const promises: Promise<void>[] = [];
      if (source.droppableId !== destination.droppableId) {
        promises.push(reorderColumn(source.droppableId, srcIds));
        promises.push(reorderColumn(destination.droppableId, dstIds));
      } else {
        promises.push(reorderColumn(destination.droppableId, dstIds));
      }
      await Promise.all(promises);
    } catch {
      toast.error(t("admin.kanbanReorderFailed"));
      setAllTasks(prev);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.kanbanTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.kanbanDesc")}
          </p>
        </div>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="me-2 h-3.5 w-3.5" />
          {t("admin.kanbanNewTask")}
        </Button>
      </div>

      {/* Phase filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {PHASES.map((p) => (
          <Button
            key={p}
            variant={phaseFilter === p ? "default" : "outline"}
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={() => setPhaseFilter(p)}
          >
            {p === "ALL" ? t("admin.kanbanAllPhases") : p}
          </Button>
        ))}
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <ScrollArea className="w-full">
          <div className="flex min-w-[1100px] gap-3 pb-4">
            {COLUMNS.map((col) => (
              <div
                key={col}
                className={cn(
                  "flex min-w-[200px] flex-1 flex-col rounded-lg border border-t-4 bg-muted/30",
                  COLUMN_STYLE[col]
                )}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {columnLabel(col)}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {columns[col]?.length ?? 0}
                  </Badge>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={col}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2 transition-colors",
                        snapshot.isDraggingOver && "bg-primary/5"
                      )}
                    >
                      {(columns[col] || []).map((task, index) => (
                        <KanbanCard
                          key={task.id}
                          task={task}
                          index={index}
                          onClick={handleCardClick}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </DragDropContext>

      {/* Create/Edit dialog */}
      <KanbanTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editTask}
        onSaved={fetchTasks}
      />
    </div>
  );
}
