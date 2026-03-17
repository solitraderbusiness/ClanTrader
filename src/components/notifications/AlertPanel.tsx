"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BellRing,
  Plus,
  Trash2,
  X,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PriceAlertModal } from "./PriceAlertModal";

interface PriceAlertItem {
  id: string;
  symbol: string;
  condition: "ABOVE" | "BELOW";
  targetPrice: number;
  sourceGroup: string | null;
  status: "ACTIVE" | "TRIGGERED" | "CANCELLED" | "EXPIRED";
  triggeredAt: string | null;
  lastSeenPrice: number | null;
  priceAtCreation: number | null;
  expiresAt: string | null;
  createdAt: string;
}

type TabKey = "active" | "history";

function formatTimeRemaining(expiresAt: string): string {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  const diff = exp - now;

  if (diff <= 0) return "Expiring...";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface AlertPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertPanel({ open, onOpenChange }: AlertPanelProps) {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("active");
  const [modalOpen, setModalOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/price-alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on open + poll every 30s while open
  useEffect(() => {
    if (!open) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    setLoading(true);
    fetchAlerts();
    pollRef.current = setInterval(fetchAlerts, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, fetchAlerts]);

  async function handleCancel(id: string) {
    const res = await fetch(`/api/price-alerts/${id}`, { method: "PATCH" });
    if (res.ok) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "CANCELLED" as const } : a))
      );
      toast.success(t("priceAlerts.cancelled"));
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/price-alerts/${id}`, { method: "DELETE" });
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success(t("priceAlerts.deleted"));
    }
  }

  const active = alerts.filter((a) => a.status === "ACTIVE");
  const history = alerts.filter((a) => a.status !== "ACTIVE");

  const displayAlerts = tab === "active" ? active : history;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          <SheetHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5" />
                {t("priceAlerts.title")}
              </SheetTitle>
              <Button
                size="sm"
                onClick={() => setModalOpen(true)}
                className="h-8"
              >
                <Plus className="me-1.5 h-3.5 w-3.5" />
                {t("priceAlerts.newAlert")}
              </Button>
            </div>
            <SheetDescription className="sr-only">
              {t("priceAlerts.title")}
            </SheetDescription>
          </SheetHeader>

          {/* Tabs */}
          <div className="flex gap-1.5 border-b px-1 py-2">
            <button
              onClick={() => setTab("active")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "active"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t("priceAlerts.active")}
              {active.length > 0 && (
                <span className="ms-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1 text-[10px]">
                  {active.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab("history")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "history"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {t("priceAlerts.history")}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : displayAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
                <BellRing className="mb-3 h-10 w-10 opacity-20" />
                <p>
                  {tab === "active"
                    ? t("priceAlerts.noActive")
                    : t("priceAlerts.noHistory")}
                </p>
                {tab === "active" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setModalOpen(true)}
                  >
                    {t("priceAlerts.createFirst")}
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {displayAlerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    onCancel={handleCancel}
                    onDelete={handleDelete}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <PriceAlertModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={fetchAlerts}
      />
    </>
  );
}

// ---- Alert Row ----

function AlertRow({
  alert,
  onCancel,
  onDelete,
  t,
}: {
  alert: PriceAlertItem;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const isActive = alert.status === "ACTIVE";
  const isTriggered = alert.status === "TRIGGERED";
  const isExpired = alert.status === "EXPIRED";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3",
        !isActive && "opacity-60"
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Direction icon */}
        {alert.condition === "ABOVE" ? (
          <TrendingUp
            className={cn(
              "h-4 w-4 shrink-0",
              isActive ? "text-green-500" : "text-green-500/50"
            )}
          />
        ) : (
          <TrendingDown
            className={cn(
              "h-4 w-4 shrink-0",
              isActive ? "text-red-500" : "text-red-500/50"
            )}
          />
        )}

        <div className="min-w-0">
          {/* Symbol + target */}
          <p className="text-sm font-medium truncate">
            {alert.symbol}{" "}
            <span className="text-muted-foreground">
              {alert.condition === "ABOVE" ? ">" : "<"} {alert.targetPrice}
            </span>
          </p>

          {/* Status line */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isActive && alert.expiresAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTimeRemaining(alert.expiresAt)}
              </span>
            )}
            {isActive && alert.lastSeenPrice != null && (
              <span>
                {t("priceAlerts.lastSeen")}: {alert.lastSeenPrice}
              </span>
            )}
            {isTriggered && alert.triggeredAt && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <AlertTriangle className="h-3 w-3" />
                {t("priceAlerts.triggered")} {formatDate(alert.triggeredAt)}
              </span>
            )}
            {isExpired && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Clock className="h-3 w-3" />
                {t("priceAlerts.expired")}
              </span>
            )}
            {alert.status === "CANCELLED" && (
              <span>{t("priceAlerts.cancelledStatus")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0">
        {isActive ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onCancel(alert.id)}
            title={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onDelete(alert.id)}
            title={t("common.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
