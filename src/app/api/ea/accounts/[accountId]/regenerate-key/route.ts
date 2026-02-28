import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { regenerateApiKey } from "@/services/ea.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accountId } = await params;
    const result = await regenerateApiKey(session.user.id, accountId);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to regenerate key";
    if (message === "Account not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
