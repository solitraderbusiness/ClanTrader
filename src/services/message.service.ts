import { db } from "@/lib/db";
import { MESSAGES_PER_PAGE, MAX_PINNED_MESSAGES } from "@/lib/chat-constants";

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
  content: string
) {
  return db.message.create({
    data: { clanId, userId, content },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });
}

export async function getMessages(
  clanId: string,
  options: { cursor?: string; limit?: number } = {}
) {
  const limit = Math.min(options.limit || MESSAGES_PER_PAGE, 100);

  const messages = await db.message.findMany({
    where: { clanId },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
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

export async function getPinnedMessages(clanId: string) {
  return db.message.findMany({
    where: { clanId, isPinned: true },
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
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
    where: { clanId, isPinned: true },
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
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
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
    include: {
      user: { select: { id: true, name: true, avatar: true } },
    },
  });
}
