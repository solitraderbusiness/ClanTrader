import { db } from "@/lib/db";
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
