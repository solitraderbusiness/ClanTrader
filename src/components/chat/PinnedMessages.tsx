"use client";

import { useState } from "react";
import { Pin, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/stores/chat-store";

interface PinnedMessagesProps {
  messages: ChatMessage[];
}

export function PinnedMessages({ messages }: PinnedMessagesProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (messages.length === 0 || dismissed) return null;

  return (
    <div className="border-b bg-yellow-50/50 px-3 py-1 dark:bg-yellow-950/10">
      <div className="flex items-center gap-2">
        <Pin className="h-3 w-3 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-1 text-xs font-medium text-yellow-700 dark:text-yellow-400"
        >
          {messages.length} pinned
          <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 w-5 p-0 text-muted-foreground"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      {expanded && (
        <div className="mt-1 space-y-1 pb-1">
          {messages.map((msg) => (
            <div key={msg.id} className="text-xs">
              <span className="font-medium">{msg.user.name}: </span>
              <span className="text-muted-foreground">
                {msg.content.length > 80
                  ? msg.content.slice(0, 80) + "..."
                  : msg.content}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
