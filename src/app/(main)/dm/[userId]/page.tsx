import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import {
  getOrCreateConversation,
  getConversationMessages,
} from "@/services/dm.service";
import { DmPanel } from "@/components/dm/DmPanel";
import type { DmMessage } from "@/stores/dm-store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    return { title: user?.name ? `DM - ${user.name}` : "Direct Message" };
  } catch {
    return { title: "Direct Message" };
  }
}

export default async function DmConversationPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { userId: recipientId } = await params;

  // Get recipient info
  const recipient = await db.user.findUnique({
    where: { id: recipientId },
    select: { id: true, name: true, avatar: true },
  });

  if (!recipient) notFound();

  // Get or create conversation and fetch messages
  const conversation = await getOrCreateConversation(
    session.user.id,
    recipientId
  );

  const result = await getConversationMessages(
    conversation.id,
    session.user.id
  );

  // Serialize messages for client
  const serializedMessages: DmMessage[] = result.messages.map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    content: m.content,
    senderId: m.senderId,
    isEdited: m.isEdited,
    isRead: m.isRead,
    replyTo: m.replyTo
      ? {
          id: m.replyTo.id,
          content: m.replyTo.content,
          sender: m.replyTo.sender,
        }
      : null,
    createdAt: m.createdAt.toISOString(),
    sender: m.sender,
  }));

  return (
    <div className="h-full">
      <DmPanel
        recipientId={recipientId}
        currentUserId={session.user.id}
        recipientName={recipient.name}
        recipientAvatar={recipient.avatar}
        initialMessages={serializedMessages}
        conversationId={conversation.id}
        hasMore={result.hasMore}
        nextCursor={result.nextCursor}
      />
    </div>
  );
}
