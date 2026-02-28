import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireClanMembership, MessageServiceError } from "@/services/message.service";
import { getClanWatchlistData, addToWatchlist } from "@/services/watchlist.service";
import { addWatchlistItemSchema } from "@/lib/validators";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;
    await requireClanMembership(session.user.id, clanId);

    const data = await getClanWatchlistData(session.user.id, clanId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get watchlist error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;
    await requireClanMembership(session.user.id, clanId);

    const body = await request.json();
    const parsed = addWatchlistItemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const item = await addToWatchlist(session.user.id, clanId, parsed.data.instrument);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Add to watchlist error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
