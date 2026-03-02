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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import type { KanbanTask } from "./KanbanCard";

interface KanbanTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: KanbanTask | null;
  onSaved: () => void;
}

interface FormData {
  title: string;
  description: string;
  phase: string;
  priority: string;
  column: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
  phase: "P1",
  priority: "NORMAL",
  column: "BACKLOG",
  notes: "",
};

const PHASES = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];
const COLUMNS = ["BACKLOG", "TODO", "IN_PROGRESS", "TESTING", "DONE"];
const PRIORITIES = ["CRITICAL", "HIGH", "NORMAL", "LOW"];

export function KanbanTaskDialog({
  open,
  onOpenChange,
  task,
  onSaved,
}: KanbanTaskDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
      });
    } else {
      setForm(EMPTY_FORM);
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

      const body = {
        title: form.title,
        description: form.description || null,
        phase: form.phase,
        priority: form.priority,
        column: form.column,
        notes: form.notes || null,
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
