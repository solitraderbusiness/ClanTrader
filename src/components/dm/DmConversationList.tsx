"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DmConversation } from "@/stores/dm-store";
import { StartDmDialog } from "./StartDmDialog";

interface DmConversationListProps {
  conversations: DmConversation[];
  activeRecipientId?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

export function DmConversationList({
  conversations,
  activeRecipientId,
}: DmConversationListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h2 className="text-sm font-semibold">Direct Messages</h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setDialogOpen(true)}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              Start a conversation
            </Button>
          </div>
        ) : (
          <div className="py-1">
            {conversations.map((conv) => {
              const isActive = conv.otherUser.id === activeRecipientId;
              const hasUnread = conv.unreadCount > 0;
              return (
                <button
                  key={conv.id}
                  onClick={() => router.push(`/dm/${conv.otherUser.id}`)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors",
                    isActive ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage
                      src={conv.otherUser.avatar || undefined}
                      alt={conv.otherUser.name || ""}
                    />
                    <AvatarFallback className="text-xs">
                      {(conv.otherUser.name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "truncate text-sm",
                          hasUnread ? "font-semibold" : "font-medium"
                        )}
                      >
                        {conv.otherUser.name || "Unknown"}
                      </span>
                      {conv.lastMessage && (
                        <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                          {timeAgo(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p
                        className={cn(
                          "truncate text-xs",
                          hasUnread ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {conv.lastMessage?.content || "No messages yet"}
                      </p>
                      {hasUnread && (
                        <Badge
                          variant="destructive"
                          className="ms-2 h-5 min-w-5 flex-shrink-0 px-1 text-[10px] leading-none"
                        >
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <StartDmDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
