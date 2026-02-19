import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireClanMembership, MessageServiceError } from "@/services/message.service";
import { getTrades } from "@/services/trade.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;
    const { searchParams } = new URL(request.url);

    await requireClanMembership(session.user.id, clanId);

    const filters = {
      status: searchParams.get("status") || undefined,
      instrument: searchParams.get("instrument") || undefined,
      direction: searchParams.get("direction") || undefined,
      userId: searchParams.get("userId") || undefined,
      cursor: searchParams.get("cursor") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    };

    const result = await getTrades(clanId, filters);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get trades error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
