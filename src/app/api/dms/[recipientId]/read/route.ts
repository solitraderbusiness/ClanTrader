import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getOrCreateConversation,
  markConversationRead,
  DmServiceError,
} from "@/services/dm.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientId } = await params;
    const conversation = await getOrCreateConversation(
      session.user.id,
      recipientId
    );

    await markConversationRead(conversation.id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DmServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Mark read error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
