import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireClanMembership, MessageServiceError } from "@/services/message.service";
import { db } from "@/lib/db";

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

    const trade = await db.trade.findUnique({
      where: { id: tradeId },
      select: {
        id: true,
        clanId: true,
        integrityStatus: true,
        integrityReason: true,
        integrityDetails: true,
        statementEligible: true,
        resolutionSource: true,
        entryFilledAt: true,
        lastEvaluatedAt: true,
      },
    });

    if (!trade || trade.clanId !== clanId) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    return NextResponse.json({
      integrityStatus: trade.integrityStatus,
      integrityReason: trade.integrityReason,
      integrityDetails: trade.integrityDetails,
      statementEligible: trade.statementEligible,
      resolutionSource: trade.resolutionSource,
      entryFilledAt: trade.entryFilledAt,
      lastEvaluatedAt: trade.lastEvaluatedAt,
    });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get trade integrity error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
