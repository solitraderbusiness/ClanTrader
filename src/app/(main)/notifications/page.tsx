"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell, Check, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { NOTIFICATIONS_PER_PAGE } from "@/lib/notification-types";

interface NotificationItem {
  id: string;
  type: string;
  family: string;
  severity: "CRITICAL" | "IMPORTANT" | "UPDATE";
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  isRead: boolean;
  createdAt: string;
}

type TabFilter = "all" | "CRITICAL" | "IMPORTANT" | "UPDATE" | "unread";

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "CRITICAL":
      return <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />;
    case "IMPORTANT":
      return <Info className="h-4 w-4 shrink-0 text-amber-500" />;
    default:
      return <Info className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
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

export default function NotificationsPage() {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const loadingMoreRef = useRef(false);

  const fetchNotifications = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams({ limit: String(NOTIFICATIONS_PER_PAGE) });

      if (activeTab === "unread") {
        params.set("unread", "true");
      } else if (activeTab !== "all") {
        params.set("severity", activeTab);
      }

      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      if (cursor) {
        setNotifications((prev) => [...prev, ...data.items]);
      } else {
        setNotifications(data.items);
      }
      setNextCursor(data.nextCursor);
    },
    [activeTab]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/notifications?${new URLSearchParams({
        limit: String(NOTIFICATIONS_PER_PAGE),
        ...(activeTab === "unread" ? { unread: "true" } : activeTab !== "all" ? { severity: activeTab } : {}),
      })}`);
      if (cancelled || !res.ok) return;
      const data = await res.json();
      setNotifications(data.items);
      setNextCursor(data.nextCursor);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [activeTab]);

  const handleTabChange = (tab: TabFilter) => {
    setLoading(true);
    setNotifications([]);
    setNextCursor(null);
    setActiveTab(tab);
  };

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    await fetchNotifications(nextCursor);
    loadingMoreRef.current = false;
  }, [nextCursor, fetchNotifications]);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const markRead = useCallback(async (id: string) => {
    fetch(`/api/notifications/${id}`, { method: "PATCH" }).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: t("notifications.filterAll") },
    { key: "CRITICAL", label: t("notifications.filterCritical") },
    { key: "IMPORTANT", label: t("notifications.filterImportant") },
    { key: "UPDATE", label: t("notifications.filterUpdates") },
    { key: "unread", label: t("notifications.filterUnread") },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("notifications.title")}</h1>
        <Button variant="ghost" size="sm" onClick={markAllRead}>
          <Check className="me-1.5 h-4 w-4" />
          {t("notifications.markAllRead")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto border-b pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
          <Bell className="mb-3 h-10 w-10 opacity-30" />
          <p>{t("notifications.empty")}</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => markRead(n.id)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50",
                !n.isRead && "bg-muted/20"
              )}
            >
              <SeverityIcon severity={n.severity} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm",
                      !n.isRead ? "font-semibold" : "font-medium text-muted-foreground"
                    )}
                  >
                    {n.title}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(n.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
              </div>
              {!n.isRead && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Load more */}
      {nextCursor && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={loadMore}>
            {t("notifications.loadMore")}
          </Button>
        </div>
      )}

    </div>
  );
}
