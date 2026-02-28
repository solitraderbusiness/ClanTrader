/**
 * Client-side analytics tracking utility.
 * Fire-and-forget — never blocks UI.
 */
export function track(
  event: string,
  metadata?: Record<string, string>
): void {
  try {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, metadata }),
      keepalive: true,
    }).catch(() => {
      // Silent — analytics should never throw
    });
  } catch {
    // Silent
  }
}
