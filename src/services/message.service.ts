import { db } from "@/lib/db";
import { MESSAGES_PER_PAGE, MAX_PINNED_MESSAGES } from "@/lib/chat-constants";
import type { MessageType } from "@prisma/client";

export class MessageServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "MessageServiceError";
  }
}

const messageInclude = {
  user: { select: { id: true, name: true, username: true, avatar: true, role: true } },
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
        select: {
          id: true,
          status: true,
          userId: true,
          mtLinked: true,
          riskStatus: true,
          finalRR: true,
          netProfit: true,
          closePrice: true,
          initialRiskAbs: true,
          initialEntry: true,
          integrityStatus: true,
          statementEligible: true,
        },
      },
    },
  },
} as const;

export async function requireClanMembership(userId: string, clanId: string) {
  const membership = await db.clanMember.findUnique({
    where: { userId_clanId: { userId, clanId } },
  });
  if (!membership) {
    throw new MessageServiceError(
      "You must be a clan member to use chat",
      "NOT_MEMBER",
      403
    );
  }
  return membership;
}

export async function createMessage(
  clanId: string,
  userId: string,
  content: string,
  topicId: string,
  options?: { replyToId?: string; type?: MessageType; images?: string[] }
) {
  return db.message.create({
    data: {
      clanId,
      userId,
      content,
      topicId,
      type: options?.type || "TEXT",
      ...(options?.replyToId ? { replyToId: options.replyToId } : {}),
      ...(options?.images?.length ? { images: options.images } : {}),
    },
    include: messageInclude,
  });
}

export async function editMessage(
  messageId: string,
  clanId: string,
  userId: string,
  content: string
) {
  const message = await db.message.findUnique({
    where: { id: messageId },
  });

  if (!message || message.clanId !== clanId) {
    throw new MessageServiceError("Message not found", "NOT_FOUND", 404);
  }

  if (message.userId !== userId) {
    throw new MessageServiceError(
      "You can only edit your own messages",
      "FORBIDDEN",
      403
    );
  }

  return db.message.update({
    where: { id: messageId },
    data: { content, isEdited: true },
    include: messageInclude,
  });
}

export async function deleteMessage(
  messageId: string,
  clanId: string,
  userId: string
) {
  const message = await db.message.findUnique({
    where: { id: messageId },
  });

  if (!message || message.clanId !== clanId) {
    throw new MessageServiceError("Message not found", "NOT_FOUND", 404);
  }

  // Author can delete own, LEADER/CO_LEADER can delete any
  if (message.userId !== userId) {
    const membership = await requireClanMembership(userId, clanId);
    if (!["LEADER", "CO_LEADER"].includes(membership.role)) {
      throw new MessageServiceError(
        "You can only delete your own messages",
        "FORBIDDEN",
        403
      );
    }
  }

  await db.message.delete({ where: { id: messageId } });
  return message;
}

export async function toggleReaction(
  messageId: string,
  clanId: string,
  userId: string,
  emoji: string
) {
  const message = await db.message.findUnique({
    where: { id: messageId },
  });

  if (!message || message.clanId !== clanId) {
    throw new MessageServiceError("Message not found", "NOT_FOUND", 404);
  }

  const reactions = (message.reactions as Record<string, string[]>) || {};
  const current = reactions[emoji] || [];

  if (current.includes(userId)) {
    const next = current.filter((id) => id !== userId);
    if (next.length === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = next;
    }
  } else {
    reactions[emoji] = [...current, userId];
  }

  return db.message.update({
    where: { id: messageId },
    data: { reactions: reactions },
    include: messageInclude,
  });
}

export async function getMessages(
  clanId: string,
  topicId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const limit = Math.min(options.limit || MESSAGES_PER_PAGE, 100);

  const messages = await db.message.findMany({
    where: { clanId, topicId },
    include: messageInclude,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(options.cursor
      ? { cursor: { id: options.cursor }, skip: 1 }
      : {}),
  });

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  return {
    messages: messages.reverse(),
    hasMore,
    nextCursor: hasMore ? messages[0]?.id : null,
  };
}

export async function getPinnedMessages(clanId: string, topicId: string) {
  return db.message.findMany({
    where: { clanId, topicId, isPinned: true },
    include: messageInclude,
    orderBy: { createdAt: "desc" },
    take: MAX_PINNED_MESSAGES,
  });
}

export async function pinMessage(
  messageId: string,
  clanId: string,
  userId: string
) {
  const membership = await requireClanMembership(userId, clanId);

  if (!["LEADER", "CO_LEADER"].includes(membership.role)) {
    throw new MessageServiceError(
      "Only leaders and co-leaders can pin messages",
      "FORBIDDEN",
      403
    );
  }

  const message = await db.message.findUnique({
    where: { id: messageId },
  });

  if (!message || message.clanId !== clanId) {
    throw new MessageServiceError("Message not found", "NOT_FOUND", 404);
  }

  if (message.isPinned) {
    throw new MessageServiceError(
      "Message is already pinned",
      "ALREADY_PINNED",
      409
    );
  }

  const pinnedCount = await db.message.count({
    where: { clanId, topicId: message.topicId, isPinned: true },
  });

  if (pinnedCount >= MAX_PINNED_MESSAGES) {
    throw new MessageServiceError(
      `Maximum ${MAX_PINNED_MESSAGES} pinned messages allowed`,
      "PIN_LIMIT",
      400
    );
  }

  return db.message.update({
    where: { id: messageId },
    data: { isPinned: true },
    include: messageInclude,
  });
}

export async function unpinMessage(
  messageId: string,
  clanId: string,
  userId: string
) {
  const membership = await requireClanMembership(userId, clanId);

  if (!["LEADER", "CO_LEADER"].includes(membership.role)) {
    throw new MessageServiceError(
      "Only leaders and co-leaders can unpin messages",
      "FORBIDDEN",
      403
    );
  }

  const message = await db.message.findUnique({
    where: { id: messageId },
  });

  if (!message || message.clanId !== clanId) {
    throw new MessageServiceError("Message not found", "NOT_FOUND", 404);
  }

  return db.message.update({
    where: { id: messageId },
    data: { isPinned: false },
    include: messageInclude,
  });
}

export async function getClanMembers(clanId: string) {
  return db.clanMember.findMany({
    where: { clanId },
    select: {
      role: true,
      user: { select: { id: true, name: true, username: true, avatar: true, role: true } },
    },
  });
}
