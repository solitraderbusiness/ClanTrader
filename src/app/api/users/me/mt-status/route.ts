import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Lightweight endpoint for the MT connection banner.
 * Returns the best connection status across all user's MT accounts.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ hasAccounts: false });
    }

    const accounts = await db.mtAccount.findMany({
      where: { userId: session.user.id, isActive: true },
      select: { id: true, lastHeartbeat: true, broker: true, accountNumber: true },
      orderBy: { lastHeartbeat: { sort: "desc", nulls: "last" } },
    });

    if (accounts.length === 0) {
      return NextResponse.json({ hasAccounts: false });
    }

    // Derive status from the most recently active account
    const best = accounts[0];
    const lastHeartbeat = best.lastHeartbeat?.toISOString() ?? null;

    let status: "online" | "idle" | "offline" = "offline";
    if (lastHeartbeat) {
      const diffSec = (Date.now() - new Date(lastHeartbeat).getTime()) / 1000;
      if (diffSec < 60) status = "online";       // missed ~1 heartbeat
      else if (diffSec < 120) status = "idle";    // missed 2-3 heartbeats
    }

    return NextResponse.json({
      hasAccounts: true,
      accountCount: accounts.length,
      status,
      lastHeartbeat,
      broker: best.broker,
    });
  } catch {
    return NextResponse.json({ hasAccounts: false }, { status: 500 });
  }
}
