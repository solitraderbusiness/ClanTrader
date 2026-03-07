export async function register() {
  if (process.env.NODE_ENV === "test") return;
  const { validateEnv } = await import("@/lib/env");
  validateEnv();

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    await import("../sentry.server.config");
  }
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | undefined> },
  context: { routerKind: string; routePath: string; routeType: string }
) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, request, context);
}
