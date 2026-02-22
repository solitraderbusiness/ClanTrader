import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReferrerDetail } from "@/services/referral.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId } = await params;
  const detail = await getReferrerDetail(userId);

  return NextResponse.json(detail);
}
