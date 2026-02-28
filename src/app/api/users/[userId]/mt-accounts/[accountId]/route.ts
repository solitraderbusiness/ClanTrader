import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string; accountId: string }> }
) {
  try {
    const { userId, accountId } = await params;

    const account = await db.mtAccount.findFirst({
      where: { id: accountId, userId, isActive: true },
      select: {
        id: true,
        accountNumber: true,
        broker: true,
        platform: true,
        accountType: true,
        balance: true,
        equity: true,
        currency: true,
        lastHeartbeat: true,
        connectedAt: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const session = await auth();
    const isOwner = session?.user?.id === userId;

    // Fetch statement metrics for this specific account
    const statement = await db.tradingStatement.findFirst({
      where: { mtAccountId: accountId, verificationMethod: "BROKER_VERIFIED" },
      select: { extractedMetrics: true, verificationMethod: true },
    });

    // Fetch open trades
    const openTrades = await db.mtTrade.findMany({
      where: { mtAccountId: accountId, isOpen: true },
      select: {
        id: true,
        ticket: true,
        symbol: true,
        direction: true,
        lots: true,
        openPrice: true,
        openTime: true,
        stopLoss: true,
        takeProfit: true,
        profit: true,
        commission: true,
        swap: true,
      },
      orderBy: { openTime: "desc" },
    });

    // Fetch recent closed trades
    const recentTrades = await db.mtTrade.findMany({
      where: { mtAccountId: accountId, isOpen: false },
      select: {
        id: true,
        ticket: true,
        symbol: true,
        direction: true,
        lots: true,
        openPrice: true,
        closePrice: true,
        openTime: true,
        closeTime: true,
        profit: true,
        commission: true,
        swap: true,
      },
      orderBy: { closeTime: "desc" },
      take: 50,
    });

    return NextResponse.json({
      account: {
        ...account,
        accountNumber: isOwner
          ? account.accountNumber
          : Number(`${String(account.accountNumber).slice(-3)}`),
        accountNumberMasked: !isOwner,
        lastHeartbeat: account.lastHeartbeat?.toISOString() ?? null,
        connectedAt: account.connectedAt.toISOString(),
      },
      metrics: statement?.extractedMetrics ?? null,
      verificationMethod: statement?.verificationMethod ?? null,
      openTrades: openTrades.map((t) => ({
        ...t,
        ticket: Number(t.ticket),
        openTime: t.openTime.toISOString(),
      })),
      recentTrades: recentTrades.map((t) => ({
        ...t,
        ticket: Number(t.ticket),
        openTime: t.openTime.toISOString(),
        closeTime: t.closeTime?.toISOString() ?? null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
