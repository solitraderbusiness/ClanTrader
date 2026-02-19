import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireClanMembership, MessageServiceError } from "@/services/message.service";
import { generateTopicSummary } from "@/services/summary.service";
import { generateSummarySchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ clanId: string; topicId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId, topicId } = await params;
    await requireClanMembership(session.user.id, clanId);

    const body = await request.json().catch(() => ({}));
    const parsed = generateSummarySchema.safeParse(body);
    const options = parsed.success ? parsed.data : {};

    const result = await generateTopicSummary(clanId, topicId, session.user.id, options);

    return NextResponse.json({
      summary: result.summary,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof MessageServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Generate summary error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
