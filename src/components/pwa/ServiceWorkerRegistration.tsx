"use client";

import { useEffect } from "react";

/**
 * Registers the service worker and installs a global ChunkLoadError recovery handler.
 *
 * After `npm run build`, old cached HTML may reference chunk hashes that no longer exist.
 * When the browser tries to load them, Next.js throws a ChunkLoadError. This handler
 * detects that and force-reloads once (using sessionStorage flag to prevent infinite loops).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    // --- ChunkLoadError auto-recovery ---
    const RELOAD_KEY = "ct-chunk-reload";

    function handleChunkError(event: ErrorEvent) {
      const msg = event.message || "";
      const isChunkError =
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch dynamically imported module");

      if (!isChunkError) return;

      // Reload once to get fresh HTML with correct chunk references
      const lastReload = sessionStorage.getItem(RELOAD_KEY);
      const now = Date.now();
      // Only auto-reload if we haven't done so in the last 30 seconds (prevents loops)
      if (lastReload && now - parseInt(lastReload, 10) < 30_000) return;

      console.warn("[ChunkRecovery] Stale chunk detected, reloading...");
      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    }

    window.addEventListener("error", handleChunkError);

    // --- Orientation lock (works in PWA / Chrome Android, no-op elsewhere) ---
    try {
      const so = screen.orientation as { lock?: (o: string) => Promise<void> };
      so.lock?.("portrait")?.catch(() => {});
    } catch {
      // Safari throws synchronously — ignore
    }

    // --- Service Worker registration ---
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          // Check for SW updates every hour
          setInterval(
            () => {
              registration.update();
            },
            60 * 60 * 1000,
          );
        })
        .catch((error) => {
          console.error("SW registration failed:", error);
        });
    }

    return () => {
      window.removeEventListener("error", handleChunkError);
    };
  }, []);

  return null;
}
