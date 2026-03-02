"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Calendar, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface TradingEvent {
  id: string;
  title: string;
  description: string | null;
  country: string | null;
  currency: string | null;
  instrument: string | null;
  impact: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  startTime: string;
  endTime: string | null;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  source: string | null;
}

type ImpactFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";

const impactColors: Record<string, string> = {
  HIGH: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
  MEDIUM:
    "border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  LOW: "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400",
  NONE: "border-gray-400 bg-gray-400/10 text-gray-500 dark:text-gray-400",
};

const impactDot: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-green-500",
  NONE: "bg-gray-400",
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "";
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 1) return "<1m";
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
  }
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getDayGroup(
  dateStr: string,
  todayLabel: string,
  tomorrowLabel: string,
): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const eventDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  if (eventDay.getTime() === today.getTime()) return todayLabel;
  if (eventDay.getTime() === tomorrow.getTime()) return tomorrowLabel;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

interface EventsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventsSheet({ open, onOpenChange }: EventsSheetProps) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<TradingEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("ALL");
  const [currencyFilter, setCurrencyFilter] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;

    async function fetchEvents() {
      setLoading(true);
      try {
        const res = await fetch("/api/events?limit=100");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [open]);

  // Live countdown timer
  useEffect(() => {
    if (!open || events.length === 0) return;

    const nearestMs = Math.min(
      ...events.map((e) => new Date(e.startTime).getTime() - Date.now()),
    );
    const interval = nearestMs < 3600_000 ? 1_000 : 60_000;

    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [open, events]);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.currency) set.add(e.currency);
    }
    return Array.from(set).sort();
  }, [events]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (impactFilter !== "ALL" && e.impact !== impactFilter) return false;
      if (currencyFilter && e.currency !== currencyFilter) return false;
      return true;
    });
  }, [events, impactFilter, currencyFilter]);

  const grouped = useMemo(() => {
    const groups: { label: string; events: TradingEvent[] }[] = [];
    let currentLabel = "";
    for (const event of filtered) {
      const label = getDayGroup(
        event.startTime,
        t("events.today"),
        t("events.tomorrow"),
      );
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, events: [] });
      }
      groups[groups.length - 1].events.push(event);
    }
    return groups;
  }, [filtered, t]);

  const handleCurrencyToggle = useCallback((cur: string) => {
    setCurrencyFilter((prev) => (prev === cur ? null : cur));
  }, []);

  const impactTabs: ImpactFilter[] = ["ALL", "HIGH", "MEDIUM", "LOW"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("events.title")}</SheetTitle>
        </SheetHeader>

        {/* Impact filter tabs */}
        <div className="mt-4 flex gap-1">
          {impactTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setImpactFilter(tab)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                impactFilter === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab === "ALL"
                ? t("events.all")
                : t(`events.${tab.toLowerCase()}`)}
            </button>
          ))}
        </div>

        {/* Currency chips */}
        {currencies.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {currencies.map((cur) => (
              <button
                key={cur}
                onClick={() => handleCurrencyToggle(cur)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                  currencyFilter === cur
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        )}

        <div
          className="mt-3 space-y-1 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 200px)" }}
        >
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <EmptyState
              icon={Calendar}
              title={t("events.empty")}
              description={t("events.emptyDesc")}
            />
          )}

          {grouped.map((group) => (
            <div key={group.label}>
              <div className="sticky top-0 z-10 bg-background py-1.5">
                <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              </div>
              <div className="space-y-2">
                {group.events.map((event) => {
                  const ms = new Date(event.startTime).getTime() - now;
                  const isPast = ms <= 0;

                  return (
                    <div key={event.id} className="rounded-lg border p-3">
                      <div className="mb-1 flex items-start gap-2">
                        <span
                          className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${impactDot[event.impact] || impactDot.NONE}`}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-medium leading-tight">
                            {event.title}
                          </span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {event.currency && (
                              <Badge
                                variant="secondary"
                                className="text-[10px]"
                              >
                                {event.currency}
                              </Badge>
                            )}
                            {!isPast && (
                              <span>
                                {t("events.in")} {formatCountdown(ms)}
                              </span>
                            )}
                            {isPast && (
                              <span className="text-green-600 dark:text-green-400">
                                {t("events.startingNow")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] ${impactColors[event.impact] || ""}`}
                        >
                          {event.impact}
                        </Badge>
                      </div>

                      {/* Actual / Forecast / Previous row */}
                      {(event.actual ||
                        event.forecast ||
                        event.previous) && (
                        <div className="mt-1.5 flex flex-wrap gap-3 text-[11px]">
                          {event.actual && (
                            <span>
                              <span className="text-muted-foreground">
                                {t("events.actual")}:{" "}
                              </span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                {event.actual}
                              </span>
                            </span>
                          )}
                          {event.forecast && (
                            <span>
                              <span className="text-muted-foreground">
                                {t("events.forecast")}:{" "}
                              </span>
                              <span className="font-medium">
                                {event.forecast}
                              </span>
                            </span>
                          )}
                          {event.previous && (
                            <span>
                              <span className="text-muted-foreground">
                                {t("events.previous")}:{" "}
                              </span>
                              <span>{event.previous}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {event.description && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {event.description}
                        </p>
                      )}

                      <div className="mt-1 text-[10px] text-muted-foreground/60">
                        {new Date(event.startTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {event.country && ` · ${event.country}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
