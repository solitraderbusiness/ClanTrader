"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Wifi, WifiOff, MonitorSmartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

type MtStatus = "online" | "idle" | "offline";

interface MtStatusData {
  hasAccounts: boolean;
  accountCount?: number;
  status?: MtStatus;
  lastHeartbeat?: string | null;
  broker?: string;
}

const POLL_INTERVAL = 15_000; // 15 seconds

export function MtConnectionBanner() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [data, setData] = useState<MtStatusData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/users/me/mt-status");
        if (res.ok && !cancelled) {
          const json = await res.json();
          setData(json);
        }
      } catch {
        // Silently fail
      }
    }

    // Initial fetch + interval
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [session?.user]);

  // Don't render for users without MT accounts or when dismissed
  if (!data?.hasAccounts || dismissed) return null;

  const status = data.status ?? "offline";
  const isConnected = status === "online";
  const isIdle = status === "idle";

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-1.5 text-xs transition-colors",
        isConnected
          ? "bg-green-500/10 text-green-700 dark:text-green-400"
          : isIdle
            ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
            : "bg-red-500/10 text-red-700 dark:text-red-400"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Animated status dot */}
        <span className="relative flex h-2 w-2">
          {isConnected && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              isConnected ? "bg-green-500" : isIdle ? "bg-yellow-500" : "bg-red-500"
            )}
          />
        </span>

        {/* Icon */}
        {isConnected ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}

        {/* Text */}
        <span className="font-medium">
          {isConnected
            ? t("mt.connected")
            : isIdle
              ? t("mt.idle")
              : t("mt.disconnected")}
        </span>

        {data.broker && (
          <span className="hidden sm:inline text-[10px] opacity-60">
            {data.broker}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Action link for disconnected state */}
        {!isConnected && (
          <Link
            href="/settings/mt-accounts"
            className="flex items-center gap-1 rounded-full bg-current/10 px-2 py-0.5 text-[10px] font-medium hover:bg-current/20 transition-colors"
          >
            <MonitorSmartphone className="h-2.5 w-2.5" />
            {t("mt.checkEa")}
          </Link>
        )}

        {/* Dismiss button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-full p-0.5 hover:bg-current/10 transition-colors"
        >
          <X className="h-3 w-3" />
          <span className="sr-only">{t("common.dismiss")}</span>
        </button>
      </div>
    </div>
  );
}
