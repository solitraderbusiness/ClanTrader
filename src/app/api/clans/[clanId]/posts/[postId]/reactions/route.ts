import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reactionSchema } from "@/lib/validators";
import {
  toggleReaction,
  ChannelServiceError,
} from "@/services/channel.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clanId: string; postId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { postId } = await params;
    const body = await request.json();
    const parsed = reactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const reactions = await toggleReaction(
      postId,
      session.user.id,
      parsed.data.emoji
    );

    return NextResponse.json({ reactions });
  } catch (error) {
    if (error instanceof ChannelServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Toggle reaction error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
