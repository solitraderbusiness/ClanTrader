import { db } from "@/lib/db";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { audit } from "@/lib/audit";

interface ClanSettings {
  publicTags?: string[];
  autoPostEnabled?: boolean;
}

export async function maybeAutoPost(
  tradeCardId: string,
  clanId: string,
  userId: string
): Promise<boolean> {
  // Check feature flag
  const autoPostEnabled = await isFeatureEnabled("auto_post");
  if (!autoPostEnabled) return false;

  // Load clan settings
  const clan = await db.clan.findUnique({
    where: { id: clanId },
    select: { settings: true },
  });

  if (!clan) return false;

  const settings = (clan.settings as ClanSettings) || {};
  if (!settings.autoPostEnabled || !settings.publicTags?.length) return false;

  // Load trade card
  const tradeCard = await db.tradeCard.findUnique({
    where: { id: tradeCardId },
    select: { id: true, tags: true, instrument: true, direction: true, entry: true, stopLoss: true, targets: true, timeframe: true, note: true },
  });

  if (!tradeCard) return false;

  // Check if any tag matches publicTags
  const hasMatchingTag = tradeCard.tags.some((tag) =>
    settings.publicTags!.includes(tag.toLowerCase())
  );

  if (!hasMatchingTag) return false;

  // Check dedup
  const existing = await db.channelPost.findUnique({
    where: { tradeCardId },
  });

  if (existing) return false;

  // Create auto channel post with trade card data as content
  const content = JSON.stringify({
    instrument: tradeCard.instrument,
    direction: tradeCard.direction,
    entry: tradeCard.entry,
    stopLoss: tradeCard.stopLoss,
    targets: tradeCard.targets,
    timeframe: tradeCard.timeframe,
    note: tradeCard.note,
    tags: tradeCard.tags,
  });

  const post = await db.channelPost.create({
    data: {
      clanId,
      authorId: userId,
      content,
      tradeCardId,
      sourceType: "AUTO_TAG",
    },
  });

  audit("auto_post.create", "ChannelPost", post.id, userId, {
    tradeCardId,
    clanId,
  });

  return true;
}
