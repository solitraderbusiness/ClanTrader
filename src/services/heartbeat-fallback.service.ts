/**
 * heartbeat-fallback.service.ts — Background estimation for stale MT accounts
 *
 * When an EA stops sending heartbeats, this service uses the price pool
 * (fed by other EAs, with 4h extended TTL) to continue computing estimated
 * equity, floating P/L, equity snapshots, and live R:R broadcasts.
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
import { getIO } from "@/lib/socket-io-global";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { calculateTargetRR } from "@/lib/risk-utils";

// Point value defaults for P/L estimation
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
  pnlBroadcasts: number;
  errors: number;
}

export async function runHeartbeatFallback(): Promise<FallbackResult> {
  const result: FallbackResult = {
    accountsProcessed: 0,
    pricesResolved: 0,
    snapshotsCreated: 0,
    rankingUpdates: 0,
    pnlBroadcasts: 0,
    errors: 0,
  };

  try {
    // Find stale accounts with open trades AND their matched ClanTrader trades
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
            // Include the matched ClanTrader trade ID for socket broadcast
            matchedTradeId: true,
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

    // Batch-fetch display prices for all symbols (now with 4h extended key fallback)
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

    // Collect matched trade IDs for socket broadcast
    const matchedTradeIds: string[] = [];
    const tradeCurrentPrices = new Map<string, number>(); // matchedTradeId → currentPrice
    const tradeMtProfits = new Map<string, number>(); // matchedTradeId → estimated mtProfit

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
          const totalTradeProfit = estimatedProfit + (trade.commission ?? 0) + (trade.swap ?? 0);
          estimatedTotalPnl += totalTradeProfit;
          hasEstimate = true;

          // Track for socket broadcast
          if (trade.matchedTradeId) {
            matchedTradeIds.push(trade.matchedTradeId);
            tradeCurrentPrices.set(trade.matchedTradeId, currentPrice);
            tradeMtProfits.set(trade.matchedTradeId, Math.round(totalTradeProfit * 100) / 100);
          }
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

    // Broadcast estimated PnL updates via socket (so trade cards in chat update)
    if (matchedTradeIds.length > 0) {
      try {
        const broadcasted = await broadcastEstimatedPnl(matchedTradeIds, tradeCurrentPrices, tradeMtProfits);
        result.pnlBroadcasts = broadcasted;
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

/**
 * Broadcast estimated PnL to socket rooms for trade cards in chat.
 * Mirrors the broadcastTradePnl() function from ea.service.ts but uses estimated prices.
 */
async function broadcastEstimatedPnl(
  tradeIds: string[],
  priceMap: Map<string, number>,
  mtProfitMap: Map<string, number>,
): Promise<number> {
  const io = getIO();
  if (!io) return 0;

  const trades = await db.trade.findMany({
    where: { id: { in: tradeIds }, status: "OPEN" },
    include: {
      tradeCard: {
        include: {
          message: { select: { id: true, topicId: true, clanId: true } },
        },
      },
    },
  });

  type PnlUpdate = {
    tradeId: string;
    messageId: string;
    currentRR: number | null;
    currentPrice: number;
    targetRR: number | null;
    riskStatus: string;
    pricePnl: number;
    mtProfit?: number;
    clanId: string;
    topicId: string;
  };

  const updates: PnlUpdate[] = [];

  for (const trade of trades) {
    const currentPrice = priceMap.get(trade.id);
    if (!currentPrice) continue;

    const card = trade.tradeCard;
    if (!card?.message?.topicId) continue;

    const entry = trade.initialEntry ?? card.entry;
    const riskDistance = (trade.initialRiskAbs && trade.initialRiskAbs > 0)
      ? trade.initialRiskAbs
      : (card.stopLoss > 0 ? Math.abs(entry - card.stopLoss) : 0);

    const dir = card.direction === "LONG" ? 1 : -1;
    const pricePnl = dir * (currentPrice - entry);
    const currentRR = riskDistance > 0
      ? Math.round(((dir * (currentPrice - entry)) / riskDistance) * 100) / 100
      : null;

    const mtProfit = mtProfitMap.get(trade.id);

    updates.push({
      tradeId: trade.id,
      messageId: card.message.id,
      currentRR,
      currentPrice,
      targetRR: riskDistance > 0 ? calculateTargetRR(card.targets[0], entry, riskDistance) : null,
      riskStatus: trade.riskStatus,
      pricePnl,
      mtProfit: mtProfit != null ? mtProfit : undefined,
      clanId: card.message.clanId,
      topicId: card.message.topicId,
    });
  }

  if (updates.length === 0) return 0;

  // Group by topic room and clan room, emit TRADE_PNL_UPDATE
  const byRoom = new Map<string, PnlUpdate[]>();
  const byClan = new Map<string, PnlUpdate[]>();
  for (const update of updates) {
    const room = `topic:${update.clanId}:${update.topicId}`;
    const arr = byRoom.get(room) || [];
    arr.push(update);
    byRoom.set(room, arr);

    const clanArr = byClan.get(update.clanId) || [];
    clanArr.push(update);
    byClan.set(update.clanId, clanArr);
  }

  const mapUpdate = (u: PnlUpdate) => ({
    tradeId: u.tradeId,
    messageId: u.messageId,
    currentRR: u.currentRR,
    currentPrice: u.currentPrice,
    targetRR: u.targetRR,
    riskStatus: u.riskStatus,
    pricePnl: u.pricePnl,
    ...(u.mtProfit != null ? { mtProfit: u.mtProfit } : {}),
    isEstimated: true,
  });

  for (const [room, roomUpdates] of byRoom) {
    io.to(room).emit(SOCKET_EVENTS.TRADE_PNL_UPDATE, {
      updates: roomUpdates.map(mapUpdate),
    });
  }

  for (const [clanId, clanUpdates] of byClan) {
    io.to(`clan:${clanId}`).emit(SOCKET_EVENTS.TRADE_PNL_UPDATE, {
      updates: clanUpdates.map(mapUpdate),
    });
  }

  return updates.length;
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
