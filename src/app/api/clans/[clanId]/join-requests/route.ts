import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createJoinRequestSchema } from "@/lib/validators";
import {
  createJoinRequest,
  getClanJoinRequests,
  JoinRequestServiceError,
} from "@/services/join-request.service";

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
    const parsed = createJoinRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const joinRequest = await createJoinRequest(
      clanId,
      session.user.id,
      parsed.data.message
    );

    return NextResponse.json(joinRequest, { status: 201 });
  } catch (error) {
    if (error instanceof JoinRequestServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Create join request error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

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
    const requests = await getClanJoinRequests(clanId, session.user.id);

    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof JoinRequestServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get join requests error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
