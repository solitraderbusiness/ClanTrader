import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireClanMembership, MessageServiceError } from "@/services/message.service";
import { getTradeById } from "@/services/trade.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clanId: string; tradeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId, tradeId } = await params;
    await requireClanMembership(session.user.id, clanId);

    const trade = await getTradeById(tradeId);

    if (trade.clanId !== clanId) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    return NextResponse.json({ trade });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get trade error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
