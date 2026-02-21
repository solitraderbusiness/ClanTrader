import { db } from "@/lib/db";

export class DmServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 400
  ) {
    super(message);
    this.name = "DmServiceError";
  }
}

function sortParticipants(userId1: string, userId2: string): [string, string] {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}

export async function getOrCreateConversation(userId1: string, userId2: string) {
  if (userId1 === userId2) {
    throw new DmServiceError("Cannot message yourself", "SELF_MESSAGE", 400);
  }

  const [p1, p2] = sortParticipants(userId1, userId2);

  const existing = await db.conversation.findUnique({
    where: { participant1Id_participant2Id: { participant1Id: p1, participant2Id: p2 } },
  });

  if (existing) return existing;

  return db.conversation.create({
    data: { participant1Id: p1, participant2Id: p2 },
  });
}

export async function sendDirectMessage(
  conversationId: string,
  senderId: string,
  content: string,
  replyToId?: string
) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new DmServiceError("Conversation not found", "NOT_FOUND", 404);
  }

  if (conversation.participant1Id !== senderId && conversation.participant2Id !== senderId) {
    throw new DmServiceError("Not a participant", "FORBIDDEN", 403);
  }

  const message = await db.directMessage.create({
    data: {
      conversationId,
      senderId,
      content,
      replyToId: replyToId || null,
    },
    include: {
      sender: {
        select: { id: true, name: true, avatar: true },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
  });

  // Update conversation lastMessageAt
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  return message;
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
  cursor?: string,
  limit: number = 50
) {
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw new DmServiceError("Conversation not found", "NOT_FOUND", 404);
  }

  if (conversation.participant1Id !== userId && conversation.participant2Id !== userId) {
    throw new DmServiceError("Not a participant", "FORBIDDEN", 403);
  }

  const messages = await db.directMessage.findMany({
    where: {
      conversationId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: {
        select: { id: true, name: true, avatar: true },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          sender: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const items = hasMore ? messages.slice(0, limit) : messages;

  // Mark unread messages as read
  await db.directMessage.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return {
    messages: items.reverse(),
    hasMore,
    nextCursor: hasMore ? items[items.length - 1]?.createdAt.toISOString() : null,
  };
}

export async function editDirectMessage(
  messageId: string,
  senderId: string,
  content: string
) {
  const message = await db.directMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new DmServiceError("Message not found", "NOT_FOUND", 404);
  }

  if (message.senderId !== senderId) {
    throw new DmServiceError("Can only edit your own messages", "FORBIDDEN", 403);
  }

  return db.directMessage.update({
    where: { id: messageId },
    data: { content, isEdited: true },
    include: {
      sender: {
        select: { id: true, name: true, avatar: true },
      },
    },
  });
}

export async function deleteDirectMessage(messageId: string, senderId: string) {
  const message = await db.directMessage.findUnique({
    where: { id: messageId },
  });

  if (!message) {
    throw new DmServiceError("Message not found", "NOT_FOUND", 404);
  }

  if (message.senderId !== senderId) {
    throw new DmServiceError("Can only delete your own messages", "FORBIDDEN", 403);
  }

  await db.directMessage.delete({ where: { id: messageId } });
  return message;
}

export async function getUserConversations(userId: string) {
  const conversations = await db.conversation.findMany({
    where: {
      OR: [{ participant1Id: userId }, { participant2Id: userId }],
    },
    include: {
      participant1: {
        select: { id: true, name: true, avatar: true },
      },
      participant2: {
        select: { id: true, name: true, avatar: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          isRead: true,
        },
      },
    },
    orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
  });

  // Count unread per conversation
  const unreadCounts = await db.directMessage.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      senderId: { not: userId },
      isRead: false,
    },
    _count: true,
  });

  const unreadMap = new Map(
    unreadCounts.map((u) => [u.conversationId, u._count])
  );

  return conversations.map((conv) => {
    const otherUser =
      conv.participant1Id === userId ? conv.participant2 : conv.participant1;
    const lastMessage = conv.messages[0] || null;

    return {
      id: conv.id,
      otherUser,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt.toISOString(),
          }
        : null,
      unreadCount: unreadMap.get(conv.id) || 0,
      lastMessageAt: conv.lastMessageAt?.toISOString() || conv.createdAt.toISOString(),
    };
  });
}

export async function markConversationRead(conversationId: string, userId: string) {
  await db.directMessage.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });
}

export async function getUnreadDmCount(userId: string) {
  return db.directMessage.count({
    where: {
      conversation: {
        OR: [{ participant1Id: userId }, { participant2Id: userId }],
      },
      senderId: { not: userId },
      isRead: false,
    },
  });
}
