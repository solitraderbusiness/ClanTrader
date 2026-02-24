import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { normalizeInstrument } from "@/services/signal-matcher.service";

const MIN_TRADES = 5;

interface StatementMetrics {
  totalNetProfit: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  totalTrades: number;
  winRate: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  tradingPeriodStart: string;
  tradingPeriodEnd: string;
  pairsTraded: string[];
  sharpeRatio: null;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function computeMetrics(
  trades: {
    profit: number | null;
    commission: number | null;
    swap: number | null;
    openTime: Date;
    closeTime: Date | null;
    symbol: string;
  }[]
): StatementMetrics {
  let grossProfit = 0;
  let grossLoss = 0;
  let winCount = 0;
  let earliestOpen: Date | null = null;
  let latestClose: Date | null = null;
  const symbolSet = new Set<string>();

  // For drawdown: build cumulative PnL curve
  const pnls: number[] = [];

  for (const t of trades) {
    const net = (t.profit ?? 0) + (t.commission ?? 0) + (t.swap ?? 0);
    pnls.push(net);

    if (net > 0) {
      grossProfit += net;
      winCount++;
    } else {
      grossLoss += Math.abs(net);
    }

    symbolSet.add(normalizeInstrument(t.symbol));

    if (!earliestOpen || t.openTime < earliestOpen) {
      earliestOpen = t.openTime;
    }
    const ct = t.closeTime;
    if (ct && (!latestClose || ct > latestClose)) {
      latestClose = ct;
    }
  }

  const totalNetProfit = grossProfit - grossLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
  const winRate = (winCount / trades.length) * 100;

  // Max drawdown from cumulative balance curve
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let peakAtMaxDrawdown = 0;

  for (const pnl of pnls) {
    cumulative += pnl;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      peakAtMaxDrawdown = peak;
    }
  }

  const maxDrawdownPercent =
    peakAtMaxDrawdown > 0 ? (maxDrawdown / peakAtMaxDrawdown) * 100 : 0;

  return {
    totalNetProfit: Math.round(totalNetProfit * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    totalTrades: trades.length,
    winRate: Math.round(winRate * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    maxDrawdownPercent: Math.round(maxDrawdownPercent * 100) / 100,
    tradingPeriodStart: earliestOpen ? formatDate(earliestOpen) : "",
    tradingPeriodEnd: latestClose ? formatDate(latestClose) : "",
    pairsTraded: Array.from(symbolSet).sort(),
    sharpeRatio: null,
  };
}

export async function generateStatementFromMtAccount(
  userId: string,
  accountId: string
) {
  // Get account info for the filename
  const account = await db.mtAccount.findUnique({
    where: { id: accountId },
    select: { platform: true, broker: true },
  });
  if (!account) return;

  // Query all closed trades for this account
  const closedTrades = await db.mtTrade.findMany({
    where: { mtAccountId: accountId, isOpen: false },
    select: {
      profit: true,
      commission: true,
      swap: true,
      openTime: true,
      closeTime: true,
      symbol: true,
    },
    orderBy: { closeTime: "asc" },
  });

  if (closedTrades.length < MIN_TRADES) return;

  const metrics = computeMetrics(closedTrades);

  // Upsert: find existing BROKER_VERIFIED statement for this specific account
  const existing = await db.tradingStatement.findFirst({
    where: { mtAccountId: accountId, verificationMethod: "BROKER_VERIFIED" },
  });

  if (existing) {
    await db.tradingStatement.update({
      where: { id: existing.id },
      data: {
        extractedMetrics: metrics as unknown as Prisma.InputJsonValue,
        verifiedAt: new Date(),
        originalFilename: `${account.platform} Live - ${account.broker}`,
      },
    });
  } else {
    await db.tradingStatement.create({
      data: {
        userId,
        mtAccountId: accountId,
        filePath: "auto-generated",
        originalFilename: `${account.platform} Live - ${account.broker}`,
        verificationStatus: "VERIFIED",
        verificationMethod: "BROKER_VERIFIED",
        extractedMetrics: metrics as unknown as Prisma.InputJsonValue,
        verifiedAt: new Date(),
      },
    });
  }
}
