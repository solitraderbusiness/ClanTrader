import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { trackEvent } from "@/services/referral.service";

const ALLOWED_CLIENT_TYPES = new Set(["LINK_COPIED", "LINK_SHARED"]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type } = body;

  if (!type || !ALLOWED_CLIENT_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  trackEvent(type, session.user.id);

  return NextResponse.json({ ok: true });
}
