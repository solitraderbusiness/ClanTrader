"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, LayoutGrid, CalendarDays, Calendar, Layers, AlertTriangle, Database, Lightbulb, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { KanbanCard, type KanbanTask } from "@/components/admin/KanbanCard";
import { KanbanTaskDialog } from "@/components/admin/KanbanTaskDialog";
import { KanbanDashboard } from "@/components/admin/KanbanDashboard";
import { KanbanCalendar } from "@/components/admin/KanbanCalendar";
import { cn } from "@/lib/utils";

const COLUMNS = ["IDEAS", "BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "DONE", "BUGS_FIXED"] as const;
const PHASES = ["ALL", "W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
const CATEGORY_FILTERS = ["ALL", "FEATURE", "BUG_FIX", "IMPROVEMENT", "MAINTENANCE", "INFRASTRUCTURE", "IDEA"] as const;
const CATEGORY_FILTER_LABELS: Record<string, string> = {
  ALL: "kanbanAllCategories",
  FEATURE: "kanbanCategoryFeature",
  BUG_FIX: "kanbanCategoryBugFix",
  IMPROVEMENT: "kanbanCategoryImprovement",
  MAINTENANCE: "kanbanCategoryMaintenance",
  INFRASTRUCTURE: "kanbanCategoryInfrastructure",
  IDEA: "kanbanCategoryIdea",
};

const COLUMN_STYLE: Record<string, string> = {
  IDEAS: "border-t-purple-400",
  BACKLOG: "border-t-muted-foreground/40",
  TODO: "border-t-blue-500",
  IN_PROGRESS: "border-t-amber-500",
  TESTING: "border-t-violet-500",
  DONE: "border-t-emerald-500",
  BUGS_FIXED: "border-t-rose-500",
};

type ColumnMap = Record<string, KanbanTask[]>;

interface DashboardData {
  currentPhase: string;
  latestCompleted: KanbanTask | null;
  overdueTasks: KanbanTask[];
  todayTasks: KanbanTask[];
  thisWeekTasks: KanbanTask[];
  suggestedNext: KanbanTask[];
  launchBlockers: KanbanTask[];
  stats: {
    total: number;
    done: number;
    inProgress: number;
    overdue: number;
    launchBlockers: number;
    byPhase: Record<string, { total: number; done: number }>;
  };
}

function groupByColumn(tasks: KanbanTask[]): ColumnMap {
  const map: ColumnMap = {};
  for (const col of COLUMNS) map[col] = [];
  for (const t of tasks) {
    if (map[t.column]) map[t.column].push(t);
    else map[COLUMNS[0]] = [...(map[COLUMNS[0]] || []), t];
  }
  return map;
}

type ViewMode = "board" | "timeline" | "calendar" | "workstreams" | "blockers";

const WORKSTREAM_LABELS: Record<string, string> = {
  PRODUCT_CORE: "Product Core Loop",
  TRUST_INTEGRITY: "Trust & Integrity",
  PLATFORM_OPS: "Platform & Operations",
  MONETIZATION_GROWTH: "Monetization & Growth",
  MARKET_INTELLIGENCE: "Market Intelligence",
};

const DAILY_CAPACITY = 6;
const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DaySection {
  key: string;
  label: string;
  isToday: boolean;
  isOverdue: boolean;
  isUnscheduled: boolean;
  tasks: KanbanTask[];
  doneCount: number;
}

function groupByDay(tasks: KanbanTask[]): DaySection[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = toDateKey(todayStart);

  const notDone = tasks.filter((t) => t.column !== "DONE" && t.column !== "BUGS_FIXED");
  const doneTasks = tasks.filter((t) => t.column === "DONE" || t.column === "BUGS_FIXED");

  // Group by date
  const byDate = new Map<string, KanbanTask[]>();
  const unscheduled: KanbanTask[] = [];

  for (const task of notDone) {
    if (!task.dueDate) {
      unscheduled.push(task);
      continue;
    }
    const key = toDateKey(new Date(task.dueDate));
    const arr = byDate.get(key);
    if (arr) arr.push(task);
    else byDate.set(key, [task]);
  }

  // Count done tasks by date for showing completion
  const doneByDate = new Map<string, number>();
  for (const task of doneTasks) {
    if (!task.completedAt) continue;
    const key = toDateKey(new Date(task.completedAt));
    doneByDate.set(key, (doneByDate.get(key) || 0) + 1);
  }

  // Sort each bucket by priority
  for (const [, arr] of byDate) {
    arr.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));
  }
  unscheduled.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

  // Collect all dates and sort
  const allDates = [...byDate.keys()].sort();

  // Split overdue (before today) and future (today+)
  const overdueDates = allDates.filter((d) => d < todayKey);
  const futureDates = allDates.filter((d) => d >= todayKey);

  // Ensure today + next 13 days are always shown (14-day window)
  for (let i = 0; i < 14; i++) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() + i);
    const key = toDateKey(d);
    if (!futureDates.includes(key)) futureDates.push(key);
  }
  futureDates.sort();

  const sections: DaySection[] = [];

  // Overdue section — merge all overdue into one bucket
  if (overdueDates.length > 0) {
    const overdueTasks: KanbanTask[] = [];
    for (const d of overdueDates) {
      overdueTasks.push(...(byDate.get(d) || []));
    }
    overdueTasks.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));
    sections.push({
      key: "overdue",
      label: "Overdue",
      isToday: false,
      isOverdue: true,
      isUnscheduled: false,
      tasks: overdueTasks,
      doneCount: 0,
    });
  }

  // Day-by-day sections
  for (const dateKey of futureDates) {
    const d = new Date(dateKey + "T00:00:00");
    const dayName = DAY_NAMES[d.getDay()];
    const isToday = dateKey === todayKey;
    const monthName = d.toLocaleString("en-US", { month: "long" });
    const dayNum = d.getDate();
    const suffix = dayNum === 1 || dayNum === 21 || dayNum === 31 ? "st"
      : dayNum === 2 || dayNum === 22 ? "nd"
      : dayNum === 3 || dayNum === 23 ? "rd" : "th";
    const fullDate = `${dayNum}${suffix} ${monthName} ${d.getFullYear()}`;
    const label = isToday ? `Today — ${dayName}, ${fullDate}` : `${dayName}, ${fullDate}`;

    sections.push({
      key: dateKey,
      label,
      isToday,
      isOverdue: false,
      isUnscheduled: false,
      tasks: byDate.get(dateKey) || [],
      doneCount: doneByDate.get(dateKey) || 0,
    });
  }

  // Unscheduled at the end
  if (unscheduled.length > 0) {
    sections.push({
      key: "unscheduled",
      label: "Unscheduled",
      isToday: false,
      isOverdue: false,
      isUnscheduled: true,
      tasks: unscheduled,
      doneCount: 0,
    });
  }

  return sections;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminKanbanPage() {
  const { t } = useTranslation();
  const [allTasks, setAllTasks] = useState<KanbanTask[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTask, setEditTask] = useState<KanbanTask | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [seeding, setSeeding] = useState(false);
  const [rebalancing, setRebalancing] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/kanban");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAllTasks(data.tasks || []);
      setDashboard(data.dashboard || null);
    } catch {
      toast.error(t("admin.kanbanLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filtered = allTasks.filter((t) => {
    if (phaseFilter !== "ALL" && t.phase !== phaseFilter) return false;
    if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false;
    return true;
  });

  const columns = groupByColumn(filtered);
  const daySections = useMemo(() => groupByDay(filtered), [filtered]);

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
      // Re-fetch to get updated date fields from server
      if (source.droppableId !== destination.droppableId) {
        fetchTasks();
      }
    } catch {
      toast.error(t("admin.kanbanReorderFailed"));
      setAllTasks(prev);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/kanban/seed", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(t("admin.pmSeeded", { created: data.created, updated: data.updated }));
      fetchTasks();
    } catch {
      toast.error(t("admin.pmSeedFailed"));
    } finally {
      setSeeding(false);
    }
  }

  async function handleRebalance() {
    setRebalancing(true);
    try {
      const res = await fetch("/api/admin/kanban/rebalance", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.moved === 0) {
        toast.info(t("admin.kanbanRebalanceNoChanges"));
      } else {
        toast.success(t("admin.kanbanRebalanceSuccess", { moved: data.moved, unscheduled: data.unscheduledAssigned }));
      }
      fetchTasks();
    } catch {
      toast.error(t("admin.kanbanRebalanceFailed"));
    } finally {
      setRebalancing(false);
    }
  }

  // Group tasks by workstream
  const workstreamGroups = useMemo(() => {
    const groups: Record<string, KanbanTask[]> = {};
    for (const task of filtered) {
      const ws = task.workstream || "UNASSIGNED";
      if (!groups[ws]) groups[ws] = [];
      groups[ws].push(task);
    }
    return groups;
  }, [filtered]);

  // Blocker tasks
  const blockerTasks = useMemo(() => {
    const blockers = filtered.filter((t) => t.isLaunchBlocker);
    const notReady = blockers.filter((t) => t.column !== "DONE");
    const ready = blockers.filter((t) => t.column === "DONE");
    return { notReady, ready };
  }, [filtered]);

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
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleSeed} disabled={seeding}>
            <Database className="me-1.5 h-3.5 w-3.5" />
            {seeding ? t("admin.pmSeeding") : t("admin.pmSeedBtn")}
          </Button>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="me-2 h-3.5 w-3.5" />
            {t("admin.kanbanNewTask")}
          </Button>
        </div>
      </div>

      {/* Dashboard */}
      {dashboard && (
        <KanbanDashboard
          dashboard={dashboard}
          onTaskClick={handleCardClick}
        />
      )}

      {/* View toggle + Phase filter + Category filter */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
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
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_FILTERS.map((c) => (
              <Button
                key={c}
                variant={categoryFilter === c ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 px-2.5 text-xs",
                  c === "IDEA" && categoryFilter !== c && "border-yellow-500/50 text-yellow-600 dark:text-yellow-400"
                )}
                onClick={() => setCategoryFilter(c)}
              >
                {c === "IDEA" && <Lightbulb className="me-1 h-3 w-3" />}
                {t(`admin.${CATEGORY_FILTER_LABELS[c]}`)}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant={viewMode === "board" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("board")}
          >
            <LayoutGrid className="me-1 h-3.5 w-3.5" />
            {t("admin.kanbanBoardView")}
          </Button>
          <Button
            variant={viewMode === "timeline" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("timeline")}
          >
            <CalendarDays className="me-1 h-3.5 w-3.5" />
            {t("admin.kanbanTimelineView")}
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("calendar")}
          >
            <Calendar className="me-1 h-3.5 w-3.5" />
            {t("admin.kanbanCalendarView")}
          </Button>
          <Button
            variant={viewMode === "workstreams" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("workstreams")}
          >
            <Layers className="me-1 h-3.5 w-3.5" />
            {t("admin.kanbanWorkstreamsView")}
          </Button>
          <Button
            variant={viewMode === "blockers" ? "default" : "outline"}
            size="sm"
            className="h-7 px-2"
            onClick={() => setViewMode("blockers")}
          >
            <AlertTriangle className="me-1 h-3.5 w-3.5" />
            {t("admin.kanbanBlockersView")}
          </Button>
        </div>
      </div>

      {/* Board View */}
      {viewMode === "board" && (
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
      )}

      {/* Timeline View — Day by Day */}
      {viewMode === "timeline" && (
        <div className="space-y-3">
          {/* ReOrder button */}
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRebalance}
              disabled={rebalancing}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", rebalancing && "animate-spin")} />
              {rebalancing ? t("admin.kanbanRebalancing") : t("admin.kanbanRebalanceBtn")}
            </Button>
          </div>

          {daySections.map((section) => {
            const totalSlots = section.isOverdue || section.isUnscheduled ? 0 : DAILY_CAPACITY;
            const usedSlots = section.tasks.length + section.doneCount;
            const isFull = totalSlots > 0 && usedSlots >= totalSlots;
            const isLight = totalSlots > 0 && section.tasks.length === 0;

            return (
              <div
                key={section.key}
                className={cn(
                  "rounded-lg border bg-card",
                  section.isToday && "ring-2 ring-primary ring-offset-1",
                  section.isOverdue && "border-red-300 dark:border-red-800"
                )}
              >
                {/* Day header */}
                <div className={cn(
                  "flex items-center gap-2 border-b px-4 py-2.5",
                  section.isOverdue && "bg-red-50 dark:bg-red-950/20",
                  section.isToday && "bg-blue-50 dark:bg-blue-950/20"
                )}>
                  <h3
                    className={cn(
                      "text-sm font-semibold",
                      section.isOverdue && "text-red-600 dark:text-red-400",
                      section.isToday && "text-blue-600 dark:text-blue-400"
                    )}
                  >
                    {section.label}
                  </h3>
                  {section.isOverdue ? (
                    <Badge variant="destructive" className="text-[10px]">
                      {section.tasks.length}
                    </Badge>
                  ) : section.isUnscheduled ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {section.tasks.length}
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={isFull ? "default" : "secondary"}
                        className={cn(
                          "text-[10px]",
                          isFull && "bg-emerald-600"
                        )}
                      >
                        {t("admin.kanbanTimelineCapacity", { count: section.tasks.length, capacity: totalSlots })}
                      </Badge>
                      {section.doneCount > 0 && (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                          {t("admin.kanbanTimelineDoneToday", { count: section.doneCount })}
                        </span>
                      )}
                      {/* Capacity bar */}
                      <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:block">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isLight
                              ? "bg-muted-foreground/20"
                              : isFull
                                ? "bg-emerald-500"
                                : "bg-blue-500"
                          )}
                          style={{ width: `${Math.min(100, (usedSlots / totalSlots) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Tasks */}
                <div className={cn(
                  "flex flex-col gap-1.5 p-3",
                  section.tasks.length === 0 && "py-2"
                )}>
                  {section.tasks.length === 0 && !section.isUnscheduled ? (
                    <p className="text-xs text-muted-foreground">
                      {isLight ? "All done!" : "—"}
                    </p>
                  ) : (
                    section.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                          task.column === "IN_PROGRESS" && "border-s-2 border-s-amber-500",
                          task.column === "TESTING" && "border-s-2 border-s-violet-500"
                        )}
                        onClick={() => handleCardClick(task)}
                      >
                        <span
                          className={cn(
                            "inline-block h-2 w-2 shrink-0 rounded-full",
                            task.priority === "CRITICAL"
                              ? "bg-red-500"
                              : task.priority === "HIGH"
                                ? "bg-orange-500"
                                : task.priority === "LOW"
                                  ? "bg-muted-foreground/20"
                                  : "bg-muted-foreground/40"
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                          {task.phase}
                        </span>
                        <span className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px]",
                          task.column === "IN_PROGRESS"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : task.column === "TESTING"
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                              : "bg-muted text-muted-foreground"
                        )}>
                          {columnLabel(task.column)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <KanbanCalendar tasks={filtered} onTaskClick={handleCardClick} />
      )}

      {/* Workstreams View */}
      {viewMode === "workstreams" && (
        <div className="space-y-4">
          {Object.entries(workstreamGroups).map(([ws, tasks]) => {
            const doneCount = tasks.filter((t) => t.column === "DONE").length;
            const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

            return (
              <div key={ws} className="rounded-lg border bg-card">
                <div className="flex items-center gap-2 border-b px-4 py-2.5">
                  <h3 className="text-sm font-semibold">
                    {WORKSTREAM_LABELS[ws] || ws}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {doneCount}/{tasks.length} ({pct}%)
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 p-3">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                        task.isLaunchBlocker && "border-s-2 border-s-red-500"
                      )}
                      onClick={() => handleCardClick(task)}
                    >
                      <span
                        className={cn(
                          "inline-block h-2 w-2 shrink-0 rounded-full",
                          task.priority === "CRITICAL"
                            ? "bg-red-500"
                            : task.priority === "HIGH"
                              ? "bg-orange-500"
                              : "bg-muted-foreground/30"
                        )}
                      />
                      <span className="font-medium">{task.title}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                        {task.phase}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {columnLabel(task.column)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {Object.keys(workstreamGroups).length === 0 && (
            <p className="text-sm text-muted-foreground">{t("admin.kanbanDashboardNoSuggestions")}</p>
          )}
        </div>
      )}

      {/* Blockers View */}
      {viewMode === "blockers" && (
        <div className="space-y-6">
          {blockerTasks.notReady.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
                  {t("admin.pmBlockersNotReady")} ({blockerTasks.notReady.length})
                </h3>
              </div>
              <div className="space-y-1">
                {blockerTasks.notReady.map((task) => (
                  <div
                    key={task.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-s-2 border-s-red-500 px-3 py-2 text-sm transition-colors hover:bg-accent"
                    onClick={() => handleCardClick(task)}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{task.phase}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {columnLabel(task.column)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {blockerTasks.ready.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {t("admin.pmBlockersReady")} ({blockerTasks.ready.length})
              </h3>
              <div className="space-y-1">
                {blockerTasks.ready.map((task) => (
                  <div
                    key={task.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
                    onClick={() => handleCardClick(task)}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{task.phase}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {blockerTasks.notReady.length === 0 && blockerTasks.ready.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("admin.pmNoBlockers")}</p>
          )}
        </div>
      )}

      {/* Create/Edit dialog */}
      <KanbanTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editTask}
        onSaved={fetchTasks}
        onOpenTask={(taskId) => {
          const target = allTasks.find((t) => t.id === taskId);
          if (target) {
            setEditTask(target);
          }
        }}
      />
    </div>
  );
}
