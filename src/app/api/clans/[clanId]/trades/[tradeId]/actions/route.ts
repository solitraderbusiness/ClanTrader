import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { tradeActionSchema } from "@/lib/validators";
import { executeTradeAction, getTradeEvents } from "@/services/trade-action.service";
import { MessageServiceError } from "@/services/message.service";
import type { TradeActionKey } from "@/lib/trade-action-constants";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clanId: string; tradeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId, tradeId } = await params;
    const body = await request.json();
    const parsed = tradeActionSchema.safeParse({ ...body, clanId, tradeId });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await executeTradeAction(
      tradeId,
      clanId,
      session.user.id,
      parsed.data.actionType as TradeActionKey,
      parsed.data.newValue,
      parsed.data.note
    );

    return NextResponse.json({
      event: result.event,
      message: result.systemMessage
        ? {
            id: result.systemMessage.id,
            content: result.systemMessage.content,
            type: result.systemMessage.type,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Trade action error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

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
    const events = await getTradeEvents(tradeId, clanId);

    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Get trade events error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
