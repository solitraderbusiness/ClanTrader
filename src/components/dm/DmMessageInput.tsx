"use client";

import { useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS, DM_CONTENT_MAX } from "@/lib/chat-constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Reply } from "lucide-react";
import { useDmStore } from "@/stores/dm-store";

interface DmMessageInputProps {
  recipientId: string;
  disabled: boolean;
}

export function DmMessageInput({ recipientId, disabled }: DmMessageInputProps) {
  const [content, setContent] = useState("");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const replyingTo = useDmStore((s) => s.replyingTo);
  const setReplyingTo = useDmStore((s) => s.setReplyingTo);

  const emitTyping = useCallback(() => {
    const socket = getSocket();
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit(SOCKET_EVENTS.DM_TYPING, recipientId);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit(SOCKET_EVENTS.DM_STOP_TYPING, recipientId);
    }, 3000);
  }, [recipientId]);

  function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.SEND_DM, {
      recipientId,
      content: trimmed,
      replyToId: replyingTo?.id,
    });

    setContent("");
    setReplyingTo(null);

    // Stop typing
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit(SOCKET_EVENTS.DM_STOP_TYPING, recipientId);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t bg-background p-3">
      {/* Reply preview */}
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-muted p-2 text-xs">
          <Reply className="h-3 w-3 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <span className="font-medium">
              {replyingTo.sender.name || "Unknown"}
            </span>
            <p className="truncate text-muted-foreground">
              {replyingTo.content}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => setReplyingTo(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            emitTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled}
          maxLength={DM_CONTENT_MAX}
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none text-sm"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!content.trim() || disabled}
          className="flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
