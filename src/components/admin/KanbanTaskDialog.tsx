"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, ChevronDown, ChevronRight, AlertTriangle, Link2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import type { KanbanTask } from "./KanbanCard";

interface KanbanTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: KanbanTask | null;
  onSaved: () => void;
  onOpenTask?: (taskId: string) => void;
}

interface FormData {
  title: string;
  description: string;
  phase: string;
  priority: string;
  column: string;
  notes: string;
  category: string;
  dueDate: string;
  result: string;
  // PM fields
  workstream: string;
  milestone: string;
  pmStatus: string;
  owner: string;
  isLaunchBlocker: boolean;
  acceptanceCriteria: string;
  risks: string;
  estimateBest: string;
  estimateLikely: string;
  estimateWorst: string;
  discoveredFromId: string;
}

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
  phase: "W1",
  priority: "NORMAL",
  column: "BACKLOG",
  notes: "",
  category: "FEATURE",
  dueDate: "",
  result: "",
  workstream: "",
  milestone: "",
  pmStatus: "",
  owner: "",
  isLaunchBlocker: false,
  acceptanceCriteria: "",
  risks: "",
  estimateBest: "",
  estimateLikely: "",
  estimateWorst: "",
  discoveredFromId: "",
};

const PHASES = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
const WORKSTREAMS = [
  { key: "PRODUCT_CORE", label: "Product Core Loop" },
  { key: "TRUST_INTEGRITY", label: "Trust & Integrity" },
  { key: "PLATFORM_OPS", label: "Platform & Operations" },
  { key: "MONETIZATION_GROWTH", label: "Monetization & Growth" },
  { key: "MARKET_INTELLIGENCE", label: "Market Intelligence" },
];
const MILESTONES = [
  { key: "MVP_BETA", label: "MVP Beta" },
  { key: "ALPHA_TEST", label: "Alpha Test" },
  { key: "PUBLIC_LAUNCH", label: "Public Launch" },
  { key: "POST_LAUNCH", label: "Post-Launch" },
];
const PM_STATUSES = ["PLANNED", "IMPLEMENTED", "INTEGRATED", "CONFIGURED", "VERIFIED", "HARDENED", "OPERABLE", "DEPRECATED"];
const COLUMNS = ["BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "DONE", "BUGS_FIXED"];
const PRIORITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW"];
const CATEGORIES = ["FEATURE", "BUG_FIX", "IMPROVEMENT", "MAINTENANCE", "INFRASTRUCTURE", "IDEA"];

const CATEGORY_LABELS: Record<string, string> = {
  FEATURE: "kanbanCategoryFeature",
  BUG_FIX: "kanbanCategoryBugFix",
  IMPROVEMENT: "kanbanCategoryImprovement",
  MAINTENANCE: "kanbanCategoryMaintenance",
  INFRASTRUCTURE: "kanbanCategoryInfrastructure",
  IDEA: "kanbanCategoryIdea",
};

function toDateInputValue(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

function formatTimestamp(isoDate: string | null): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function KanbanTaskDialog({
  open,
  onOpenChange,
  task,
  onSaved,
  onOpenTask,
}: KanbanTaskDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pmExpanded, setPmExpanded] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskSearchResults, setTaskSearchResults] = useState<{ id: string; title: string }[]>([]);
  const isEdit = !!task?.id;

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        phase: task.phase,
        priority: task.priority,
        column: task.column,
        notes: task.notes ?? "",
        category: task.category ?? "FEATURE",
        dueDate: toDateInputValue(task.dueDate),
        result: task.result ?? "",
        workstream: task.workstream ?? "",
        milestone: task.milestone ?? "",
        pmStatus: task.pmStatus ?? "",
        owner: task.owner ?? "",
        isLaunchBlocker: task.isLaunchBlocker ?? false,
        acceptanceCriteria: task.acceptanceCriteria ?? "",
        risks: task.risks ?? "",
        estimateBest: task.estimateBest != null ? String(task.estimateBest) : "",
        estimateLikely: task.estimateLikely != null ? String(task.estimateLikely) : "",
        estimateWorst: task.estimateWorst != null ? String(task.estimateWorst) : "",
        discoveredFromId: task.discoveredFromId ?? "",
      });
      // Auto-expand PM section if task has PM fields
      setPmExpanded(!!(task.workstream || task.pmStatus || task.epicKey));
    } else {
      setForm(EMPTY_FORM);
      setPmExpanded(false);
    }
    setConfirmDelete(false);
  }, [task]);

  function columnLabel(col: string) {
    const key = `admin.kanbanCol${col.charAt(0) + col.slice(1).toLowerCase().replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}`;
    return t(key) || col;
  }

  function priorityLabel(p: string) {
    const key = `admin.kanban${p.charAt(0) + p.slice(1).toLowerCase()}`;
    return t(key) || p;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const url = isEdit
        ? `/api/admin/kanban/${task!.id}`
        : "/api/admin/kanban";
      const method = isEdit ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description || null,
        phase: form.phase,
        priority: form.priority,
        column: form.column,
        notes: form.notes || null,
        category: form.category,
        dueDate: form.dueDate
          ? new Date(form.dueDate + "T00:00:00.000Z").toISOString()
          : null,
        result: form.result || null,
        workstream: form.workstream || null,
        milestone: form.milestone || null,
        pmStatus: form.pmStatus || null,
        owner: form.owner || null,
        isLaunchBlocker: form.isLaunchBlocker,
        acceptanceCriteria: form.acceptanceCriteria || null,
        risks: form.risks || null,
        estimateBest: form.estimateBest ? Number(form.estimateBest) : null,
        estimateLikely: form.estimateLikely ? Number(form.estimateLikely) : null,
        estimateWorst: form.estimateWorst ? Number(form.estimateWorst) : null,
        discoveredFromId: form.discoveredFromId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("admin.failedToSave"));
      }

      toast.success(isEdit ? t("admin.kanbanTaskUpdated") : t("admin.kanbanTaskCreated"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("admin.failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!task?.id) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/kanban/${task.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error();

      toast.success(t("admin.kanbanTaskDeleted"));
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error(t("admin.failedToSave"));
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("admin.kanbanEditTask") : t("admin.kanbanNewTask")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin.kanbanTitleLabel")}</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder={t("admin.kanbanTitlePlaceholder")}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t("admin.kanbanDescription")}</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder={t("admin.optionalDescription")}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t("admin.kanbanPhase")}</Label>
              <Select
                value={form.phase}
                onValueChange={(v) => setForm((f) => ({ ...f, phase: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHASES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.kanbanPriority")}</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {priorityLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.kanbanColumn")}</Label>
              <Select
                value={form.column}
                onValueChange={(v) => setForm((f) => ({ ...f, column: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {columnLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("admin.kanbanCategory")}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`admin.${CATEGORY_LABELS[c]}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.kanbanDueDate")}</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("admin.kanbanNotes")}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder={t("admin.kanbanNotesPlaceholder")}
              rows={2}
            />
          </div>

          {isEdit && (
            <div className="space-y-2">
              <Label>{t("admin.kanbanResult")}</Label>
              <Textarea
                value={form.result}
                onChange={(e) =>
                  setForm((f) => ({ ...f, result: e.target.value }))
                }
                placeholder={t("admin.kanbanResultPlaceholder")}
                rows={2}
              />
            </div>
          )}

          {/* Discovered From — link to parent task */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5" />
              {t("admin.kanbanDiscoveredFrom")}
            </Label>
            {form.discoveredFromId && task?.discoveredFrom ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenTask?.(task.discoveredFrom!.id)}
                  className="truncate rounded-md border bg-muted/50 px-2.5 py-1.5 text-start text-xs font-medium text-primary hover:bg-muted hover:underline"
                >
                  {task.discoveredFrom.title}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setForm((f) => ({ ...f, discoveredFromId: "" }))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  value={taskSearch}
                  onChange={(e) => {
                    setTaskSearch(e.target.value);
                    if (e.target.value.length >= 2) {
                      setSearchingTasks(true);
                      fetch(`/api/admin/kanban?search=${encodeURIComponent(e.target.value)}`)
                        .then((r) => r.json())
                        .then((data) => {
                          const results = (data.tasks || [])
                            .filter((t: { id: string }) => t.id !== task?.id)
                            .slice(0, 5)
                            .map((t: { id: string; title: string }) => ({ id: t.id, title: t.title }));
                          setTaskSearchResults(results);
                        })
                        .finally(() => setSearchingTasks(false));
                    } else {
                      setTaskSearchResults([]);
                    }
                  }}
                  placeholder={t("admin.kanbanSearchTask")}
                  className="h-8 text-xs"
                />
                {taskSearchResults.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {taskSearchResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="w-full truncate px-3 py-2 text-start text-xs hover:bg-accent"
                        onClick={() => {
                          setForm((f) => ({ ...f, discoveredFromId: r.id }));
                          setTaskSearch("");
                          setTaskSearchResults([]);
                        }}
                      >
                        {r.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Collapsible Roadmap Details */}
          <div className="rounded-md border">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setPmExpanded(!pmExpanded)}
            >
              {pmExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {t("admin.kanbanRoadmapDetails")}
              {task?.isLaunchBlocker && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
            </button>

            {pmExpanded && (
              <div className="space-y-3 border-t px-3 pb-3 pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">{t("admin.kanbanWorkstream")}</Label>
                    <Select
                      value={form.workstream || "__empty__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, workstream: v === "__empty__" ? "" : v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">—</SelectItem>
                        {WORKSTREAMS.map((ws) => (
                          <SelectItem key={ws.key} value={ws.key}>{ws.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t("admin.kanbanMilestone")}</Label>
                    <Select
                      value={form.milestone || "__empty__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, milestone: v === "__empty__" ? "" : v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">—</SelectItem>
                        {MILESTONES.map((m) => (
                          <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">{t("admin.kanbanPmStatus")}</Label>
                    <Select
                      value={form.pmStatus || "__empty__"}
                      onValueChange={(v) => setForm((f) => ({ ...f, pmStatus: v === "__empty__" ? "" : v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">—</SelectItem>
                        {PM_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">{t("admin.pmOwner")}</Label>
                    <Input
                      value={form.owner}
                      onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                      placeholder={t("admin.pmOwnerPlaceholder")}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.isLaunchBlocker}
                    onChange={(e) => setForm((f) => ({ ...f, isLaunchBlocker: e.target.checked }))}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    {t("admin.pmLaunchBlocker")}
                  </span>
                </label>

                <div className="space-y-2">
                  <Label className="text-xs">{t("admin.pmAcceptance")}</Label>
                  <Textarea
                    value={form.acceptanceCriteria}
                    onChange={(e) => setForm((f) => ({ ...f, acceptanceCriteria: e.target.value }))}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">{t("admin.pmRisks")}</Label>
                  <Textarea
                    value={form.risks}
                    onChange={(e) => setForm((f) => ({ ...f, risks: e.target.value }))}
                    rows={2}
                    className="text-xs"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-emerald-600">{t("admin.pmEstBest")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.estimateBest}
                      onChange={(e) => setForm((f) => ({ ...f, estimateBest: e.target.value }))}
                      placeholder="days"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-amber-600">{t("admin.pmEstLikely")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.estimateLikely}
                      onChange={(e) => setForm((f) => ({ ...f, estimateLikely: e.target.value }))}
                      placeholder="days"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-red-600">{t("admin.pmEstWorst")}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.estimateWorst}
                      onChange={(e) => setForm((f) => ({ ...f, estimateWorst: e.target.value }))}
                      placeholder="days"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                {/* Evidence & dependencies (read-only) */}
                {isEdit && task?.evidence && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("admin.pmEvidence")}</Label>
                    {(task.evidence as Record<string, string[]>)?.files?.map((f: string) => (
                      <p key={f} className="truncate font-mono text-[10px] text-muted-foreground">{f}</p>
                    ))}
                  </div>
                )}

                {isEdit && task?.dependencies && (task.dependencies as string[]).length > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("admin.pmDependencies")}</Label>
                    <div className="flex flex-wrap gap-1">
                      {(task.dependencies as string[]).map((d: string) => (
                        <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {isEdit && task?.lastVerifiedAt && (
                  <p className="text-[10px] text-muted-foreground">
                    {t("admin.pmLastVerified")}: {new Date(task.lastVerifiedAt).toLocaleDateString()}
                  </p>
                )}

                {isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/admin/kanban/${task!.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ lastVerifiedAt: new Date().toISOString() }),
                        });
                        if (!res.ok) throw new Error();
                        toast.success(t("admin.pmMarkedVerified"));
                        onSaved();
                      } catch {
                        toast.error(t("admin.failedToSave"));
                      }
                    }}
                  >
                    {t("admin.pmMarkVerified")}
                  </Button>
                )}
              </div>
            )}
          </div>

          {isEdit && (task?.startedAt || task?.completedAt) && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              {task.startedAt && (
                <p>
                  {t("admin.kanbanStartedAt")}: {formatTimestamp(task.startedAt)}
                </p>
              )}
              {task.completedAt && (
                <p>
                  {t("admin.kanbanCompletedAt")}: {formatTimestamp(task.completedAt)}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {isEdit ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-destructive">
                    {t("admin.kanbanDeleteConfirm")}
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {t("common.confirm")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="me-1.5 h-3.5 w-3.5" />
                  {t("common.delete")}
                </Button>
              )
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? t("common.saving")
                  : isEdit
                    ? t("common.save")
                    : t("common.create")}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
