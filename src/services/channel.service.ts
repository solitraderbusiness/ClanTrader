import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { CHANNEL_POSTS_PER_PAGE } from "@/lib/clan-constants";
import type {
  CreateChannelPostInput,
  UpdateChannelPostInput,
} from "@/lib/validators";

export class ChannelServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "ChannelServiceError";
  }
}

export async function createPost(
  clanId: string,
  userId: string,
  data: CreateChannelPostInput
) {
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId } },
  });

  if (!membership || !["LEADER", "CO_LEADER"].includes(membership.role)) {
    throw new ChannelServiceError(
      "Only leaders and co-leaders can create posts",
      "FORBIDDEN",
      403
    );
  }

  return db.channelPost.create({
    data: {
      clanId,
      authorId: userId,
      title: data.title,
      content: data.content,
      images: data.images || [],
      isPremium: data.isPremium || false,
    },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
  });
}

export async function getPost(postId: string) {
  const post = await db.channelPost.findUnique({
    where: { id: postId },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      clan: { select: { id: true, name: true, avatar: true } },
    },
  });

  if (!post) {
    throw new ChannelServiceError("Post not found", "NOT_FOUND", 404);
  }

  // Increment view count (fire and forget)
  db.channelPost
    .update({
      where: { id: postId },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => {});

  return post;
}

export async function updatePost(
  postId: string,
  userId: string,
  data: UpdateChannelPostInput
) {
  const post = await db.channelPost.findUnique({
    where: { id: postId },
    select: { clanId: true, authorId: true },
  });

  if (!post) {
    throw new ChannelServiceError("Post not found", "NOT_FOUND", 404);
  }

  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId: post.clanId } },
  });

  // Only the author or LEADER can edit
  const isAuthor = post.authorId === userId;
  const isLeader = membership?.role === "LEADER";

  if (!isAuthor && !isLeader) {
    throw new ChannelServiceError(
      "Only the author or clan leader can edit this post",
      "FORBIDDEN",
      403
    );
  }

  return db.channelPost.update({
    where: { id: postId },
    data,
    include: {
      author: { select: { id: true, name: true, avatar: true } },
    },
  });
}

export async function deletePost(postId: string, userId: string) {
  const post = await db.channelPost.findUnique({
    where: { id: postId },
    select: { clanId: true, authorId: true },
  });

  if (!post) {
    throw new ChannelServiceError("Post not found", "NOT_FOUND", 404);
  }

  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId: post.clanId } },
  });

  const isAuthor = post.authorId === userId;
  const isLeader = membership?.role === "LEADER";

  if (!isAuthor && !isLeader) {
    throw new ChannelServiceError(
      "Only the author or clan leader can delete this post",
      "FORBIDDEN",
      403
    );
  }

  await db.channelPost.delete({ where: { id: postId } });
}

interface GetChannelPostsOptions {
  page?: number;
  userId?: string | null;
  isPro?: boolean;
}

export async function getChannelPosts(
  clanId: string,
  options: GetChannelPostsOptions = {}
) {
  const page = options.page || 1;
  const limit = CHANNEL_POSTS_PER_PAGE;
  const skip = (page - 1) * limit;

  // Check if user is a member of this clan
  let isMember = false;
  if (options.userId) {
    const membership = await db.clanMember.findUnique({
      where: { userId_clanId: { userId: options.userId, clanId } },
    });
    isMember = !!membership;
  }

  const canViewPremium = isMember || (options.isPro ?? false);

  const [posts, total] = await Promise.all([
    db.channelPost.findMany({
      where: { clanId },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        tradeCard: {
          select: {
            id: true, instrument: true, direction: true, entry: true, stopLoss: true, targets: true, timeframe: true, tags: true,
            trade: {
              select: {
                id: true,
                status: true,
                finalRR: true,
                netProfit: true,
                closePrice: true,
                initialEntry: true,
                initialRiskAbs: true,
                riskStatus: true,
                mtTradeMatches: {
                  where: { isOpen: true },
                  select: { symbol: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    db.channelPost.count({ where: { clanId } }),
  ]);

  // Apply premium gating: locked posts get truncated content, no images
  const processedPosts = posts.map((post) => {
    if (post.isPremium && !canViewPremium) {
      return {
        ...post,
        content:
          post.content.length > 150
            ? post.content.slice(0, 150) + "..."
            : post.content,
        images: [],
        locked: true,
      };
    }
    return { ...post, locked: false };
  });

  // Compute Live R:R for open trades from Redis-cached prices
  const openTrades = processedPosts.flatMap((p) => {
    const trade = p.tradeCard?.trade;
    if (!trade || trade.status !== "OPEN") return [];
    const symbol = trade.mtTradeMatches[0]?.symbol?.toUpperCase();
    if (!symbol) return [];
    return [{ tradeId: trade.id, symbol, trade, card: p.tradeCard! }];
  });

  const livePnlMap = new Map<string, { currentRR: number; currentPrice: number; targetRR: number | null }>();

  if (openTrades.length > 0) {
    try {
      const symbols = [...new Set(openTrades.map((t) => t.symbol))];
      const priceKeys = symbols.map((s) => `price:${s}`);
      const priceValues = await redis.mget(...priceKeys);
      const priceMap = new Map<string, number>();
      for (let i = 0; i < symbols.length; i++) {
        if (priceValues[i]) {
          try {
            const parsed = JSON.parse(priceValues[i]!) as { price: number };
            priceMap.set(symbols[i], parsed.price);
          } catch { /* skip */ }
        }
      }

      for (const { tradeId, symbol, trade, card } of openTrades) {
        const currentPrice = priceMap.get(symbol);
        if (!currentPrice) continue;
        const entry = trade.initialEntry ?? card.entry;
        const riskAbs =
          trade.initialRiskAbs && trade.initialRiskAbs > 0
            ? trade.initialRiskAbs
            : Math.abs(entry - card.stopLoss);
        if (riskAbs <= 0) continue;
        const dir = card.direction === "LONG" ? 1 : -1;
        const currentRR = Math.round((dir * (currentPrice - entry)) / riskAbs * 100) / 100;
        const tp = (card.targets as number[])[0];
        const targetRR = tp && tp > 0
          ? Math.round((Math.abs(tp - entry) / riskAbs) * 100) / 100
          : null;
        livePnlMap.set(tradeId, { currentRR, currentPrice, targetRR });
      }
    } catch {
      // Non-critical — Live R:R just won't show
    }
  }

  return {
    posts: processedPosts,
    livePnlMap: Object.fromEntries(livePnlMap),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

type Reactions = Record<string, string[]>;

export async function toggleReaction(
  postId: string,
  userId: string,
  emoji: string
) {
  const post = await db.channelPost.findUnique({
    where: { id: postId },
    select: { reactions: true },
  });

  if (!post) {
    throw new ChannelServiceError("Post not found", "NOT_FOUND", 404);
  }

  const reactions: Reactions = (post.reactions as Reactions) || {};
  const emojiReactions = reactions[emoji] || [];

  if (emojiReactions.includes(userId)) {
    // Remove reaction
    reactions[emoji] = emojiReactions.filter((id) => id !== userId);
    if (reactions[emoji].length === 0) {
      delete reactions[emoji];
    }
  } else {
    // Add reaction
    reactions[emoji] = [...emojiReactions, userId];
  }

  const updated = await db.channelPost.update({
    where: { id: postId },
    data: { reactions },
    select: { reactions: true },
  });

  return updated.reactions;
}

export async function addPostImages(postId: string, imageUrls: string[]) {
  return db.channelPost.update({
    where: { id: postId },
    data: { images: imageUrls },
  });
}
