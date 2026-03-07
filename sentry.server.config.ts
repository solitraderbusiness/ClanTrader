import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Fire-and-forget Telegram notification
      notifyTelegram(event).catch(() => {});
      return event;
    },
  });
}

async function notifyTelegram(event: Sentry.ErrorEvent) {
  const { sendTelegramError } = await import("@/lib/telegram");

  const exception = event.exception?.values?.[0];
  const title = exception?.type || "Unknown Error";
  const message = exception?.value || "";
  const frames = exception?.stacktrace?.frames?.slice(-8) ?? [];
  const stack = frames
    .reverse()
    .map((f) => `  at ${f.function || "?"} (${f.filename}:${f.lineno})`)
    .join("\n");

  const details = `${title}: ${message}\n\n${stack}`;

  await sendTelegramError(title, details, {
    url: event.request?.url,
    user: event.user?.email || String(event.user?.id ?? ""),
  });
}
