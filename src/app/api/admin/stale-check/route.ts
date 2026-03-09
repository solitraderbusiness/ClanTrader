import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateTrackingStatus, checkRankingEligibility } from "@/services/live-risk.service";

/**
 * POST /api/admin/stale-check
 *
 * Updates tracking status for all active MT accounts and adjusts
 * ranking eligibility for traders with stale/tracking-lost accounts.
 *
 * Intended to be called by a cron job every 60 seconds.
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Allow admin or internal cron
    const isAdmin = session.user.role === "ADMIN";
    const isCron = request.headers.get("x-cron-secret") === process.env.CRON_SECRET;
    if (!isAdmin && !isCron) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update tracking status for all active accounts
    const accounts = await db.mtAccount.findMany({
      where: { isActive: true },
      select: { id: true, userId: true },
    });

    let staleCount = 0;
    let lostCount = 0;

    for (const acct of accounts) {
      const status = await updateTrackingStatus(acct.id);
      if (status === "STALE") staleCount++;
      if (status === "TRACKING_LOST") lostCount++;
    }

    // Update ranking status for affected users
    const uniqueUsers = [...new Set(accounts.map((a) => a.userId))];
    let provisionalCount = 0;
    let unrankedCount = 0;

    for (const userId of uniqueUsers) {
      const rankingStatus = await checkRankingEligibility(userId);

      if (rankingStatus !== "RANKED") {
        // Update all statements for this user
        await db.traderStatement.updateMany({
          where: { userId },
          data: { rankingStatus },
        });

        if (rankingStatus === "PROVISIONAL") provisionalCount++;
        if (rankingStatus === "UNRANKED") unrankedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      accounts: accounts.length,
      stale: staleCount,
      trackingLost: lostCount,
      provisional: provisionalCount,
      unranked: unrankedCount,
    });
  } catch (error) {
    console.error("Stale check error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
