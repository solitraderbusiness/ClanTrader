import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserMtAccounts } from "@/services/ea.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accounts = await getUserMtAccounts(session.user.id);

    return NextResponse.json({ accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
