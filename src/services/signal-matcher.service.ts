import { db } from "@/lib/db";
import type { MtTrade } from "@prisma/client";

/**
 * Normalize instrument symbol by stripping broker suffixes, separators, and prefixes.
 * e.g. EURUSDm → EURUSD, EUR/USD → EURUSD, #EURUSD → EURUSD
 */
export function normalizeInstrument(symbol: string): string {
  let s = symbol.toUpperCase().trim();
  // Strip common prefixes
  s = s.replace(/^[#.]/, "");
  // Strip common suffixes (micro/mini: m, c, l, ., pro, etc.)
  s = s.replace(/[._]?(micro|mini|pro|ecn|std|raw|m|c|i|f|s|l)$/i, "");
  // Remove separators
  s = s.replace(/[/\-_.]/g, "");
  return s;
}

/**
 * Map MT direction to ClanTrader trade direction
 */
export function mapDirection(mtDir: "BUY" | "SELL"): "LONG" | "SHORT" {
  return mtDir === "BUY" ? "LONG" : "SHORT";
}

/**
 * Get pip size for a given instrument
 */
function getPipSize(instrument: string): number {
  const norm = normalizeInstrument(instrument);
  // JPY pairs
  if (norm.includes("JPY")) return 0.01;
  // Gold / XAUUSD
  if (norm.includes("XAU") || norm === "GOLD") return 0.10;
  // Silver
  if (norm.includes("XAG") || norm === "SILVER") return 0.001;
  // Indices (rough)
  if (/^(US30|US500|NAS100|DAX|FTSE|SPX)/.test(norm)) return 1.0;
  // Default forex
  return 0.0001;
}

/**
 * Calculate pip distance between two prices
 */
export function pipDistance(instrument: string, price1: number, price2: number): number {
  const pipSize = getPipSize(instrument);
  return Math.abs(price1 - price2) / pipSize;
}

// Matching tolerances
const PRICE_TOLERANCE_PIPS = 5;
const TIME_WINDOW_MINUTES = 60;

/**
 * Match a closed MtTrade against existing Trade/TradeCard signals in the user's clans.
 * Returns true if a match was found and linked.
 */
export async function matchTradeToSignal(
  mtTrade: MtTrade,
  userId: string
): Promise<boolean> {
  // Only match closed trades
  if (mtTrade.isOpen) return false;

  // Get user's clan IDs
  const memberships = await db.clanMember.findMany({
    where: { userId },
    select: { clanId: true },
  });
  const clanIds = memberships.map((m) => m.clanId);
  if (clanIds.length === 0) return false;

  const normalizedSymbol = normalizeInstrument(mtTrade.symbol);
  const direction = mapDirection(mtTrade.direction);

  // Find unmatched trades in user's clans with matching instrument + direction
  const candidates = await db.trade.findMany({
    where: {
      clanId: { in: clanIds },
      userId,
      mtTradeMatches: { none: {} }, // no existing match
      tradeCard: {
        direction,
      },
    },
    include: {
      tradeCard: true,
    },
  });

  // Filter by instrument match
  const instrumentMatches = candidates.filter(
    (t) => normalizeInstrument(t.tradeCard.instrument) === normalizedSymbol
  );

  if (instrumentMatches.length === 0) return false;

  // Filter by price tolerance and time window
  const scored: { trade: (typeof instrumentMatches)[number]; score: number }[] = [];

  for (const trade of instrumentMatches) {
    const priceDist = pipDistance(mtTrade.symbol, mtTrade.openPrice, trade.tradeCard.entry);
    if (priceDist > PRICE_TOLERANCE_PIPS) continue;

    const tradeCreatedAt = trade.createdAt.getTime();
    const mtOpenTime = mtTrade.openTime.getTime();
    const timeDiffMinutes = Math.abs(tradeCreatedAt - mtOpenTime) / 60000;
    if (timeDiffMinutes > TIME_WINDOW_MINUTES) continue;

    // Score: 60% time proximity + 40% price proximity
    const timeScore = 1 - timeDiffMinutes / TIME_WINDOW_MINUTES;
    const priceScore = 1 - priceDist / PRICE_TOLERANCE_PIPS;
    const score = timeScore * 0.6 + priceScore * 0.4;

    scored.push({ trade, score });
  }

  if (scored.length === 0) return false;

  // Pick best match
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].trade;

  // Update Trade as verified and MT-linked
  await db.trade.update({
    where: { id: best.id },
    data: {
      integrityStatus: "VERIFIED",
      resolutionSource: "EA_VERIFIED",
      mtLinked: true,
    },
  });

  // Link MtTrade to Trade
  await db.mtTrade.update({
    where: { id: mtTrade.id },
    data: { matchedTradeId: best.id },
  });

  // Create TradeEvent
  await db.tradeEvent.create({
    data: {
      tradeId: best.id,
      actionType: "INTEGRITY_FLAG",
      actorId: userId,
      newValue: "EA_VERIFIED",
      note: `Matched to MT ${mtTrade.direction} ${mtTrade.symbol} ticket #${mtTrade.ticket}`,
    },
  });

  return true;
}
