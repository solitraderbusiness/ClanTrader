import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listNotifications, markAllAsRead } from "@/services/notification.service";
import type { NotificationSeverity } from "@/lib/notification-types";
import { NOTIFICATIONS_PER_PAGE } from "@/lib/notification-types";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const severity = url.searchParams.get("severity") as NotificationSeverity | null;
  const unreadOnly = url.searchParams.get("unread") === "true";
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? String(NOTIFICATIONS_PER_PAGE), 10),
    50
  );

  const result = await listNotifications({
    userId: session.user.id,
    severity: severity ?? undefined,
    unreadOnly,
    cursor,
    limit,
  });

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (body.action === "mark_all_read") {
    const count = await markAllAsRead(session.user.id);
    return NextResponse.json({ marked: count });
  }

  return NextResponse.json({ error: "Invalid action", code: "INVALID_ACTION" }, { status: 400 });
}
