import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireClanMembership, MessageServiceError } from "@/services/message.service";
import { createTopic, getTopics } from "@/services/topic.service";
import { createTopicSchema } from "@/lib/validators";

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

    const topics = await getTopics(clanId);
    return NextResponse.json({ topics });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get topics error:", error);
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
    const membership = await requireClanMembership(session.user.id, clanId);

    if (!["LEADER", "CO_LEADER"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only leaders and co-leaders can create topics" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createTopicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid data" },
        { status: 400 }
      );
    }

    const topic = await createTopic(
      clanId,
      session.user.id,
      parsed.data.name,
      parsed.data.description
    );

    return NextResponse.json({ topic }, { status: 201 });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Create topic error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
