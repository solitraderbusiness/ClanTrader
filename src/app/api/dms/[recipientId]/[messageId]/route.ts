import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editDirectMessageSchema } from "@/lib/validators";
import {
  editDirectMessage,
  deleteDirectMessage,
  DmServiceError,
} from "@/services/dm.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ recipientId: string; messageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId } = await params;
    const body = await request.json();
    const parsed = editDirectMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const message = await editDirectMessage(
      messageId,
      session.user.id,
      parsed.data.content
    );

    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof DmServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Edit DM error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ recipientId: string; messageId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId } = await params;
    await deleteDirectMessage(messageId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof DmServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Delete DM error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
