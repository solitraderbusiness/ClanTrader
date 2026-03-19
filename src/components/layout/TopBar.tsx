"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Menu, UserPlus, Wifi, WifiOff, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserMenu } from "./UserMenu";
import { useSidebarStore } from "@/stores/sidebar-store";
import { InviteFriendDialog } from "@/components/shared/InviteFriendDialog";
import { LanguageSwitch } from "@/components/shared/LanguageSwitch";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AlertPanel } from "@/components/notifications/AlertPanel";

type MtStatus = "online" | "idle" | "offline";

function MtStatusIndicator() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [status, setStatus] = useState<MtStatus | null>(null);
  const [hasAccounts, setHasAccounts] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/users/me/mt-status");
        if (res.ok && !cancelled) {
          const json = await res.json();
          setHasAccounts(json.hasAccounts);
          setStatus(json.status ?? "offline");
        }
      } catch {
        // Silently fail
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 15_000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.user]);

  if (!hasAccounts) return null;

  const isConnected = status === "online";
  const isIdle = status === "idle";

  return (
    <Link
      href="/settings/mt-accounts"
      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
    >
      <span className="relative flex h-2 w-2">
        {isConnected && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            isConnected ? "bg-green-500" : isIdle ? "bg-yellow-500" : "bg-red-500"
          }`}
        />
      </span>
      {isConnected ? (
        <Wifi className="h-3 w-3 text-green-500" />
      ) : (
        <WifiOff className={`h-3 w-3 ${isIdle ? "text-yellow-500" : "text-red-500"}`} />
      )}
      <span
        className={`hidden sm:inline font-medium ${
          isConnected
            ? "text-green-600 dark:text-green-400"
            : isIdle
              ? "text-yellow-600 dark:text-yellow-400"
              : "text-red-600 dark:text-red-400"
        }`}
      >
        {isConnected
          ? t("mt.connected")
          : isIdle
            ? t("mt.idle")
            : t("mt.disconnected")}
      </span>
    </Link>
  );
}

function AlertBellButton() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [alertPanelOpen, setAlertPanelOpen] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/price-alerts/active-count");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setActiveCount(data.count ?? 0);
        }
      } catch {
        // silent
      }
    }

    poll();
    intervalRef.current = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.user]);

  // Refresh count when panel closes
  useEffect(() => {
    if (alertPanelOpen) return; // only refresh on close
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/price-alerts/active-count");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setActiveCount(data.count ?? 0);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [alertPanelOpen]);

  if (!session?.user) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setAlertPanelOpen(true)}
        title={t("priceAlerts.title")}
      >
        <Crosshair className="h-4 w-4" />
        {activeCount > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
            {activeCount > 99 ? "99+" : activeCount}
          </span>
        )}
      </Button>
      <AlertPanel open={alertPanelOpen} onOpenChange={setAlertPanelOpen} />
    </>
  );
}

export function TopBar() {
  const { t } = useTranslation();
  const { open } = useSidebarStore();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={open}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t("nav.toggleSidebar")}</span>
        </Button>
        <MtStatusIndicator />
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setInviteOpen(true)}
          title={t("nav.inviteFriend")}
        >
          <UserPlus className="h-4 w-4" />
        </Button>
        <AlertBellButton />
        <NotificationBell />
        <div className="hidden sm:flex sm:items-center sm:gap-1">
          <LanguageSwitch />
          <ThemeToggle />
        </div>
        <UserMenu />
      </div>

      <InviteFriendDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </header>
  );
}
