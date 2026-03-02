import { NextResponse } from "next/server";
import { eaCalendarEventsSchema } from "@/lib/validators";
import { authenticateByApiKey } from "@/services/ea.service";
import {
  syncCalendarEvents,
  checkSyncRateLimit,
} from "@/services/event.service";

function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function POST(request: Request) {
  try {
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const account = await authenticateByApiKey(apiKey);
    if (!account) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const allowed = await checkSyncRateLimit(account.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limited — max 1 sync per 5 minutes" },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = eaCalendarEventsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const result = await syncCalendarEvents(parsed.data.events, "MT5_CALENDAR");

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to sync calendar events";
    console.error("[ea-calendar-events]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
