"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Bug,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// -- Types --

interface AlphaIssue {
  id: string;
  title: string;
  description: string | null;
  severity: string;
  reproducibility: string | null;
  device: string | null;
  screenshot: string | null;
  reportedBy: string | null;
  linkedPmKey: string | null;
  status: string;
  fixedInCommit: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  total: number;
  open: number;
  critical: number;
  fixed: number;
}

// -- Constants --

const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "FIXED", "WONT_FIX", "DUPLICATE"] as const;
const REPRODUCIBILITIES = ["ALWAYS", "SOMETIMES", "RARE", "UNKNOWN"] as const;

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  MEDIUM: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  FIXED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  WONT_FIX: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  DUPLICATE: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

const REPRO_KEYS: Record<string, string> = {
  ALWAYS: "admin.alphaReproAlways",
  SOMETIMES: "admin.alphaReproSometimes",
  RARE: "admin.alphaReproRare",
  UNKNOWN: "admin.alphaReproUnknown",
};

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// -- Empty form --

function emptyForm() {
  return {
    title: "",
    description: "",
    severity: "MEDIUM" as string,
    status: "OPEN" as string,
    reproducibility: "UNKNOWN" as string,
    device: "",
    reportedBy: "",
    linkedPmKey: "",
    fixedInCommit: "",
    screenshot: "",
  };
}

// -- Component --

