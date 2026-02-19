import { db } from "@/lib/db";
import { MAX_TOPICS_PER_CLAN } from "@/lib/chat-constants";
import { MessageServiceError } from "@/services/message.service";

export async function createTopic(
  clanId: string,
  createdById: string,
  name: string,
  description?: string
) {
  const count = await db.chatTopic.count({
    where: { clanId, status: "ACTIVE" },
  });

  if (count >= MAX_TOPICS_PER_CLAN) {
    throw new MessageServiceError(
      `Maximum ${MAX_TOPICS_PER_CLAN} topics per clan`,
      "TOPIC_LIMIT",
      400
    );
  }

  // sortOrder = count so new topics go to the end
  return db.chatTopic.create({
    data: {
      clanId,
      name,
      description,
      createdById,
      sortOrder: count,
    },
  });
}

export async function getTopics(clanId: string) {
  return db.chatTopic.findMany({
    where: { clanId, status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getDefaultTopic(clanId: string) {
  const topic = await db.chatTopic.findFirst({
    where: { clanId, isDefault: true },
  });

  if (!topic) {
    // Auto-create General topic if none exists
    const clan = await db.clan.findUnique({
      where: { id: clanId },
      select: { createdById: true },
    });
    if (!clan) {
      throw new MessageServiceError("Clan not found", "NOT_FOUND", 404);
    }
    return db.chatTopic.create({
      data: {
        clanId,
        name: "General",
        description: "General chat",
        isDefault: true,
        sortOrder: 0,
        createdById: clan.createdById,
      },
    });
  }

  return topic;
}

export async function updateTopic(
  topicId: string,
  clanId: string,
  data: { name?: string; description?: string | null }
) {
  const topic = await db.chatTopic.findUnique({
    where: { id: topicId },
  });

  if (!topic || topic.clanId !== clanId) {
    throw new MessageServiceError("Topic not found", "NOT_FOUND", 404);
  }

  if (topic.isDefault && data.name && data.name !== topic.name) {
    throw new MessageServiceError(
      "Cannot rename the default topic",
      "CANNOT_RENAME_DEFAULT",
      400
    );
  }

  return db.chatTopic.update({
    where: { id: topicId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });
}

export async function archiveTopic(topicId: string, clanId: string) {
  const topic = await db.chatTopic.findUnique({
    where: { id: topicId },
  });

  if (!topic || topic.clanId !== clanId) {
    throw new MessageServiceError("Topic not found", "NOT_FOUND", 404);
  }

  if (topic.isDefault) {
    throw new MessageServiceError(
      "Cannot archive the default topic",
      "CANNOT_ARCHIVE_DEFAULT",
      400
    );
  }

  return db.chatTopic.update({
    where: { id: topicId },
    data: { status: "ARCHIVED" },
  });
}
