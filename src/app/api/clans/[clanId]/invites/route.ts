import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createInviteSchema } from "@/lib/validators";
import {
  createInvite,
  getClanInvites,
  InviteServiceError,
} from "@/services/invite.service";

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

    // Check permission
    const membership = await db.clanMember.findUnique({
      where: { userId_clanId: { userId: session.user.id, clanId } },
    });

    if (!membership || !["LEADER", "CO_LEADER"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const invites = await getClanInvites(clanId);
    return NextResponse.json(invites);
  } catch (error) {
    console.error("Get invites error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
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
    const body = await request.json();
    const parsed = createInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const invite = await createInvite(clanId, session.user.id, parsed.data);
    return NextResponse.json(invite, { status: 201 });
  } catch (error) {
    if (error instanceof InviteServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Create invite error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
