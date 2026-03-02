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
  AlertTriangle,
  Layers,
  LayoutList,
  ListFilter,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Database,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────

interface PmEvidence {
  files?: string[];
  envVars?: string[];
  tests?: string[];
}

interface PmItemData {
  id: string;
  key: string;
  title: string;
  description: string | null;
  epicKey: string;
  epicTitle: string;
  workstream: string;
  phase: string;
  priority: string;
  status: string;
  milestone: string;
  owner: string | null;
  notes: string | null;
  isLaunchBlocker: boolean;
  acceptanceCriteria: string | null;
  risks: string | null;
  dependencies: string[] | null;
  evidence: PmEvidence | null;
  lastVerifiedAt: string | null;
  updatedAt: string;
}

interface Stats {
  total: number;
  byStatus: Record<string, number>;
  byWorkstream: Record<string, number>;
  blockers: number;
}

// ── Constants ──────────────────────────────────────────────

const STATUSES = [
  "PLANNED",
  "IMPLEMENTED",
  "INTEGRATED",
  "CONFIGURED",
  "VERIFIED",
  "HARDENED",
  "OPERABLE",
  "DEPRECATED",
] as const;

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  IMPLEMENTED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  INTEGRATED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  CONFIGURED: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  VERIFIED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  HARDENED: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  OPERABLE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  DEPRECATED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const PRIORITIES = ["P0", "P1", "P2"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  P1: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  P2: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const WORKSTREAMS = [
  { key: "PRODUCT_CORE", label: "Product Core Loop" },
  { key: "TRUST_INTEGRITY", label: "Trust & Integrity" },
  { key: "PLATFORM_OPS", label: "Platform & Operations" },
  { key: "MONETIZATION_GROWTH", label: "Monetization & Growth" },
] as const;

const MILESTONES = ["MVP_BETA", "PUBLIC_LAUNCH", "POST_LAUNCH"] as const;

const MILESTONE_LABELS: Record<string, string> = {
  MVP_BETA: "MVP Beta",
  PUBLIC_LAUNCH: "Public Launch",
  POST_LAUNCH: "Post-Launch",
};

const PHASES = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];

const PHASE_LABELS: Record<string, string> = {
  P1: "P1 — Auth & Profiles",
  P2: "P2 — Statements & Verification",
  P3: "P3 — Clans & Chat",
  P4: "P4 — Leaderboards & Badges",
  P5: "P5 — Content & Integrity",
  P6: "P6 — AI Features",
  P7: "P7 — Payments",
  P8: "P8 — Polish & Launch",
};

type ViewMode = "workstreams" | "phases" | "list" | "blockers";

// ── Component ──────────────────────────────────────────────

