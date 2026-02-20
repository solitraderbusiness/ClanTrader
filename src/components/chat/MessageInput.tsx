"use client";

import { useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS, MESSAGE_CONTENT_MAX } from "@/lib/chat-constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X, Reply, Pencil, BarChart3 } from "lucide-react";
import { useChatStore, type ClanMember } from "@/stores/chat-store";
import { SlashCommandMenu } from "./SlashCommandMenu";

type PanelType = "trades" | "watchlist" | "events" | "summary";

interface MessageInputProps {
  clanId: string;
  topicId: string;
  disabled: boolean;
  onOpenPanel?: (panel: PanelType) => void;
  onOpenTradeCard?: () => void;
}

export function MessageInput({ clanId, topicId, disabled, onOpenPanel, onOpenTradeCard }: MessageInputProps) {
  const editingMsg = useChatStore((s) => s.editingMessage);
  const [content, setContent] = useState(editingMsg?.content || "");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const replyingTo = useChatStore((s) => s.replyingTo);
  const editingMessage = useChatStore((s) => s.editingMessage);
  const clanMembers = useChatStore((s) => s.clanMembers);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const setEditingMessage = useChatStore((s) => s.setEditingMessage);

  const filteredMembers = mentionQuery !== null
    ? clanMembers.filter((m) =>
        m.name?.toLowerCase().includes(mentionQuery.toLowerCase())
      ).slice(0, 5)
    : [];

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

  function handleSlashSelect(panel: PanelType) {
    if (onOpenPanel) {
      onOpenPanel(panel);
    }
    setContent("");
    setSlashQuery(null);
  }

  function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || disabled) return;

    // Slash command detection on send
    if (trimmed.startsWith("/") && onOpenPanel) {
      const cmd = trimmed.slice(1).toLowerCase().trim();
      const panelMap: Record<string, PanelType> = {
        trades: "trades",
        trade: "trades",
        watchlist: "watchlist",
        watch: "watchlist",
        events: "events",
        event: "events",
        summary: "summary",
      };
      if (panelMap[cmd]) {
        onOpenPanel(panelMap[cmd]);
        setContent("");
        setSlashQuery(null);
        return;
      }
    }

    const socket = getSocket();

    if (editingMessage) {
      socket.emit(SOCKET_EVENTS.EDIT_MESSAGE, {
        messageId: editingMessage.id,
        clanId,
        content: trimmed,
      });
      setEditingMessage(null);
    } else {
      socket.emit(SOCKET_EVENTS.SEND_MESSAGE, {
        clanId,
        topicId,
        content: trimmed,
        ...(replyingTo ? { replyToId: replyingTo.id } : {}),
      });
      setReplyingTo(null);
    }

    setContent("");
    setMentionQuery(null);
    setSlashQuery(null);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit(SOCKET_EVENTS.STOP_TYPING, clanId);
    }
  }

  function handleCancel() {
    if (editingMessage) {
      setEditingMessage(null);
      setContent("");
    } else if (replyingTo) {
      setReplyingTo(null);
    }
  }

  function insertMention(member: ClanMember) {
    if (mentionQuery === null) return;

    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const beforeCursor = content.slice(0, cursorPos);
    const afterCursor = content.slice(cursorPos);

    const atIndex = beforeCursor.lastIndexOf("@");
    if (atIndex === -1) return;

    const name = member.name || "unknown";
    const newContent =
      content.slice(0, atIndex) + `@${name} ` + afterCursor;
    setContent(newContent);
    setMentionQuery(null);

    requestAnimationFrame(() => {
      const newPos = atIndex + name.length + 2;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setContent(value);
    emitTyping();

    const cursorPos = e.target.selectionStart;
    const beforeCursor = value.slice(0, cursorPos);

    // Detect @mention
    const atMatch = beforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
      setSlashQuery(null);
    } else {
      setMentionQuery(null);
    }

    // Detect /command (only if it's the start of the input)
    const slashMatch = value.match(/^\/(\w*)$/);
    if (slashMatch && !atMatch) {
      setSlashQuery(slashMatch[1]);
      setSlashIndex(0);
    } else {
      setSlashQuery(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Slash command navigation
    if (slashQuery !== null) {
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashQuery(null);
        return;
      }
    }

    // Mention autocomplete navigation
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Escape") {
      handleCancel();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t bg-card/80 p-3 backdrop-blur-sm" style={{ boxShadow: "var(--chat-input-shadow)" }}>
      {(replyingTo || editingMessage) && (
        <div className="mb-2 flex items-center gap-2 rounded border-s-2 border-primary bg-muted/50 px-3 py-2 text-sm">
          {replyingTo && (
            <>
              <Reply className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <span className="font-medium">{replyingTo.user.name}</span>
                <p className="truncate text-muted-foreground">
                  {replyingTo.content.length > 80
                    ? replyingTo.content.slice(0, 80) + "..."
                    : replyingTo.content}
                </p>
              </div>
            </>
          )}
          {editingMessage && (
            <>
              <Pencil className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <span className="font-medium">Editing message</span>
              </div>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 flex-shrink-0 p-0"
            onClick={handleCancel}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="relative">
        {/* @mention autocomplete dropdown */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="absolute bottom-full start-0 z-10 mb-1 w-60 rounded-lg border bg-popover p-1 shadow-md">
            {filteredMembers.map((member, i) => (
              <button
                key={member.id}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-start text-sm ${
                  i === mentionIndex ? "bg-accent" : "hover:bg-accent/50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(member);
                }}
              >
                <span className="font-medium">@{member.name || "unknown"}</span>
              </button>
            ))}
          </div>
        )}

        {/* Slash command autocomplete dropdown */}
        {slashQuery !== null && (
          <SlashCommandMenu
            query={slashQuery}
            selectedIndex={slashIndex}
            onSelect={handleSlashSelect}
          />
        )}

        <div className="flex items-end gap-2">
          {onOpenTradeCard && (
            <Button
              variant="ghost"
              size="icon"
              className="h-[40px] w-[40px] shrink-0"
              onClick={onOpenTradeCard}
              disabled={disabled}
              title="Share Trade Card"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          )}
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Connecting..."
                : editingMessage
                  ? "Edit your message..."
                  : replyingTo
                    ? `Reply to ${replyingTo.user.name}...`
                    : "Type a message... (@ to mention, / for commands)"
            }
            disabled={disabled}
            maxLength={MESSAGE_CONTENT_MAX}
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none rounded-xl bg-muted/30"
          />
          <Button
            size="icon"
            className="rounded-full"
            onClick={handleSend}
            disabled={disabled || !content.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-end text-xs text-muted-foreground">
        {content.length}/{MESSAGE_CONTENT_MAX}
      </p>
    </div>
  );
}
