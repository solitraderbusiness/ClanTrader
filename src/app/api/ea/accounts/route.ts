import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserMtAccounts } from "@/services/ea.service";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await rateLimit(`ea:accounts:${getClientIp(request)}`, "AUTHENTICATED");
    if (limited) return limited;

    const accounts = await getUserMtAccounts(session.user.id);

    return NextResponse.json({ accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
