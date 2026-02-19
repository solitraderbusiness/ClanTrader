import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireClanMembership, MessageServiceError } from "@/services/message.service";
import { removeFromWatchlist } from "@/services/watchlist.service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clanId: string; instrument: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId, instrument } = await params;
    await requireClanMembership(session.user.id, clanId);

    await removeFromWatchlist(session.user.id, clanId, instrument);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Remove from watchlist error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
