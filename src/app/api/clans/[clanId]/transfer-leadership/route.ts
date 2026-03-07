import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { transferLeadershipSchema } from "@/lib/validators";
import {
  transferLeadership,
  ClanServiceError,
} from "@/services/clan.service";

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
    const body = await request.json();
    const parsed = transferLeadershipSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await transferLeadership(clanId, parsed.data.newLeaderUserId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ClanServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Transfer leadership error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
