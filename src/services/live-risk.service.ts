import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getDisplayPrice } from "@/services/price-pool.service";
import type { LiveOpenRisk, EffectiveRankView } from "@/types/trader-statement";

const FALLBACK_PV: Record<string, number> = {
  UKBRENT: 10, UKOIL: 10, BRENT: 10, USOIL: 10, XTIUSD: 10,
  XAUUSD: 100, GOLD: 100, XAGUSD: 5000,
  EURUSD: 100000, GBPUSD: 100000, USDJPY: 100000,
  US30: 1, USTEC: 1, NAS100: 1, BTCUSD: 1,
};

function estimatePointValue(symbol: string, openPrice: number, lots: number, lastProfit: number | null, currentPrice: number): number {
  // Try to derive from last known MT data
  if (lastProfit && lots > 0) {
    const move = Math.abs(currentPrice - openPrice);
    if (move > 0.0001) {
      const derived = Math.abs(lastProfit / (lots * move));
      const key = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const fb = FALLBACK_PV[key] ?? 1;
      if (derived > fb * 0.01 && derived < fb * 100) return derived;
    }
  }
  const key = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  for (const [k, v] of Object.entries(FALLBACK_PV)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return FALLBACK_PV[key] ?? 1;
}

const LIVE_RISK_CACHE_TTL = 15; // seconds — matches half heartbeat interval

/**
 * Compute the Live Open Risk overlay for a trader in a clan.
 * Shows open official signal-qualified trades and their floating risk.
 */
export async function getLiveOpenRisk(
  userId: string,
  clanId: string
): Promise<LiveOpenRisk> {
  const cacheKey = `live-risk:${userId}:${clanId}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* continue without cache */ }

  // Get open official signal-qualified trades
  const openTrades = await db.trade.findMany({
    where: {
      userId,
      clanId,
      status: { in: ["PENDING", "OPEN"] },
      officialSignalQualified: true,
    },
    include: {
      tradeCard: {
        select: { direction: true, instrument: true, entry: true },
      },
      mtTradeMatches: {
        where: { isOpen: true },
        take: 1,
        select: { profit: true, commission: true, swap: true, openPrice: true, lots: true, symbol: true, mtAccountId: true },
      },
    },
  });

  // Build a map of stale account IDs for fallback logic
  const staleAccountIds = new Set(
    (await db.mtAccount.findMany({
      where: { userId, isActive: true, trackingStatus: { in: ["STALE", "TRACKING_LOST"] } },
      select: { id: true },
    })).map((a) => a.id)
  );

  let totalFloatingPnl = 0;
  let totalFloatingR = 0;
  let biggestLoserR = 0;
  let unprotectedCount = 0;
  let isEstimated = false;

  for (const trade of openTrades) {
    const mt = trade.mtTradeMatches[0];
    const entry = trade.officialEntryPrice ?? 0;
    const riskAbs = trade.officialInitialRiskAbs ?? 0;
    const riskMoney = trade.officialInitialRiskMoney;
    const direction = trade.tradeCard?.direction;

    // Floating PnL from MT (or price pool fallback for stale accounts)
    if (mt) {
      let pnl = (mt.profit ?? 0) + (mt.commission ?? 0) + (mt.swap ?? 0);

      // Price pool fallback: if this trade's account is stale, try to estimate P/L
      if (mt.mtAccountId && staleAccountIds.has(mt.mtAccountId) && mt.openPrice > 0 && mt.lots > 0) {
        try {
          const resolved = await getDisplayPrice(mt.symbol);
          if (resolved.price !== null && resolved.status !== "no_price" && resolved.status !== "market_closed") {
            const dir = direction === "LONG" ? 1 : direction === "SHORT" ? -1 : 0;
            if (dir !== 0) {
              const pv = estimatePointValue(mt.symbol, mt.openPrice, mt.lots, mt.profit, resolved.price);
              pnl = dir * (resolved.price - mt.openPrice) * mt.lots * pv + (mt.commission ?? 0) + (mt.swap ?? 0);
              isEstimated = true;
            }
          }
        } catch {
          // Price pool unavailable — use last known MT value
        }
      }

      totalFloatingPnl += pnl;

      // Floating R: prefer money-based (most accurate for cross-currency)
      let floatingR = 0;
      if (riskMoney && riskMoney > 0) {
        floatingR = pnl / riskMoney;
      } else if (riskAbs > 0) {
        const initialRiskDirection = trade.officialInitialStopLoss && entry > 0
          ? Math.abs(entry - trade.officialInitialStopLoss)
          : riskAbs;
        if (initialRiskDirection > 0 && mt.openPrice > 0 && direction) {
          floatingR = pnl !== 0 && riskAbs > 0 ? pnl / (riskAbs * (mt.openPrice / entry || 1)) : 0;
        }
      }

      totalFloatingR += floatingR;
      if (floatingR < biggestLoserR) biggestLoserR = floatingR;
    }

    if (trade.riskStatus === "UNPROTECTED") unprotectedCount++;
  }

  // Get account-level equity data for drawdown
  const accounts = await db.mtAccount.findMany({
    where: { userId, isActive: true },
    select: {
      equity: true,
      balance: true,
      lastHeartbeat: true,
      peakEquity: true,
      maxDrawdownPct: true,
      trackingStatus: true,
    },
  });

  // Aggregate equity drawdown across accounts
  let currentDrawdownPct = 0;
  let maxDrawdownPct = 0;
  let staleWarning = false;
  let lastUpdate: string | null = null;

  for (const acct of accounts) {
    if (acct.peakEquity && acct.peakEquity > 0 && acct.equity > 0) {
      const dd = ((acct.peakEquity - acct.equity) / acct.peakEquity) * 100;
      if (dd > currentDrawdownPct) currentDrawdownPct = dd;
    }
    if (acct.maxDrawdownPct != null && acct.maxDrawdownPct > maxDrawdownPct) {
      maxDrawdownPct = acct.maxDrawdownPct;
    }
    if (acct.trackingStatus === "STALE" || acct.trackingStatus === "TRACKING_LOST") {
      staleWarning = true;
    }
    if (acct.lastHeartbeat) {
      const ts = acct.lastHeartbeat.toISOString();
      if (!lastUpdate || ts > lastUpdate) lastUpdate = ts;
    }
  }

  const result: LiveOpenRisk = {
    openOfficialCount: openTrades.length,
    liveFloatingPnl: Math.round(totalFloatingPnl * 100) / 100,
    liveFloatingR: Math.round(totalFloatingR * 100) / 100,
    currentEquityDrawdownPct: Math.round(currentDrawdownPct * 100) / 100,
    maxEquityDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
    biggestOpenLoserR: Math.round(biggestLoserR * 100) / 100,
    unprotectedCount,
    staleWarning,
    lastUpdate,
    isEstimated,
  };

  // Cache briefly
  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", LIVE_RISK_CACHE_TTL);
  } catch { /* ignore */ }

  return result;
}

/**
 * Compute effective rank R for a trader.
 *
 * effectiveRankR = closedOfficialR + sum(min(0, liveFloatingR))
 *
 * Open positive R contributes 0 (does not improve rank).
 * Open negative R penalizes rank immediately.
 */
export async function computeEffectiveRank(
  userId: string,
  clanId: string,
  closedOfficialR: number
): Promise<EffectiveRankView> {
  // Get open official signal-qualified trades with their live R
  const openTrades = await db.trade.findMany({
    where: {
      userId,
      clanId,
      status: { in: ["PENDING", "OPEN"] },
      officialSignalQualified: true,
    },
    include: {
      tradeCard: {
        select: { direction: true },
      },
      mtTradeMatches: {
        where: { isOpen: true },
        take: 1,
        select: { profit: true, commission: true, swap: true },
      },
    },
  });

  let openRiskPenalty = 0;

  for (const trade of openTrades) {
    const mt = trade.mtTradeMatches[0];
    if (!mt) continue;

    const riskMoney = trade.officialInitialRiskMoney;

    let floatingR = 0;
    const pnl = (mt.profit ?? 0) + (mt.commission ?? 0) + (mt.swap ?? 0);

    if (riskMoney && riskMoney > 0) {
      floatingR = pnl / riskMoney;
    }
    // If no riskMoney, we can't reliably compute floating R for penalty
    // This is a safe fallback — we skip penalty rather than guess

    // Only negative R penalizes (min(0, floatingR))
    if (floatingR < 0) {
      openRiskPenalty += floatingR;
    }
  }

  openRiskPenalty = Math.round(openRiskPenalty * 100) / 100;
  const effectiveRankR = Math.round((closedOfficialR + openRiskPenalty) * 100) / 100;

  return {
    closedOfficialR: Math.round(closedOfficialR * 100) / 100,
    openRiskPenalty,
    effectiveRankR,
  };
}

/**
 * Update equity drawdown tracking on MtAccount during heartbeat.
 * Tracks peak equity and max drawdown percentage.
 */
export async function updateEquityDrawdown(
  accountId: string,
  currentEquity: number
): Promise<void> {
  if (currentEquity <= 0) return;

  const account = await db.mtAccount.findUnique({
    where: { id: accountId },
    select: { peakEquity: true, maxDrawdownPct: true },
  });

  if (!account) return;

  const peakEquity = Math.max(account.peakEquity ?? currentEquity, currentEquity);
  const currentDrawdownPct = peakEquity > 0
    ? ((peakEquity - currentEquity) / peakEquity) * 100
    : 0;
  const maxDrawdownPct = Math.max(account.maxDrawdownPct ?? 0, currentDrawdownPct);
  const maxDrawdownMoney = peakEquity - currentEquity > 0
    ? Math.round((peakEquity - currentEquity) * 100) / 100
    : 0;

  await db.mtAccount.update({
    where: { id: accountId },
    data: {
      peakEquity: Math.round(peakEquity * 100) / 100,
      maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
      maxDrawdownMoney,
    },
  });
}

/**
 * Update tracking status for an MT account based on heartbeat freshness.
 * Called from a periodic job or heartbeat processing.
 */
export async function updateTrackingStatus(accountId: string): Promise<string> {
  const account = await db.mtAccount.findUnique({
    where: { id: accountId },
    select: { lastHeartbeat: true, isActive: true, trackingStatus: true },
  });

  if (!account || !account.isActive) return "TRACKING_LOST";

  if (!account.lastHeartbeat) {
    if (account.trackingStatus !== "TRACKING_LOST") {
      await db.mtAccount.update({
        where: { id: accountId },
        data: { trackingStatus: "TRACKING_LOST" },
      });
    }
    return "TRACKING_LOST";
  }

  const diffMs = Date.now() - account.lastHeartbeat.getTime();
  let newStatus: string;

  if (diffMs < 60_000) {
    newStatus = "ACTIVE";
  } else if (diffMs < 120_000) {
    newStatus = "STALE";
  } else {
    newStatus = "TRACKING_LOST";
  }

  if (newStatus !== account.trackingStatus) {
    await db.mtAccount.update({
      where: { id: accountId },
      data: { trackingStatus: newStatus },
    });
  }

  return newStatus;
}

/**
 * Check if a user has any stale/tracking-lost accounts with open official trades.
 * Used to determine if ranking should be PROVISIONAL or UNRANKED.
 */
export async function checkRankingEligibility(userId: string): Promise<"RANKED" | "PROVISIONAL" | "UNRANKED"> {
  const accounts = await db.mtAccount.findMany({
    where: { userId, isActive: true },
    select: { id: true, trackingStatus: true, lastHeartbeat: true },
  });

  // Check for stale accounts with open official trades
  for (const acct of accounts) {
    if (acct.trackingStatus === "TRACKING_LOST") {
      // Check if this account has open official trades
      const openCount = await db.trade.count({
        where: {
          officialSignalQualified: true,
          status: { in: ["PENDING", "OPEN"] },
          mtTradeMatches: { some: { mtAccountId: acct.id, isOpen: true } },
        },
      });
      if (openCount > 0) return "UNRANKED";
    }

    if (acct.trackingStatus === "STALE") {
      const diffMs = acct.lastHeartbeat
        ? Date.now() - acct.lastHeartbeat.getTime()
        : Infinity;

      if (diffMs > 120_000) {
        const openCount = await db.trade.count({
          where: {
            officialSignalQualified: true,
            status: { in: ["PENDING", "OPEN"] },
            mtTradeMatches: { some: { mtAccountId: acct.id, isOpen: true } },
          },
        });
        if (openCount > 0) return "PROVISIONAL";
      }
    }
  }

  return "RANKED";
}
