"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pencil, Trash2, MoreHorizontal, Reply, Check, CheckCheck } from "lucide-react";
import { ChatImageGrid } from "@/components/shared/ChatImageGrid";
import type { DmMessage } from "@/stores/dm-store";

interface DmMessageBubbleProps {
  message: DmMessage;
  isOwn: boolean;
  showAvatar: boolean;
  currentUserId?: string;
  onReply: (msg: DmMessage) => void;
  onEdit: (msg: DmMessage) => void;
  onDelete: (msgId: string) => void;
  onUserClick?: (userId: string) => void;
}

function formatContent(content: string): React.ReactNode {
  const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
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
    return part;
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DmMessageBubble({
  message,
  isOwn,
  showAvatar,
  onReply,
  onEdit,
  onDelete,
  onUserClick,
}: DmMessageBubbleProps) {
  return (
    <div
      className={`group flex gap-2 px-3 py-0.5 ${isOwn ? "flex-row-reverse" : ""}`}
    >
      {/* Avatar */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && (
          <Avatar
            className={`h-8 w-8 ${onUserClick ? "cursor-pointer" : ""}`}
            onClick={onUserClick ? () => onUserClick(message.sender.id) : undefined}
          >
            <AvatarImage
              src={message.sender.avatar || undefined}
              alt={message.sender.name || ""}
            />
            <AvatarFallback className="text-xs">
              {(message.sender.name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] ${isOwn ? "items-end" : ""}`}>
        {/* Reply preview */}
        {message.replyTo && (
          <div className="mb-1 rounded-md border-s-2 border-primary/50 bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
            <span className="font-medium">
              {message.replyTo.sender.name || "Unknown"}
            </span>
            <p className="truncate">{message.replyTo.content}</p>
          </div>
        )}

        <div
          className={`rounded-2xl px-3 py-2 text-sm ${
            isOwn
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}
        >
          {message.images && message.images.length > 0 && (
            <ChatImageGrid images={message.images} />
          )}
          {message.content.trim() && (
            <p className="whitespace-pre-wrap break-words">
              {formatContent(message.content)}
            </p>
          )}
        </div>

        <div className={`mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground ${isOwn ? "justify-end" : ""}`}>
          <span>{formatTime(message.createdAt)}</span>
          {message.isEdited && <span>edited</span>}
          {isOwn && (
            message.isRead
              ? <CheckCheck className="h-3 w-3 text-primary" />
              : <Check className="h-3 w-3" />
          )}
        </div>
      </div>

      {/* Action menu */}
      <div className="flex items-start opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
            >
              <MoreHorizontal className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? "end" : "start"}>
            <DropdownMenuItem onClick={() => onReply(message)}>
              <Reply className="me-2 h-4 w-4" />
              Reply
            </DropdownMenuItem>
            {isOwn && (
              <>
                <DropdownMenuItem onClick={() => onEdit(message)}>
                  <Pencil className="me-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(message.id)}
                  className="text-destructive"
                >
                  <Trash2 className="me-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
  );
}
