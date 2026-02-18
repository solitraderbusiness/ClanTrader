"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pin } from "lucide-react";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import type { ChatMessage } from "@/stores/chat-store";

interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
  canPin: boolean;
  clanId: string;
}

function formatContent(content: string): React.ReactNode {
  const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|~~.*?~~)/g);
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
    return part;
  });
}

export function MessageBubble({
  message,
  isOwn,
  showAvatar,
  canPin,
  clanId,
}: MessageBubbleProps) {
  function handlePin() {
    const socket = getSocket();
    if (message.isPinned) {
      socket.emit(SOCKET_EVENTS.UNPIN_MESSAGE, {
        messageId: message.id,
        clanId,
      });
    } else {
      socket.emit(SOCKET_EVENTS.PIN_MESSAGE, {
        messageId: message.id,
        clanId,
      });
    }
  }

  return (
    <div
      className={`group flex items-start gap-2 ${
        isOwn ? "flex-row-reverse" : ""
      } ${showAvatar ? "mt-3" : "mt-0.5"}`}
    >
      {showAvatar ? (
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage
            src={message.user.avatar || undefined}
            alt={message.user.name || ""}
          />
          <AvatarFallback className="text-xs">
            {(message.user.name || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 flex-shrink-0" />
      )}

      <div className={`max-w-[70%] ${isOwn ? "items-end" : "items-start"}`}>
        {showAvatar && (
          <div
            className={`mb-0.5 flex items-center gap-2 text-xs text-muted-foreground ${isOwn ? "justify-end" : ""}`}
          >
            <span className="font-medium">
              {message.user.name || "Unknown"}
            </span>
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        <div
          className={`relative rounded-lg px-3 py-2 text-sm ${
            isOwn ? "bg-primary text-primary-foreground" : "bg-muted"
          } ${message.isPinned ? "ring-2 ring-yellow-400/50" : ""}`}
        >
          {message.isPinned && (
            <Pin className="absolute -top-1 -end-1 h-3 w-3 text-yellow-500" />
          )}
          <p className="whitespace-pre-wrap break-words">
            {formatContent(message.content)}
          </p>
        </div>

        {canPin && (
          <div className="mt-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handlePin}
            >
              <Pin className="me-1 h-3 w-3" />
              {message.isPinned ? "Unpin" : "Pin"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
