"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./MessageBubble";
import { UserProfileSheet } from "./UserProfileSheet";
import { ChevronDown, MessageCircle } from "lucide-react";
import type { ChatMessage } from "@/stores/chat-store";
import { useChatStore } from "@/stores/chat-store";

interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  hasMore: boolean;
  onLoadMore: () => void;
  canPin: boolean;
  clanId: string;
  topicName?: string;
  highlightMessageId?: string | null;
  userRole?: string;
  memberRole?: string;
}

export function MessageList({
  messages,
  currentUserId,
  hasMore,
  onLoadMore,
  canPin,
  clanId,
  topicName,
  highlightMessageId,
  userRole,
  memberRole,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const prevMessageCount = useRef(messages.length);

  // Clear active message when tapping the background
  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest("[data-testid='message-bubble']") === null) {
      setActiveMessageId(null);
    }
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    const prevCount = prevMessageCount.current;
    prevMessageCount.current = messages.length;
    const isNewMessage = messages.length > prevCount;

    if (isNewMessage) {
      // Initial load (0 → N): always scroll to bottom
      if (prevCount === 0) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView();
        });
        return;
      }
      // Incremental messages: only if near bottom
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

  // Scroll to highlighted message
  useEffect(() => {
    if (!highlightMessageId) return;

    const el = document.getElementById(`msg-${highlightMessageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("animate-highlight");
      const timer = setTimeout(() => {
        el.classList.remove("animate-highlight");
        useChatStore.getState().setHighlightMessageId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highlightMessageId]);

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
        className="chat-bg-pattern h-full overflow-y-auto px-3 py-2 lg:px-4"
        onScroll={handleScroll}
        onClick={handleBackgroundClick}
      >
        {hasMore && (
          <div className="mb-4 text-center">
            <Button variant="ghost" size="sm" onClick={onLoadMore}>
              Load older messages
            </Button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-sm text-muted-foreground">
            <MessageCircle className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p>
              No messages in{" "}
              <span className="font-medium">#{topicName || "General"}</span> yet
            </p>
            <p className="mt-1 text-xs">Start the conversation!</p>
          </div>
        )}

        <div className="space-y-0.5">
          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showAvatar = !prevMsg || prevMsg.user.id !== msg.user.id;
            const isTradeCard = msg.type === "TRADE_CARD" && msg.tradeCard;
            const prevIsTradeCard = prevMsg?.type === "TRADE_CARD" && prevMsg?.tradeCard;

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`animate-message-enter ${isTradeCard || prevIsTradeCard ? "pt-1" : ""}`}
              >
                <MessageBubble
                  message={msg}
                  isOwn={msg.user.id === currentUserId}
                  showAvatar={showAvatar}
                  canPin={canPin}
                  clanId={clanId}
                  currentUserId={currentUserId}
                  userRole={userRole}
                  memberRole={memberRole}
                  onUserClick={setProfileUserId}
                  isActive={activeMessageId === msg.id}
                  onActivate={setActiveMessageId}
                />
              </div>
            );
          })}
        </div>

        <div ref={bottomRef} />
      </div>

      {showScrollDown && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute bottom-4 end-3 z-20 rounded-full shadow-lg"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}

      <UserProfileSheet
        userId={profileUserId}
        currentUserId={currentUserId}
        onClose={() => setProfileUserId(null)}
      />
    </div>
  );
}
