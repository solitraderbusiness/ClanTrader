import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserTradedSymbols } from "@/services/price-alert.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbols = await getUserTradedSymbols(session.user.id);
  return NextResponse.json({ symbols });
}
