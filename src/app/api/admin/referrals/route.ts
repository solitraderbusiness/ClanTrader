import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getAdminReferralOverview,
  getTopReferrers,
  getDailyStats,
} from "@/services/referral.service";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [overview, topReferrers, dailyStats] = await Promise.all([
    getAdminReferralOverview(),
    getTopReferrers(20),
    getDailyStats(thirtyDaysAgo, new Date()),
  ]);

  return NextResponse.json({ overview, topReferrers, dailyStats });
}
