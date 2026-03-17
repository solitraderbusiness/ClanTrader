"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Bell, Check, AlertTriangle, Info, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  MAX_UNREAD_DISPLAY,
  DROPDOWN_NOTIFICATION_COUNT,
} from "@/lib/notification-types";

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// Play alert sound using Web Audio API (no external files needed)
function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    // Second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.value = 1100;
    osc2.type = "sine";
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.6);
  } catch {
    // Audio not available (e.g. autoplay policy)
  }
}

// Types that should play a sound alert
const SOUND_TYPES = new Set([
  "price_alert_triggered",
  "risk_no_sl",
  "risk_drawdown",
  "trade_action_failed",
]);

function showNotificationToast(data: NotificationItem) {
  const withSound = SOUND_TYPES.has(data.type);
  if (withSound) playAlertSound();

  if (data.severity === "CRITICAL") {
    toast.error(data.title, { description: data.body, duration: 8000 });
  } else if (data.severity === "IMPORTANT") {
    toast.info(data.title, { description: data.body, duration: 6000 });
  }
}

export function NotificationBell() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const router = useRouter();
  const socketRef = useRef(getSocket());
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fetchedRef = useRef(false);
  const lastKnownCount = useRef(0);
  const seenIds = useRef(new Set<string>());

  // Fetch unread count on mount
  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/notifications/unread-count")
      .then((r) => r.json())
      .then((data) => {
        const count = data.count ?? 0;
        setUnreadCount(count);
        lastKnownCount.current = count;
      })
      .catch(() => {});
  }, [session?.user?.id]);

  // Listen for real-time notification events (Socket.io)
  useEffect(() => {
    const socket = socketRef.current;

    const handleNew = (data: NotificationItem) => {
      seenIds.current.add(data.id);
      setNotifications((prev) => [data, ...prev].slice(0, DROPDOWN_NOTIFICATION_COUNT));
      fetchedRef.current = false;
      showNotificationToast(data);
    };

    const handleCountUpdate = (data: { count: number }) => {
      setUnreadCount(data.count);
      lastKnownCount.current = data.count;
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, handleNew);
    socket.on(SOCKET_EVENTS.NOTIFICATION_COUNT_UPDATE, handleCountUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, handleNew);
      socket.off(SOCKET_EVENTS.NOTIFICATION_COUNT_UPDATE, handleCountUpdate);
    };
  }, []);

  // Polling fallback: check unread count every 30s
  // If count increased, fetch latest and show toast (catches missed Socket.io events)
  useEffect(() => {
    if (!session?.user?.id) return;

    const poll = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count");
        if (!res.ok) return;
        const data = await res.json();
        const newCount = data.count ?? 0;

        if (newCount > lastKnownCount.current) {
          // New notification(s) arrived — fetch the latest to show toast
          const listRes = await fetch(`/api/notifications?limit=1&unread=true`);
          if (listRes.ok) {
            const listData = await listRes.json();
            const latest = listData.items?.[0] as NotificationItem | undefined;
            if (latest && !seenIds.current.has(latest.id)) {
              seenIds.current.add(latest.id);
              setNotifications((prev) => [latest, ...prev].slice(0, DROPDOWN_NOTIFICATION_COUNT));
              fetchedRef.current = false;
              showNotificationToast(latest);
            }
          }
        }

        setUnreadCount(newCount);
        lastKnownCount.current = newCount;
      } catch {
        // silent
      }
    };

    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  // Fetch recent when dropdown opens
  const fetchRecent = useCallback(async () => {
    if (fetchedRef.current) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/notifications?limit=${DROPDOWN_NOTIFICATION_COUNT}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.items);
        fetchedRef.current = true;
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) fetchRecent();
    },
    [fetchRecent]
  );

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  // Click a notification
  const handleClick = useCallback(
    async (n: NotificationItem) => {
      if (!n.isRead) {
        fetch(`/api/notifications/${n.id}`, { method: "PATCH" }).catch(() => {});
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      if (n.ctaHref) {
        setOpen(false);
        router.push(n.ctaHref);
      }
    },
    [router]
  );

  if (!session?.user) return null;

  const displayCount = unreadCount > MAX_UNREAD_DISPLAY ? `${MAX_UNREAD_DISPLAY}+` : unreadCount;

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {displayCount}
            </span>
          )}
          <span className="sr-only">{t("notifications.title")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h3 className="text-sm font-semibold">{t("notifications.title")}</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check className="h-3 w-3" />
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-96 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-30" />
              {t("notifications.empty")}
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/50",
                  !n.isRead && "bg-muted/30"
                )}
              >
                <SeverityIcon severity={n.severity} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-sm",
                        !n.isRead ? "font-semibold" : "font-medium text-muted-foreground"
                      )}
                    >
                      {n.title}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                </div>
                {!n.isRead && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t">
            <button
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
              className="flex w-full items-center justify-center gap-1 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("notifications.seeAll")}
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
