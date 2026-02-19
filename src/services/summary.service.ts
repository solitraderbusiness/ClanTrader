import { db } from "@/lib/db";

interface SummaryResult {
  totalMessages: number;
  totalTradeCards: number;
  instruments: Record<string, number>;
  directions: Record<string, number>;
  tradeStatuses: Record<string, number>;
  topTags: Record<string, number>;
  timeRange: { from: Date; to: Date };
}

export async function generateTopicSummary(
  clanId: string,
  topicId: string,
  userId: string,
  options: { hours?: number; cardCount?: number } = {}
) {
  const now = new Date();
  const hoursBack = options.hours || 24;
  const from = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

  // Get messages in the time range
  const messages = await db.message.findMany({
    where: {
      clanId,
      topicId,
      createdAt: { gte: from },
    },
    include: {
      tradeCard: {
        include: { trade: true },
      },
    },
    orderBy: { createdAt: "desc" },
    ...(options.cardCount ? { take: options.cardCount } : {}),
  });

  // Build stats
  const instruments: Record<string, number> = {};
  const directions: Record<string, number> = {};
  const tradeStatuses: Record<string, number> = {};
  const topTags: Record<string, number> = {};
  let totalTradeCards = 0;

  for (const msg of messages) {
    if (msg.tradeCard) {
      totalTradeCards++;
      const inst = msg.tradeCard.instrument;
      instruments[inst] = (instruments[inst] || 0) + 1;

      const dir = msg.tradeCard.direction;
      directions[dir] = (directions[dir] || 0) + 1;

      if (msg.tradeCard.trade) {
        const status = msg.tradeCard.trade.status;
        tradeStatuses[status] = (tradeStatuses[status] || 0) + 1;
      }

      for (const tag of msg.tradeCard.tags) {
        topTags[tag] = (topTags[tag] || 0) + 1;
      }
    }
  }

  const summary: SummaryResult = {
    totalMessages: messages.length,
    totalTradeCards,
    instruments,
    directions,
    tradeStatuses,
    topTags,
    timeRange: { from, to: now },
  };

  // Generate text content
  const lines: string[] = [];
  lines.push(`--- Summary (last ${hoursBack}h) ---`);
  lines.push(`Messages: ${summary.totalMessages} | Trade Cards: ${summary.totalTradeCards}`);

  if (Object.keys(instruments).length > 0) {
    const sorted = Object.entries(instruments).sort(([, a], [, b]) => b - a);
    lines.push(`Top instruments: ${sorted.map(([k, v]) => `${k}(${v})`).join(", ")}`);
  }

  if (Object.keys(directions).length > 0) {
    lines.push(
      `Directions: ${Object.entries(directions).map(([k, v]) => `${k}(${v})`).join(", ")}`
    );
  }

  if (Object.keys(tradeStatuses).length > 0) {
    lines.push(
      `Trade statuses: ${Object.entries(tradeStatuses).map(([k, v]) => `${k}(${v})`).join(", ")}`
    );
  }

  if (Object.keys(topTags).length > 0) {
    const sorted = Object.entries(topTags).sort(([, a], [, b]) => b - a).slice(0, 5);
    lines.push(`Top tags: ${sorted.map(([k, v]) => `#${k}(${v})`).join(", ")}`);
  }

  const content = lines.join("\n");

  // Save as SYSTEM_SUMMARY message
  const summaryMessage = await db.message.create({
    data: {
      clanId,
      topicId,
      userId,
      content,
      type: "SYSTEM_SUMMARY",
    },
    include: {
      user: { select: { id: true, name: true, avatar: true, role: true } },
      replyTo: {
        select: {
          id: true,
          content: true,
          user: { select: { id: true, name: true } },
        },
      },
      tradeCard: {
        include: {
          trade: {
            select: { id: true, status: true, userId: true },
          },
        },
      },
    },
  });

  return { summary, message: summaryMessage };
}
