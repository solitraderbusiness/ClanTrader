import { NextResponse } from "next/server";
import { eaActionResultSchema } from "@/lib/validators";
import { authenticateByApiKey } from "@/services/ea.service";
import { reportActionResult, EaActionError } from "@/services/ea-action.service";

function extractApiKey(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionId: string }> },
) {
  try {
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const account = await authenticateByApiKey(apiKey);
    if (!account) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const { actionId } = await params;
    const body = await request.json();
    const parsed = eaActionResultSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const result = await reportActionResult(
      actionId,
      account.id,
      parsed.data.success,
      parsed.data.errorMessage,
    );

    return NextResponse.json({
      ok: true,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof EaActionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to report action result";
    console.error("[ea-action-result]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
