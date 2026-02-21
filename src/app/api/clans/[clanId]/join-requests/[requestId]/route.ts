import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reviewJoinRequestSchema } from "@/lib/validators";
import {
  reviewJoinRequest,
  JoinRequestServiceError,
} from "@/services/join-request.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clanId: string; requestId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await params;
    const body = await request.json();
    const parsed = reviewJoinRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const result = await reviewJoinRequest(
      requestId,
      session.user.id,
      parsed.data.action,
      parsed.data.rejectReason
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof JoinRequestServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Review join request error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
