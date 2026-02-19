"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { ChatTopic } from "@/stores/chat-store";

interface TopicSelectorProps {
  topics: ChatTopic[];
  currentTopicId: string | null;
  onSelectTopic: (topicId: string) => void;
  onCreateTopic: () => void;
  canManage: boolean;
}

export function TopicSelector({
  topics,
  currentTopicId,
  onSelectTopic,
  onCreateTopic,
  canManage,
}: TopicSelectorProps) {
  return (
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex items-center gap-1 px-1 py-1">
        {topics.map((topic) => (
          <button
            key={topic.id}
            onClick={() => onSelectTopic(topic.id)}
            className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              currentTopicId === topic.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            # {topic.name}
          </button>
        ))}
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 shrink-0 rounded-full p-0"
            onClick={onCreateTopic}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
