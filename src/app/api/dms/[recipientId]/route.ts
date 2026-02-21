import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendDirectMessageSchema } from "@/lib/validators";
import {
  getOrCreateConversation,
  sendDirectMessage,
  getConversationMessages,
  DmServiceError,
} from "@/services/dm.service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientId } = await params;
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") || undefined;

    const conversation = await getOrCreateConversation(
      session.user.id,
      recipientId
    );

    const result = await getConversationMessages(
      conversation.id,
      session.user.id,
      cursor
    );

    return NextResponse.json({
      conversationId: conversation.id,
      ...result,
    });
  } catch (error) {
    if (error instanceof DmServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get DM messages error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientId } = await params;
    const body = await request.json();
    const parsed = sendDirectMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const conversation = await getOrCreateConversation(
      session.user.id,
      recipientId
    );

    const message = await sendDirectMessage(
      conversation.id,
      session.user.id,
      parsed.data.content,
      parsed.data.replyToId
    );

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    if (error instanceof DmServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Send DM error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
