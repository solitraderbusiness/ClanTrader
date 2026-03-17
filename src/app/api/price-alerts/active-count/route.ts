import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveAlertCount } from "@/services/price-alert.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await getActiveAlertCount(session.user.id);
  return NextResponse.json({ count });
}
