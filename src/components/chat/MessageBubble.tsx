"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pin, Reply, Pencil, Trash2, MoreHorizontal, SmilePlus } from "lucide-react";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS, MESSAGE_REACTION_EMOJIS } from "@/lib/chat-constants";
import { useChatStore, type ChatMessage } from "@/stores/chat-store";

import { TraderBadge } from "@/components/shared/TraderBadge";
import { ChatImageGrid } from "@/components/shared/ChatImageGrid";
import { TradeCardInline } from "./TradeCardInline";
import { TradeEventLine } from "./TradeEventLine";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  canPin: boolean;
  clanId: string;
  currentUserId: string;
  userRole?: string;
  memberRole?: string;
  onUserClick?: (userId: string) => void;
}

function formatContent(content: string): React.ReactNode {
  const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|~~.*?~~|@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-muted px-1 py-0.5 text-xs">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return <del key={i}>{part.slice(2, -2)}</del>;
    }
    if (part.startsWith("@")) {
      return (
        <span key={i} className="rounded bg-primary/20 px-0.5 font-medium text-primary">
          {part}
        </span>
      );
    }
    return part;
  });
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  canPin,
  clanId,
  currentUserId,
  userRole,
  memberRole,
  onUserClick,
}: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);
  const { setReplyingTo, setEditingMessage } = useChatStore();

  function handlePin() {
    const socket = getSocket();
    if (message.isPinned) {
      socket.emit(SOCKET_EVENTS.UNPIN_MESSAGE, { messageId: message.id, clanId });
    } else {
      socket.emit(SOCKET_EVENTS.PIN_MESSAGE, { messageId: message.id, clanId });
    }
  }

  function handleDelete() {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.DELETE_MESSAGE, { messageId: message.id, clanId });
  }

  function handleReact(emoji: string) {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.REACT_MESSAGE, { messageId: message.id, clanId, emoji });
    setShowReactions(false);
  }

  const canDelete = isOwn || canPin;
  const canEdit = isOwn && message.type !== "SYSTEM_SUMMARY";
  const reactions = message.reactions || {};
  const activeReactions = Object.entries(reactions).filter(([, users]) => users.length > 0);
  const isTradeCard = message.type === "TRADE_CARD" && message.tradeCard;
  const isSummary = message.type === "SYSTEM_SUMMARY";
  const isTradeAction = message.type === "TRADE_ACTION";

  return (
    <div
      data-testid="message-bubble"
      className={`group flex items-start gap-2 ${
        isOwn ? "flex-row-reverse" : ""
      } ${showAvatar ? "mt-3" : "mt-0.5"}`}
    >
      {showAvatar ? (
        <Avatar
          className={`h-8 w-8 flex-shrink-0 ${!isOwn && onUserClick ? "cursor-pointer" : ""}`}
          onClick={!isOwn && onUserClick ? () => onUserClick(message.user.id) : undefined}
        >
          <AvatarImage src={message.user.avatar || undefined} alt={message.user.name || ""} />
          <AvatarFallback className="text-xs">
            {(message.user.name || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
        {showAvatar && (
          <div className={`mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground ${isOwn ? "justify-end" : ""}`}>
            <span
              className={`font-medium ${!isOwn && onUserClick ? "cursor-pointer hover:underline" : ""}`}
              onClick={!isOwn && onUserClick ? () => onUserClick(message.user.id) : undefined}
            >
              {message.user.name || "Unknown"}
            </span>
            {message.user.username && (
              <span className="text-muted-foreground/70">@{message.user.username}</span>
            )}
            <TraderBadge role={message.user.role} rankBadge={message.user.rankBadge} />
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
            {message.isEdited && <span className="italic">(edited)</span>}
          </div>
        )}

        {/* Reply preview — clickable to scroll to original */}
        {message.replyTo && (
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById(`msg-${message.replyTo!.id}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.classList.add("animate-highlight");
                setTimeout(() => el.classList.remove("animate-highlight"), 2000);
              }
            }}
            className={`mb-1 flex items-center gap-1 rounded-lg border-s-2 border-primary/50 bg-muted/30 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted/50 transition-colors ${isOwn ? "ms-auto" : ""}`}
          >
            <Reply className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="font-medium">{message.replyTo.user.name}:</span>
            <span className="truncate text-muted-foreground">
              {message.replyTo.content.length > 50
                ? message.replyTo.content.slice(0, 50) + "..."
                : message.replyTo.content}
            </span>
          </button>
        )}

        {/* Trade Action event line */}
        {isTradeAction ? (
          <TradeEventLine content={message.content} createdAt={message.createdAt} />
        ) : isTradeCard && message.tradeCard ? (
          <TradeCardInline
            tradeCard={message.tradeCard}
            messageId={message.id}
            clanId={clanId}
            currentUserId={currentUserId}
            isPinned={message.isPinned}
            userRole={userRole}
            memberRole={memberRole}
          />
        ) : isSummary ? (
          /* System Summary message */
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 px-3 py-2 text-sm">
            <p className="whitespace-pre-wrap break-words text-muted-foreground">
              {message.content}
            </p>
          </div>
        ) : (
          /* Regular text message bubble */
          <div
            className={`relative text-[15px] leading-relaxed ${
              showAvatar
                ? isOwn
                  ? "rounded-2xl rounded-ee-md"
                  : "rounded-2xl rounded-es-md"
                : "rounded-2xl"
            } px-3.5 py-2.5 ${message.isPinned ? "ring-2 ring-yellow-400/50" : ""}`}
            style={{
              backgroundColor: isOwn
                ? "var(--chat-bubble-own)"
                : "var(--chat-bubble-other)",
              color: isOwn
                ? "var(--chat-bubble-own-fg)"
                : "var(--chat-bubble-other-fg)",
              boxShadow: "var(--chat-bubble-shadow)",
            }}
          >
            {message.isPinned && (
              <Pin className="absolute -top-1 -end-1 h-3 w-3 text-yellow-500" />
            )}
            {message.images && message.images.length > 0 && (
              <ChatImageGrid images={message.images} />
            )}
            {message.content.trim() && (
              <p className="whitespace-pre-wrap break-words">{formatContent(message.content)}</p>
            )}
          </div>
        )}

        {/* Reactions display */}
        {activeReactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {activeReactions.map(([emoji, users]) => (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs transition-all ${
                  users.includes(currentUserId)
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-input hover:bg-accent"
                }`}
              >
                <span>{emoji}</span>
                <span>{users.length}</span>
              </button>
            ))}
          </div>
        )}

        {/* Actions (hover) */}
        <div data-testid="message-actions" className="mt-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="relative">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowReactions(!showReactions)}>
              <SmilePlus className="h-3 w-3" />
            </Button>
            {showReactions && (
              <div className="absolute bottom-full start-0 z-10 mb-1 flex gap-0.5 rounded-lg border bg-popover p-1 shadow-md">
                {MESSAGE_REACTION_EMOJIS.map((emoji) => (
                  <button key={emoji} onClick={() => handleReact(emoji)} className="rounded p-1 text-sm hover:bg-accent">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setReplyingTo(message)}>
            <Reply className="h-3 w-3" />
          </Button>

          {(canEdit || canDelete || canPin) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOwn ? "end" : "start"}>
                {canEdit && (
                  <DropdownMenuItem onClick={() => setEditingMessage(message)}>
                    <Pencil className="me-2 h-3 w-3" /> Edit
                  </DropdownMenuItem>
                )}
                {canPin && (
                  <DropdownMenuItem onClick={handlePin}>
                    <Pin className="me-2 h-3 w-3" /> {message.isPinned ? "Unpin" : "Pin"}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="me-2 h-3 w-3" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

    </div>
  );
}
