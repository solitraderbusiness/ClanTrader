import { db } from "@/lib/db";
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

  return {
    posts: processedPosts,
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
