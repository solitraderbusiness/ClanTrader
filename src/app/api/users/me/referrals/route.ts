import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getReferralStats } from "@/services/referral.service";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [stats, referredUsers] = await Promise.all([
    getReferralStats(session.user.id),
    db.user.findMany({
      where: { referredBy: session.user.id },
      select: {
        id: true,
        name: true,
        username: true,
        avatar: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ stats, referredUsers });
}
