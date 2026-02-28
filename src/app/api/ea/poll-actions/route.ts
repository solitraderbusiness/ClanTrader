import { NextResponse } from "next/server";
import { authenticateByApiKey } from "@/services/ea.service";
import { fetchPendingActionsForAccount } from "@/services/ea-action.service";

function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function GET(request: Request) {
  try {
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const account = await authenticateByApiKey(apiKey);
    if (!account) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const pendingActions = await fetchPendingActionsForAccount(account.id);

    return NextResponse.json({ pendingActions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll failed";
    console.error("[poll-actions]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
