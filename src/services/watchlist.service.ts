import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { MessageServiceError } from "@/services/message.service";

export async function getWatchlist(userId: string, clanId: string) {
  return db.watchlist.findMany({
    where: { userId, clanId },
    orderBy: { addedAt: "desc" },
  });
}

export async function addToWatchlist(
  userId: string,
  clanId: string,
  instrument: string
) {
  const existing = await db.watchlist.findUnique({
    where: {
      userId_clanId_instrument: { userId, clanId, instrument: instrument.toUpperCase() },
    },
  });

  if (existing) {
    throw new MessageServiceError(
      "Instrument is already in your watchlist",
      "ALREADY_EXISTS",
      409
    );
  }

  return db.watchlist.create({
    data: {
      userId,
      clanId,
      instrument: instrument.toUpperCase(),
    },
  });
}

export async function removeFromWatchlist(
  userId: string,
  clanId: string,
  instrument: string
) {
  const existing = await db.watchlist.findUnique({
    where: {
      userId_clanId_instrument: { userId, clanId, instrument: instrument.toUpperCase() },
    },
  });

  if (!existing) {
    throw new MessageServiceError(
      "Instrument not in your watchlist",
      "NOT_FOUND",
      404
    );
  }

  await db.watchlist.delete({ where: { id: existing.id } });
  return existing;
}

// ── TradingView-style clan watchlist data ──

export interface InstrumentRow {
  instrument: string;
  price: number | null;
  priceTs: number | null;
  trades: number;
  open: number;
  wins: number;
  losses: number;
  be: number;
  winRate: number;
  avgRR: number;
  longs: number;
  shorts: number;
  lastTradeAt: string | null;
  isStarred: boolean;
}

async function getInstrumentPrices(
  symbols: string[]
): Promise<Map<string, { price: number; ts: number }>> {
  const result = new Map<string, { price: number; ts: number }>();
  if (symbols.length === 0) return result;

  const keys = symbols.map((s) => `price:${s}`);
  const values = await redis.mget(...keys);

  for (let i = 0; i < symbols.length; i++) {
    const raw = values[i];
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { price: number; ts: number };
        result.set(symbols[i], parsed);
      } catch {
        // skip malformed entries
      }
    }
  }

  return result;
}

export async function getClanWatchlistData(
  userId: string,
  clanId: string
): Promise<{ instruments: InstrumentRow[]; starred: string[] }> {
  // 1. Get all non-UNVERIFIED trades in this clan
  const trades = await db.trade.findMany({
    where: { clanId, status: { not: "UNVERIFIED" } },
    select: {
      status: true,
      finalRR: true,
      createdAt: true,
      tradeCard: { select: { instrument: true, direction: true } },
    },
  });

  // 2. Aggregate per instrument
  const statsMap: Record<
    string,
    {
      trades: number;
      open: number;
      wins: number;
      losses: number;
      be: number;
      longs: number;
      shorts: number;
      rrSum: number;
      rrCount: number;
      lastTradeAt: Date;
    }
  > = {};

  for (const t of trades) {
    const inst = t.tradeCard?.instrument?.toUpperCase();
    if (!inst) continue;

    if (!statsMap[inst]) {
      statsMap[inst] = {
        trades: 0, open: 0, wins: 0, losses: 0, be: 0,
        longs: 0, shorts: 0, rrSum: 0, rrCount: 0,
        lastTradeAt: t.createdAt,
      };
    }

    const s = statsMap[inst];
    s.trades++;

    if (t.createdAt > s.lastTradeAt) s.lastTradeAt = t.createdAt;

    if (t.tradeCard?.direction === "LONG") s.longs++;
    else if (t.tradeCard?.direction === "SHORT") s.shorts++;

    switch (t.status) {
      case "PENDING":
      case "OPEN":
        s.open++;
        break;
      case "TP_HIT":
        s.wins++;
        break;
      case "SL_HIT":
        s.losses++;
        break;
      case "BE":
        s.be++;
        break;
      case "CLOSED":
        // Closed trades: positive finalRR = win, negative = loss
        if (t.finalRR !== null && t.finalRR > 0) s.wins++;
        else if (t.finalRR !== null && t.finalRR < 0) s.losses++;
        else s.be++;
        break;
    }

    if (t.finalRR !== null) {
      s.rrSum += t.finalRR;
      s.rrCount++;
    }
  }

  // 3. Get user's personal watchlist (starred items)
  const userWatchlist = await db.watchlist.findMany({
    where: { userId, clanId },
  });
  const starredSet = new Set(userWatchlist.map((w) => w.instrument));

  // 4. Collect all unique symbols
  const allSymbols = [
    ...new Set([...Object.keys(statsMap), ...starredSet]),
  ];

  // 5. Fetch cached prices from Redis
  const prices = await getInstrumentPrices(allSymbols);

  // 6. For instruments without cached price, get fallback from latest MtTrade closePrice
  const missingPriceSymbols = allSymbols.filter((s) => !prices.has(s));
  if (missingPriceSymbols.length > 0) {
    // Get clan member IDs for scoping MtTrade queries
    const members = await db.clanMember.findMany({
      where: { clanId },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);

    for (const sym of missingPriceSymbols) {
      const fallback = await db.mtTrade.findFirst({
        where: {
          symbol: sym,
          closePrice: { not: null },
          mtAccount: { userId: { in: memberIds } },
        },
        orderBy: { closeTime: "desc" },
        select: { closePrice: true, closeTime: true },
      });

      if (fallback?.closePrice && fallback.closeTime) {
        prices.set(sym, {
          price: fallback.closePrice,
          ts: fallback.closeTime.getTime(),
        });
      }
    }
  }

  // 7. Build result rows
  const instruments: InstrumentRow[] = allSymbols.map((inst) => {
    const s = statsMap[inst];
    const p = prices.get(inst);
    const closed = (s?.wins ?? 0) + (s?.losses ?? 0) + (s?.be ?? 0);

    return {
      instrument: inst,
      price: p?.price ?? null,
      priceTs: p?.ts ?? null,
      trades: s?.trades ?? 0,
      open: s?.open ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      be: s?.be ?? 0,
      winRate: closed > 0 ? Math.round(((s?.wins ?? 0) / closed) * 100) : 0,
      avgRR:
        s && s.rrCount > 0
          ? Math.round((s.rrSum / s.rrCount) * 100) / 100
          : 0,
      longs: s?.longs ?? 0,
      shorts: s?.shorts ?? 0,
      lastTradeAt: s?.lastTradeAt?.toISOString() ?? null,
      isStarred: starredSet.has(inst),
    };
  });

  // 8. Sort: starred first, then by trade count desc
  instruments.sort((a, b) => {
    if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
    return b.trades - a.trades;
  });

  return { instruments, starred: [...starredSet] };
}