export default function AdminAlphaIssuesPage() {
  const { t } = useTranslation();
  const [issues, setIssues] = useState<AlphaIssue[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<AlphaIssue | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterSeverity !== "ALL") params.set("severity", filterSeverity);
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/alpha-issues?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIssues(data.issues || []);
      setStats(data.stats || null);
    } catch {
      toast.error(t("admin.alphaLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, filterSeverity, filterStatus, t]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  function openNewIssue() {
    setSelectedIssue(null);
    setForm(emptyForm());
    setDrawerOpen(true);
  }

  function openEditIssue(issue: AlphaIssue) {
    setSelectedIssue(issue);
    setForm({
      title: issue.title,
      description: issue.description || "",
      severity: issue.severity,
      status: issue.status,
      reproducibility: issue.reproducibility || "UNKNOWN",
      device: issue.device || "",
      reportedBy: issue.reportedBy || "",
      linkedPmKey: issue.linkedPmKey || "",
      fixedInCommit: issue.fixedInCommit || "",
      screenshot: issue.screenshot || "",
    });
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description || undefined,
        severity: form.severity,
        status: form.status,
        reproducibility: form.reproducibility || undefined,
        device: form.device || undefined,
        reportedBy: form.reportedBy || undefined,
        linkedPmKey: form.linkedPmKey || undefined,
        fixedInCommit: form.status === "FIXED" ? (form.fixedInCommit || undefined) : undefined,
        screenshot: form.screenshot || undefined,
      };

      if (selectedIssue) {
        // PATCH
        const res = await fetch(`/api/admin/alpha-issues/${selectedIssue.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        toast.success(t("admin.alphaIssueUpdated"));
      } else {
        // POST
        const res = await fetch("/api/admin/alpha-issues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        toast.success(t("admin.alphaIssueCreated"));
      }
      setDrawerOpen(false);
      fetchIssues();
    } catch {
      toast.error(t("admin.alphaSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedIssue) return;
    if (!confirm(t("admin.alphaDeleteConfirm"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/alpha-issues/${selectedIssue.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success(t("admin.alphaIssueDeleted"));
      setDrawerOpen(false);
      fetchIssues();
    } catch {
      toast.error(t("admin.alphaDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  // -- Render helpers --

  function renderSeverityBadge(severity: string) {
    return (
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
          SEVERITY_COLORS[severity] || SEVERITY_COLORS.MEDIUM
        )}
      >
        {severity}
      </span>
    );
  }

  function renderStatusBadge(status: string) {
    return (
      <span
        className={cn(
          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
          STATUS_COLORS[status] || STATUS_COLORS.OPEN
        )}
      >
        {status.replace("_", " ")}
      </span>
    );
  }

  function renderDrawer() {
    const isNew = !selectedIssue;

    return (
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-start">
              {isNew ? t("admin.alphaNewIssue") : t("admin.alphaEditIssue")}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.alphaTitle")}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("admin.alphaTitle")}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("common.description")}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Severity + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.alphaSeverity")}</Label>
                <Select
                  value={form.severity}
                  onValueChange={(v) => setForm({ ...form, severity: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.alphaStatus")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reproducibility */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.alphaReproducibility")}</Label>
              <Select
                value={form.reproducibility}
                onValueChange={(v) => setForm({ ...form, reproducibility: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPRODUCIBILITIES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(REPRO_KEYS[r])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Device */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.alphaDevice")}</Label>
              <Input
                value={form.device}
                onChange={(e) => setForm({ ...form, device: e.target.value })}
              />
            </div>

            {/* Reported by */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.alphaReportedBy")}</Label>
              <Input
                value={form.reportedBy}
                onChange={(e) => setForm({ ...form, reportedBy: e.target.value })}
              />
            </div>

            {/* Linked PM Key */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.alphaLinkedPmKey")}</Label>
              <Input
                value={form.linkedPmKey}
                onChange={(e) => setForm({ ...form, linkedPmKey: e.target.value })}
              />
            </div>

            {/* Fixed in Commit (only when FIXED) */}
            {form.status === "FIXED" && (
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.alphaFixedInCommit")}</Label>
                <Input
                  value={form.fixedInCommit}
                  onChange={(e) => setForm({ ...form, fixedInCommit: e.target.value })}
                  placeholder="e.g. abc1234"
                />
              </div>
            )}

            {/* Screenshot */}
            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.alphaScreenshot")}</Label>
              <Input
                value={form.screenshot}
                onChange={(e) => setForm({ ...form, screenshot: e.target.value })}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? t("common.saving") : t("common.save")}
              </Button>
              {selectedIssue && (
                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="me-1.5 h-3.5 w-3.5" />
                  {t("common.delete")}
                </Button>
              )}
              <Button
                onClick={() => setDrawerOpen(false)}
                variant="ghost"
                size="sm"
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // -- Main render --

  if (loading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.alphaTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.alphaDesc")}</p>
        </div>
        <Button size="sm" onClick={openNewIssue}>
          <Plus className="me-2 h-3.5 w-3.5" />
          {t("admin.alphaNewIssue")}
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{t("admin.alphaTotal")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold text-red-600">{stats.open}</p>
            <p className="text-xs text-muted-foreground">{t("admin.alphaOpen")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.alphaCritical")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-2xl font-bold text-emerald-600">{stats.fixed}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t("admin.alphaFixed")}</p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="h-8 w-auto text-xs">
            <SelectValue placeholder={t("admin.alphaSeverity")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("admin.alphaAllSeverities")}</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-auto text-xs">
            <SelectValue placeholder={t("admin.alphaStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("admin.alphaAllStatuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 ps-8 text-xs"
            placeholder={t("admin.alphaSearch")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Issue list */}
      <div className="space-y-1">
        {issues.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <Bug className="h-8 w-8" />
            <p className="text-sm">{t("admin.alphaNoIssues")}</p>
          </div>
        )}
        {issues.map((issue) => (
          <button
            key={issue.id}
            type="button"
            onClick={() => openEditIssue(issue)}
            className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-start text-sm transition-colors hover:bg-accent"
          >
            {renderSeverityBadge(issue.severity)}
            {renderStatusBadge(issue.status)}
            <span className="min-w-0 flex-1 truncate font-medium">
              {issue.title}
            </span>
            {issue.device && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {issue.device}
              </span>
            )}
            {issue.reportedBy && (
              <Badge variant="outline" className="text-[10px]">
                {issue.reportedBy}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">
              {relativeTime(issue.createdAt)}
            </span>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {t("admin.alphaShowing", { count: issues.length, total: stats?.total ?? 0 })}
      </p>

      {/* Drawer */}
      {renderDrawer()}
    </div>
  );
}
