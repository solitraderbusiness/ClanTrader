import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getMessages,
  getPinnedMessages,
  requireClanMembership,
  MessageServiceError,
} from "@/services/message.service";

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
    const cursor = searchParams.get("cursor") || undefined;
    const pinned = searchParams.get("pinned") === "true";

    await requireClanMembership(session.user.id, clanId);

    if (pinned) {
      const pinnedMessages = await getPinnedMessages(clanId);
      return NextResponse.json({ messages: pinnedMessages });
    }

    const result = await getMessages(clanId, { cursor });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
