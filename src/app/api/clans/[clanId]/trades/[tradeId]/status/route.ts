import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireClanMembership, MessageServiceError } from "@/services/message.service";
import { updateTradeStatus } from "@/services/trade.service";
import { updateTradeStatusSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clanId: string; tradeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId, tradeId } = await params;
    await requireClanMembership(session.user.id, clanId);

    const body = await request.json();
    const parsed = updateTradeStatusSchema.safeParse({
      ...body,
      tradeId,
      clanId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const result = await updateTradeStatus(
      tradeId,
      clanId,
      session.user.id,
      parsed.data.status,
      parsed.data.note
    );

    return NextResponse.json({
      trade: result.trade,
      history: result.history,
    });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Update trade status error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
