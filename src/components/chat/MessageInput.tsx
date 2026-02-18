"use client";

import { useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS, MESSAGE_CONTENT_MAX } from "@/lib/chat-constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface MessageInputProps {
  clanId: string;
  disabled: boolean;
}

export function MessageInput({ clanId, disabled }: MessageInputProps) {
  const [content, setContent] = useState("");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const emitTyping = useCallback(() => {
    const socket = getSocket();
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit(SOCKET_EVENTS.TYPING, clanId);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit(SOCKET_EVENTS.STOP_TYPING, clanId);
    }, 2000);
  }, [clanId]);

  function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
      clanId,
      content: trimmed,
    });

    setContent("");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit(SOCKET_EVENTS.STOP_TYPING, clanId);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            emitTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Connecting..." : "Type a message..."}
          disabled={disabled}
          maxLength={MESSAGE_CONTENT_MAX}
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || !content.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-1 text-end text-xs text-muted-foreground">
        {content.length}/{MESSAGE_CONTENT_MAX}
      </p>
    </div>
  );
}
