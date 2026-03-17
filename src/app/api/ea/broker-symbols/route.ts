import { NextResponse } from "next/server";
import { eaBrokerSymbolsSchema } from "@/lib/validators";
import { authenticateByApiKey } from "@/services/ea.service";
import { storeBrokerSymbols } from "@/services/price-alert.service";

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

    const body = await request.json();
    const parsed = eaBrokerSymbolsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const count = await storeBrokerSymbols(account.broker, parsed.data.symbols);

    return NextResponse.json({ stored: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to store symbols";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
