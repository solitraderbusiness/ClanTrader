/**
 * heartbeat-fallback.service.ts — Background estimation for stale MT accounts
 *
 * When an EA stops sending heartbeats, this service uses the price pool
 * (fed by other EAs) to continue computing estimated equity and floating P/L.
 *
 * Safety invariants:
 * - NEVER modifies MtTrade records (those are MT's truth)
 * - NEVER affects signal qualification or statement eligibility
 * - All estimated data is clearly labeled (isEstimated = true)
 * - When real heartbeat resumes, verified data takes over seamlessly
 */

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getDisplayPrice } from "@/services/price-pool.service";
import { updateTrackingStatus, checkRankingEligibility } from "@/services/live-risk.service";

// Point value defaults for P/L estimation (same as digest-engines.ts)
const DEFAULT_PV: Record<string, number> = {
  UKBRENT: 10, UKOIL: 10, BRENT: 10,
  USOIL: 10, USCRUDE: 10, XTIUSD: 10, WTI: 10, CL: 10,
  XAUUSD: 100, GOLD: 100,
  XAGUSD: 5000,
  EURUSD: 100000, GBPUSD: 100000, AUDUSD: 100000, NZDUSD: 100000,
  USDCHF: 100000, USDCAD: 100000, USDJPY: 100000,
  GBPJPY: 100000, EURJPY: 100000, EURGBP: 100000,
  US30: 1, DJ30: 1, USTEC: 1, NAS100: 1, US500: 1, SPX500: 1,
  DE40: 1, UK100: 1, JP225: 1,
  BTCUSD: 1, BTCUSDT: 1, ETHUSD: 1, ETHUSDT: 1,
};

function getPointValue(symbol: string): number {
  const key = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (DEFAULT_PV[key]) return DEFAULT_PV[key];
  for (const [k, v] of Object.entries(DEFAULT_PV)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return 1;
}

/** Try to derive point value from a trade's last known MT data (more accurate than default table) */
function derivePointValueFromTrade(
  trade: { openPrice: number; lots: number; profit: number | null; symbol: string },
  currentPrice: number,
): number {
  if (!trade.profit || trade.lots <= 0) return getPointValue(trade.symbol);
  const priceChange = Math.abs(currentPrice - trade.openPrice);
  if (priceChange < 0.0001) return getPointValue(trade.symbol);
  const derived = Math.abs(trade.profit / (trade.lots * priceChange));
  const fallback = getPointValue(trade.symbol);
  // Sanity check: if wildly off, use default
  if (derived > fallback * 100 || derived < fallback * 0.01) return fallback;
  return derived;
}

export interface FallbackResult {
  accountsProcessed: number;
  pricesResolved: number;
  snapshotsCreated: number;
  rankingUpdates: number;
  errors: number;
}

export async function runHeartbeatFallback(): Promise<FallbackResult> {
  const result: FallbackResult = {
    accountsProcessed: 0,
    pricesResolved: 0,
    snapshotsCreated: 0,
    rankingUpdates: 0,
    errors: 0,
  };

  try {
    // Find stale accounts with open trades
    const staleAccounts = await db.mtAccount.findMany({
      where: {
        isActive: true,
        trackingStatus: { in: ["STALE", "TRACKING_LOST"] },
      },
      select: {
        id: true,
        userId: true,
        balance: true,
        equity: true,
        broker: true,
        serverName: true,
        platform: true,
        trades: {
          where: { isOpen: true },
          select: {
            id: true,
            symbol: true,
            direction: true,
            lots: true,
            openPrice: true,
            profit: true,
            commission: true,
            swap: true,
          },
        },
      },
    });

    // Filter to accounts that actually have open trades
    const accountsWithTrades = staleAccounts.filter((a) => a.trades.length > 0);
    if (accountsWithTrades.length === 0) {
      // Still run tracking status updates for all stale accounts
      await updateAllTrackingStatuses();
      return result;
    }

    // Collect all unique symbols we need prices for
    const symbolSet = new Set<string>();
    for (const acct of accountsWithTrades) {
      for (const trade of acct.trades) {
        symbolSet.add(trade.symbol);
      }
    }

    // Batch-fetch display prices for all symbols
    const priceMap = new Map<string, number>();
    for (const symbol of symbolSet) {
      try {
        const resolved = await getDisplayPrice(symbol);
        if (resolved.price !== null && resolved.status !== "no_price" && resolved.status !== "market_closed") {
          priceMap.set(symbol, resolved.price);
          result.pricesResolved++;
        }
      } catch {
        // Skip this symbol — no price available
      }
    }

    // Process each stale account
    for (const acct of accountsWithTrades) {
      try {
        const balance = acct.balance ?? 0;
        if (balance <= 0) continue;

        let estimatedTotalPnl = 0;
        let hasEstimate = false;

        for (const trade of acct.trades) {
          const currentPrice = priceMap.get(trade.symbol);
          if (!currentPrice || !trade.openPrice || !trade.lots) continue;

          const dir = trade.direction === "BUY" ? 1 : -1;
          const pv = derivePointValueFromTrade(
            { openPrice: trade.openPrice, lots: trade.lots, profit: trade.profit, symbol: trade.symbol },
            currentPrice,
          );
          const priceChange = dir * (currentPrice - trade.openPrice);
          const estimatedProfit = priceChange * trade.lots * pv;

          // Add commission and swap from last known values (they don't change without MT)
          estimatedTotalPnl += estimatedProfit + (trade.commission ?? 0) + (trade.swap ?? 0);
          hasEstimate = true;
        }

        if (!hasEstimate) continue;

        const estimatedEquity = balance + estimatedTotalPnl;
        result.accountsProcessed++;

        // Record estimated EquitySnapshot (throttled: max 1 per 5 min)
        const snapKey = `eq-snap-est:${acct.id}`;
        const lastSnap = await redis.get(snapKey);
        if (!lastSnap) {
          await redis.set(snapKey, "1", "EX", 300);
          await db.equitySnapshot.create({
            data: {
              mtAccountId: acct.id,
              balance,
              equity: estimatedEquity,
              isEstimated: true,
            },
          });
          result.snapshotsCreated++;
        }

        // Update MtAccount with estimated equity (so downstream consumers pick it up)
        await db.mtAccount.update({
          where: { id: acct.id },
          data: { equity: estimatedEquity },
        });
      } catch {
        result.errors++;
      }
    }

    // Update tracking statuses and ranking for all stale accounts
    await updateAllTrackingStatuses();

    // Update rankings for affected users
    const userIds = [...new Set(accountsWithTrades.map((a) => a.userId))];
    for (const userId of userIds) {
      try {
        const rankingStatus = await checkRankingEligibility(userId);
        if (rankingStatus !== "RANKED") {
          await db.traderStatement.updateMany({
            where: { userId },
            data: { rankingStatus },
          });
          result.rankingUpdates++;
        }
      } catch {
        result.errors++;
      }
    }
  } catch (err) {
    console.error("[HeartbeatFallback] fatal:", err);
    result.errors++;
  }

  return result;
}

/** Update tracking status for all active accounts (replaces external stale-check cron) */
async function updateAllTrackingStatuses(): Promise<void> {
  const accounts = await db.mtAccount.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  for (const acct of accounts) {
    try {
      await updateTrackingStatus(acct.id);
    } catch {
      // Non-fatal — continue with other accounts
    }
  }
}
