import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateMemberRoleSchema } from "@/lib/validators";
import {
  updateMemberRole,
  removeMember,
  leaveClan,
  ClanServiceError,
} from "@/services/clan.service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clanId: string; userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId, userId: targetUserId } = await params;
    const body = await request.json();
    const parsed = updateMemberRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const member = await updateMemberRole(
      clanId,
      targetUserId,
      parsed.data.role,
      session.user.id
    );
    return NextResponse.json(member);
  } catch (error) {
    if (error instanceof ClanServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Update member role error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clanId: string; userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId, userId: targetUserId } = await params;

    // If the user is removing themselves, it's a leave
    if (targetUserId === session.user.id) {
      await leaveClan(clanId, session.user.id);
    } else {
      await removeMember(clanId, targetUserId, session.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ClanServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Remove member error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
