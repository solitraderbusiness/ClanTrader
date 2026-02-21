"use client";

import { useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { useDmStore, type DmMessage } from "@/stores/dm-store";
import { DmMessageBubble } from "./DmMessageBubble";
import { DmMessageInput } from "./DmMessageInput";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface DmPanelProps {
  recipientId: string;
  currentUserId: string;
  recipientName: string | null;
  recipientAvatar: string | null;
  initialMessages: DmMessage[];
  conversationId: string;
  hasMore: boolean;
  nextCursor: string | null;
}

export function DmPanel({
  recipientId,
  currentUserId,
  recipientName,
  recipientAvatar,
  initialMessages,
  conversationId,
  hasMore: initialHasMore,
  nextCursor: initialNextCursor,
}: DmPanelProps) {
  const store = useDmStore();
  const socketRef = useRef(getSocket());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const hasMoreRef = useRef(initialHasMore);
  const nextCursorRef = useRef(initialNextCursor);
  const loadingMoreRef = useRef(false);

  // Initialize
  useEffect(() => {
    store.setMessages(initialMessages);
    store.setActiveRecipientId(recipientId);
    hasMoreRef.current = initialHasMore;
    nextCursorRef.current = initialNextCursor;

    const socket = socketRef.current;
    if (!socket.connected) socket.connect();

    // Join DM room
    socket.emit(SOCKET_EVENTS.JOIN_DM, recipientId);

    // Mark as read
    socket.emit(SOCKET_EVENTS.DM_READ, recipientId);

    return () => {
      store.setActiveRecipientId(null);
      store.setMessages([]);
      store.setReplyingTo(null);
    };
  }, [recipientId]);

  // Socket listeners
  useEffect(() => {
    const socket = socketRef.current;

    function handleReceiveDm(msg: DmMessage) {
      if (msg.conversationId === conversationId) {
        store.addMessage(msg);
        // Auto-scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
        // Mark as read if message is from other user
        if (msg.senderId !== currentUserId) {
          socket.emit(SOCKET_EVENTS.DM_READ, recipientId);
        }
      }
    }

    function handleDmEdited(data: { id: string; content: string; isEdited: boolean }) {
      store.updateMessage(data.id, { content: data.content, isEdited: data.isEdited });
    }

    function handleDmDeleted(data: { id: string }) {
      store.removeMessage(data.id);
    }

    function handleTyping(data: { userId: string; name: string }) {
      if (data.userId !== currentUserId) {
        store.setTypingUser(recipientId, data.userId, data.name);
        setTimeout(() => {
          store.clearTypingUser(recipientId, data.userId);
        }, 3000);
      }
    }

    function handleStopTyping(data: { userId: string }) {
      store.clearTypingUser(recipientId, data.userId);
    }

    function handleMarkedRead(data: { userId: string; conversationId: string }) {
      if (data.conversationId === conversationId && data.userId === recipientId) {
        // Other user read our messages
        const messages = useDmStore.getState().messages;
        messages.forEach((m) => {
          if (m.senderId === currentUserId && !m.isRead) {
            store.updateMessage(m.id, { isRead: true });
          }
        });
      }
    }

    socket.on(SOCKET_EVENTS.RECEIVE_DM, handleReceiveDm);
    socket.on(SOCKET_EVENTS.DM_EDITED, handleDmEdited);
    socket.on(SOCKET_EVENTS.DM_DELETED, handleDmDeleted);
    socket.on(SOCKET_EVENTS.DM_USER_TYPING, handleTyping);
    socket.on(SOCKET_EVENTS.DM_USER_STOP_TYPING, handleStopTyping);
    socket.on(SOCKET_EVENTS.DM_MARKED_READ, handleMarkedRead);

    return () => {
      socket.off(SOCKET_EVENTS.RECEIVE_DM, handleReceiveDm);
      socket.off(SOCKET_EVENTS.DM_EDITED, handleDmEdited);
      socket.off(SOCKET_EVENTS.DM_DELETED, handleDmDeleted);
      socket.off(SOCKET_EVENTS.DM_USER_TYPING, handleTyping);
      socket.off(SOCKET_EVENTS.DM_USER_STOP_TYPING, handleStopTyping);
      socket.off(SOCKET_EVENTS.DM_MARKED_READ, handleMarkedRead);
    };
  }, [conversationId, recipientId, currentUserId]);

  // Auto-scroll on initial load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, []);

  // Load more on scroll to top
  const handleScroll = useCallback(async () => {
    const container = messagesContainerRef.current;
    if (!container || !hasMoreRef.current || loadingMoreRef.current) return;

    if (container.scrollTop < 100) {
      loadingMoreRef.current = true;
      const prevHeight = container.scrollHeight;

      try {
        const res = await fetch(
          `/api/dms/${recipientId}?cursor=${nextCursorRef.current}`
        );
        if (res.ok) {
          const data = await res.json();
          hasMoreRef.current = data.hasMore;
          nextCursorRef.current = data.nextCursor;

          if (data.messages.length > 0) {
            store.setMessages([...data.messages, ...useDmStore.getState().messages]);
            // Maintain scroll position
            requestAnimationFrame(() => {
              const newHeight = container.scrollHeight;
              container.scrollTop = newHeight - prevHeight;
            });
          }
        }
      } catch {
        // Silent fail
      } finally {
        loadingMoreRef.current = false;
      }
    }
  }, [recipientId]);

  const messages = useDmStore((s) => s.messages);
  const typingUsers = useDmStore((s) => s.typingUsers);

  // Get typing names for this conversation
  const typingNames: string[] = [];
  typingUsers.forEach((name, key) => {
    if (key.startsWith(`${recipientId}:`)) {
      typingNames.push(name);
    }
  });

  function handleEdit(msg: DmMessage) {
    const socket = socketRef.current;
    const newContent = prompt("Edit message:", msg.content);
    if (newContent && newContent !== msg.content) {
      socket.emit(SOCKET_EVENTS.EDIT_DM, {
        messageId: msg.id,
        recipientId,
        content: newContent,
      });
    }
  }

  function handleDelete(msgId: string) {
    if (!confirm("Delete this message?")) return;
    const socket = socketRef.current;
    socket.emit(SOCKET_EVENTS.DELETE_DM, {
      messageId: msgId,
      recipientId,
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-3 h-14">
        <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" asChild>
          <Link href="/dm">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarImage src={recipientAvatar || undefined} alt={recipientName || ""} />
          <AvatarFallback className="text-xs">
            {(recipientName || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {recipientName || "Unknown"}
          </p>
          {typingNames.length > 0 && (
            <p className="text-xs text-muted-foreground">typing...</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto py-2"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const prevMsg = i > 0 ? messages[i - 1] : null;
            const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
            const isOwn = msg.senderId === currentUserId;

            return (
              <DmMessageBubble
                key={msg.id}
                message={msg}
                isOwn={isOwn}
                showAvatar={showAvatar}
                currentUserId={currentUserId}
                onReply={(m) => store.setReplyingTo(m)}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingNames.length > 0 && (
        <div className="px-3 py-1 text-xs text-muted-foreground">
          {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
        </div>
      )}

      {/* Input */}
      <DmMessageInput recipientId={recipientId} disabled={false} />
    </div>
  );
}
