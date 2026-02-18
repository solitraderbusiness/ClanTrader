"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { ChevronDown } from "lucide-react";
import type { ChatMessage } from "@/stores/chat-store";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  hasMore: boolean;
  onLoadMore: () => void;
  canPin: boolean;
  clanId: string;
}

export function MessageList({
  messages,
  currentUserId,
  hasMore,
  onLoadMore,
  canPin,
  clanId,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const prevMessageCount = useRef(messages.length);

  // Auto-scroll on new messages if near bottom
  useEffect(() => {
    const isNewMessage = messages.length > prevMessageCount.current;
    prevMessageCount.current = messages.length;

    if (isNewMessage) {
      const container = scrollRef.current;
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight <
          100;
        if (isNearBottom) {
          requestAnimationFrame(() => {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
          });
        }
      }
    }
  }, [messages.length]);

  // Initial scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
  }, []);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollDown(false);
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const target = e.target as HTMLDivElement;
    if (target.scrollTop === 0 && hasMore) {
      onLoadMore();
    }
    const isNearBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    setShowScrollDown(!isNearBottom);
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {hasMore && (
          <div className="mb-4 text-center">
            <Button variant="ghost" size="sm" onClick={onLoadMore}>
              Load older messages
            </Button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No messages yet. Start the conversation!
          </div>
        )}

        <div className="space-y-1">
          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showAvatar = !prevMsg || prevMsg.user.id !== msg.user.id;

            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.user.id === currentUserId}
                showAvatar={showAvatar}
                canPin={canPin}
                clanId={clanId}
              />
            );
          })}
        </div>

        <div ref={bottomRef} />
      </div>

      {showScrollDown && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-2 end-2 rounded-full shadow-md"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
