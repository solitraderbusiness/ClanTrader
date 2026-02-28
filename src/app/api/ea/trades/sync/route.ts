import { NextResponse } from "next/server";
import { eaTradeSyncSchema } from "@/lib/validators";
import { syncTradeHistory } from "@/services/ea.service";

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

    const body = await request.json();
    const parsed = eaTradeSyncSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const result = await syncTradeHistory(apiKey, parsed.data.trades);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[trade-sync]", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    if (message === "Invalid API key") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
