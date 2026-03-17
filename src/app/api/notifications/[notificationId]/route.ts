import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAsRead } from "@/services/notification.service";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notificationId } = await params;
  const updated = await markAsRead(notificationId, session.user.id);

  if (!updated) {
    return NextResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
