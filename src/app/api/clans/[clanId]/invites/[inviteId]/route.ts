import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteInvite, InviteServiceError } from "@/services/invite.service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clanId: string; inviteId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inviteId } = await params;
    await deleteInvite(inviteId, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InviteServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Delete invite error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
