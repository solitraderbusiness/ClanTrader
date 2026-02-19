import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireClanMembership, MessageServiceError } from "@/services/message.service";
import { updateTopic, archiveTopic } from "@/services/topic.service";
import { updateTopicSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clanId: string; topicId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId, topicId } = await params;
    const membership = await requireClanMembership(session.user.id, clanId);

    if (!["LEADER", "CO_LEADER"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only leaders and co-leaders can update topics" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateTopicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const topic = await updateTopic(topicId, clanId, parsed.data);
    return NextResponse.json({ topic });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Update topic error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clanId: string; topicId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId, topicId } = await params;
    const membership = await requireClanMembership(session.user.id, clanId);

    if (!["LEADER", "CO_LEADER"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only leaders and co-leaders can archive topics" },
        { status: 403 }
      );
    }

    await archiveTopic(topicId, clanId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Archive topic error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
