import { NextResponse } from "next/server";
import { eaHeartbeatSchema } from "@/lib/validators";
import { processHeartbeat } from "@/services/ea.service";

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
    const parsed = eaHeartbeatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const result = await processHeartbeat(apiKey, parsed.data);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Heartbeat failed";
    if (message === "Invalid API key") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message.startsWith("Rate limited")) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    console.error("[heartbeat]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
