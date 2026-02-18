"use client";

import { useState } from "react";
import { Pin, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/stores/chat-store";

interface PinnedMessagesProps {
  messages: ChatMessage[];
}

export function PinnedMessages({ messages }: PinnedMessagesProps) {
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0) return null;

  const displayed = expanded ? messages : [messages[0]];

  return (
    <div className="border-b bg-yellow-50/50 px-4 py-2 dark:bg-yellow-950/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
          <Pin className="h-3 w-3" />
          {messages.length} pinned message{messages.length > 1 ? "s" : ""}
        </div>
        {messages.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
      <div className="mt-1 space-y-1">
        {displayed.map((msg) => (
          <div key={msg.id} className="text-xs">
            <span className="font-medium">{msg.user.name}: </span>
            <span className="text-muted-foreground">
              {msg.content.length > 100
                ? msg.content.slice(0, 100) + "..."
                : msg.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