export default function AdminPmPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<PmItemData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [view, setView] = useState<ViewMode>("workstreams");

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterMilestone, setFilterMilestone] = useState<string>("ALL");
  const [filterPriority, setFilterPriority] = useState<string>("ALL");

  // Drawer
  const [selectedItem, setSelectedItem] = useState<PmItemData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields in drawer
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const fetchItems = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/pm?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || null);
    } catch {
      toast.error(t("admin.pmLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, t]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function handleSeed() {
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/pm/seed", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(t("admin.pmSeeded", { created: data.created, updated: data.updated }));
      fetchItems();
    } catch {
      toast.error(t("admin.pmSeedFailed"));
    } finally {
      setSeeding(false);
    }
  }

  function openDrawer(item: PmItemData) {
    setSelectedItem(item);
    setEditStatus(item.status);
    setEditPriority(item.priority);
    setEditOwner(item.owner || "");
    setEditNotes(item.notes || "");
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editStatus !== selectedItem.status) body.status = editStatus;
      if (editPriority !== selectedItem.priority) body.priority = editPriority;
      if (editOwner !== (selectedItem.owner || ""))
        body.owner = editOwner || null;
      if (editNotes !== (selectedItem.notes || ""))
        body.notes = editNotes || null;

      if (Object.keys(body).length === 0) {
        setDrawerOpen(false);
        return;
      }

      const res = await fetch(`/api/admin/pm/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(t("admin.pmItemUpdated"));
      setDrawerOpen(false);
      fetchItems();
    } catch {
      toast.error(t("admin.failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  async function markVerified() {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/pm/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastVerifiedAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("admin.pmMarkedVerified"));
      setDrawerOpen(false);
      fetchItems();
    } catch {
      toast.error(t("admin.failedToSave"));
    } finally {
      setSaving(false);
    }
  }

  // ── Filtering ──────────────────────────────────────────

  const filtered = items.filter((item) => {
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    if (filterMilestone !== "ALL" && item.milestone !== filterMilestone) return false;
    if (filterPriority !== "ALL" && item.priority !== filterPriority) return false;
    return true;
  });

  // ── Grouping ───────────────────────────────────────────

  function groupByField(field: "workstream" | "phase" | "epicKey") {
    const groups: Record<string, PmItemData[]> = {};
    for (const item of filtered) {
      const key = item[field];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }

  // ── Render helpers ─────────────────────────────────────

  function renderStatusBadge(status: string) {
    return (
      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", STATUS_COLORS[status] || STATUS_COLORS.PLANNED)}>
        {status}
      </span>
    );
  }

  function renderPriorityBadge(priority: string) {
    return (
      <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold", PRIORITY_COLORS[priority] || PRIORITY_COLORS.P1)}>
        {priority}
      </span>
    );
  }

  function renderItemRow(item: PmItemData) {
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => openDrawer(item)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-start text-sm transition-colors hover:bg-accent",
          item.isLaunchBlocker && "border-s-2 border-s-red-500"
        )}
      >
        {renderPriorityBadge(item.priority)}
        {renderStatusBadge(item.status)}
        <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
        <span className="hidden text-xs text-muted-foreground sm:inline">{item.phase}</span>
        {item.isLaunchBlocker && (
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
        )}
        {item.owner && (
          <Badge variant="outline" className="text-[10px]">
            {item.owner}
          </Badge>
        )}
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    );
  }

  function renderGroup(title: string, groupItems: PmItemData[], subtitle?: string) {
    const doneCount = groupItems.filter(
      (i) => ["VERIFIED", "HARDENED", "OPERABLE"].includes(i.status)
    ).length;
    const pct = groupItems.length > 0 ? Math.round((doneCount / groupItems.length) * 100) : 0;

    return (
      <div key={title} className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
          <Badge variant="secondary" className="text-[10px]">
            {doneCount}/{groupItems.length} ({pct}%)
          </Badge>
        </div>
        <div className="space-y-1">
          {groupItems.map(renderItemRow)}
        </div>
      </div>
    );
  }

  // ── Views ──────────────────────────────────────────────

  function renderWorkstreamsView() {
    const groups = groupByField("workstream");
    return (
      <div className="space-y-6">
        {WORKSTREAMS.map((ws) => {
          const wsItems = groups[ws.key] || [];
          if (wsItems.length === 0) return null;
          return renderGroup(ws.label, wsItems);
        })}
      </div>
    );
  }

  function renderPhasesView() {
    const groups = groupByField("phase");
    return (
      <div className="space-y-6">
        {PHASES.map((p) => {
          const phaseItems = groups[p] || [];
          if (phaseItems.length === 0) return null;
          return renderGroup(PHASE_LABELS[p] || p, phaseItems);
        })}
      </div>
    );
  }

  function renderListView() {
    return (
      <div className="space-y-1">
        {filtered.map(renderItemRow)}
      </div>
    );
  }

  function renderBlockersView() {
    const blockers = filtered.filter((i) => i.isLaunchBlocker);
    const notReady = blockers.filter(
      (i) => !["VERIFIED", "HARDENED", "OPERABLE", "CONFIGURED"].includes(i.status)
    );
    const ready = blockers.filter(
      (i) => ["VERIFIED", "HARDENED", "OPERABLE", "CONFIGURED"].includes(i.status)
    );

    return (
      <div className="space-y-6">
        {notReady.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">
                {t("admin.pmBlockersNotReady")} ({notReady.length})
              </h3>
            </div>
            <div className="space-y-1">{notReady.map(renderItemRow)}</div>
          </div>
        )}
        {ready.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {t("admin.pmBlockersReady")} ({ready.length})
            </h3>
            <div className="space-y-1">{ready.map(renderItemRow)}</div>
          </div>
        )}
        {blockers.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("admin.pmNoBlockers")}</p>
        )}
      </div>
    );
  }

  // ── Progress bar ───────────────────────────────────────

  function renderProgressBar() {
    if (!stats) return null;
    const total = stats.total;
    if (total === 0) return null;

    const segments = STATUSES.map((s) => ({
      status: s,
      count: stats.byStatus[s] || 0,
      pct: ((stats.byStatus[s] || 0) / total) * 100,
    }));

    return (
      <div className="space-y-1">
        <div className="flex h-3 overflow-hidden rounded-full bg-muted">
          {segments.map(
            (seg) =>
              seg.count > 0 && (
                <div
                  key={seg.status}
                  className={cn("h-full", STATUS_COLORS[seg.status]?.split(" ")[0])}
                  style={{ width: `${seg.pct}%` }}
                  title={`${seg.status}: ${seg.count}`}
                />
              )
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          {segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <span key={s.status}>
                {s.status}: {s.count}
              </span>
            ))}
        </div>
      </div>
    );
  }

  // ── Drawer ─────────────────────────────────────────────

  function renderDrawer() {
    if (!selectedItem) return null;
    const ev = selectedItem.evidence;
    const deps = selectedItem.dependencies;

    return (
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-start">{selectedItem.title}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-5">
            {/* Meta badges */}
            <div className="flex flex-wrap gap-2">
              {renderStatusBadge(selectedItem.status)}
              {renderPriorityBadge(selectedItem.priority)}
              <Badge variant="outline" className="text-[10px]">
                {selectedItem.phase}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {MILESTONE_LABELS[selectedItem.milestone] || selectedItem.milestone}
              </Badge>
              {selectedItem.isLaunchBlocker && (
                <Badge variant="destructive" className="text-[10px]">
                  {t("admin.pmLaunchBlocker")}
                </Badge>
              )}
            </div>

            {/* Description */}
            {selectedItem.description && (
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.pmDescription")}</Label>
                <p className="mt-1 text-sm">{selectedItem.description}</p>
              </div>
            )}

            {/* Acceptance criteria */}
            {selectedItem.acceptanceCriteria && (
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.pmAcceptance")}</Label>
                <p className="mt-1 text-sm">{selectedItem.acceptanceCriteria}</p>
              </div>
            )}

            {/* Dependencies */}
            {deps && deps.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.pmDependencies")}</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {deps.map((d) => (
                    <Badge key={d} variant="secondary" className="text-[10px]">{d}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {selectedItem.risks && (
              <div>
                <Label className="text-xs text-muted-foreground">{t("admin.pmRisks")}</Label>
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">{selectedItem.risks}</p>
              </div>
            )}

            {/* Evidence */}
            {ev && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("admin.pmEvidence")}</Label>
                {ev.files && ev.files.length > 0 && (
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground">{t("admin.pmFiles")}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {ev.files.map((f) => (
                        <div key={f} className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {ev.envVars && ev.envVars.length > 0 && (
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground">{t("admin.pmEnvVars")}</span>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {ev.envVars.map((v) => (
                        <code key={v} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{v}</code>
                      ))}
                    </div>
                  </div>
                )}
                {ev.tests && ev.tests.length > 0 && (
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground">{t("admin.pmTests")}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {ev.tests.map((tt) => (
                        <div key={tt} className="text-xs font-mono text-muted-foreground">{tt}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Last verified */}
            {selectedItem.lastVerifiedAt && (
              <p className="text-[10px] text-muted-foreground">
                {t("admin.pmLastVerified")}: {new Date(selectedItem.lastVerifiedAt).toLocaleDateString()}
              </p>
            )}

            <hr />

            {/* Editable fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.pmStatus")}</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("admin.pmPriorityLabel")}</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.pmOwner")}</Label>
              <Input
                value={editOwner}
                onChange={(e) => setEditOwner(e.target.value)}
                placeholder={t("admin.pmOwnerPlaceholder")}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("admin.pmNotes")}</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder={t("admin.pmNotesPlaceholder")}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? t("common.saving") : t("common.save")}
              </Button>
              <Button
                onClick={markVerified}
                disabled={saving}
                variant="outline"
                size="sm"
              >
                {t("admin.pmMarkVerified")}
              </Button>
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

  // ── Main render ────────────────────────────────────────

  if (loading) {
    return <p className="text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.pmTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.pmDesc")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleSeed} disabled={seeding}>
          <Database className="me-2 h-3.5 w-3.5" />
          {seeding ? t("admin.pmSeeding") : t("admin.pmSeedBtn")}
        </Button>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{t("admin.pmTotalItems")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold text-red-600">{stats.blockers}</p>
            <p className="text-xs text-muted-foreground">{t("admin.pmLaunchBlockers")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold text-emerald-600">
              {(stats.byStatus["VERIFIED"] || 0) +
                (stats.byStatus["HARDENED"] || 0) +
                (stats.byStatus["OPERABLE"] || 0)}
            </p>
            <p className="text-xs text-muted-foreground">{t("admin.pmVerifiedPlus")}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold text-gray-500">
              {stats.byStatus["PLANNED"] || 0}
            </p>
            <p className="text-xs text-muted-foreground">{t("admin.pmPlanned")}</p>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {renderProgressBar()}

      {/* View tabs + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border">
          {[
            { key: "workstreams" as ViewMode, icon: Layers, label: t("admin.pmWorkstreams") },
            { key: "phases" as ViewMode, icon: LayoutList, label: t("admin.pmPhases") },
            { key: "list" as ViewMode, icon: ListFilter, label: t("admin.pmList") },
            { key: "blockers" as ViewMode, icon: AlertTriangle, label: t("admin.pmBlockersTab") },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                view === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute start-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 ps-8 text-xs"
              placeholder={t("admin.pmSearch")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-auto text-xs">
              <SelectValue placeholder={t("admin.pmStatus")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("admin.pmAllStatuses")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterMilestone} onValueChange={setFilterMilestone}>
            <SelectTrigger className="h-8 w-auto text-xs">
              <SelectValue placeholder={t("admin.pmMilestone")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("admin.pmAllMilestones")}</SelectItem>
              {MILESTONES.map((m) => (
                <SelectItem key={m} value={m}>{MILESTONE_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-8 w-auto text-xs">
              <SelectValue placeholder={t("admin.pmPriorityLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("admin.pmAllPriorities")}</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setFilterStatus("ALL"); setFilterMilestone("ALL"); setFilterPriority("ALL"); }}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* View content */}
      <div>
        {view === "workstreams" && renderWorkstreamsView()}
        {view === "phases" && renderPhasesView()}
        {view === "list" && renderListView()}
        {view === "blockers" && renderBlockersView()}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {t("admin.pmShowing", { count: filtered.length, total: items.length })}
      </p>

      {/* Drawer */}
      {renderDrawer()}
    </div>
  );
}
