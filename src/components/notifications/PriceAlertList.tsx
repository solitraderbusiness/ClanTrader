"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Plus, Trash2, X, TrendingUp, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

import { toast } from "sonner";
import { PriceAlertModal } from "./PriceAlertModal";

interface PriceAlertItem {
  id: string;
  symbol: string;
  condition: "ABOVE" | "BELOW";
  targetPrice: number;
  sourceGroup: string | null;
  status: "ACTIVE" | "TRIGGERED" | "CANCELLED";
  triggeredAt: string | null;
  lastSeenPrice: number | null;
  createdAt: string;
}

export function PriceAlertList() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

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

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

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
  const triggered = alerts.filter((a) => a.status === "TRIGGERED");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{t("priceAlerts.title")}</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="me-1.5 h-4 w-4" />
          {t("priceAlerts.newAlert")}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border py-8 text-sm text-muted-foreground">
          <Bell className="mb-2 h-8 w-8 opacity-30" />
          <p>{t("priceAlerts.empty")}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setModalOpen(true)}
          >
            {t("priceAlerts.createFirst")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active alerts */}
          {active.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">
                {t("priceAlerts.active")} ({active.length})
              </h3>
              <div className="divide-y rounded-lg border">
                {active.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {a.condition === "ABOVE" ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {a.symbol}{" "}
                          <span className="text-muted-foreground">
                            {a.condition === "ABOVE" ? ">" : "<"} {a.targetPrice}
                          </span>
                        </p>
                        {a.lastSeenPrice && (
                          <p className="text-xs text-muted-foreground">
                            {t("priceAlerts.lastSeen")}: {a.lastSeenPrice}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCancel(a.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Triggered alerts */}
          {triggered.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">
                {t("priceAlerts.triggered")} ({triggered.length})
              </h3>
              <div className="divide-y rounded-lg border opacity-75">
                {triggered.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {a.condition === "ABOVE" ? (
                        <TrendingUp className="h-4 w-4 text-green-500/50" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500/50" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {a.symbol}{" "}
                          <span>
                            {a.condition === "ABOVE" ? ">" : "<"} {a.targetPrice}
                          </span>
                        </p>
                        {a.triggeredAt && (
                          <p className="text-xs text-muted-foreground">
                            {t("priceAlerts.triggeredAt")}: {new Date(a.triggeredAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(a.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <PriceAlertModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onCreated={fetchAlerts}
      />
    </div>
  );
}
