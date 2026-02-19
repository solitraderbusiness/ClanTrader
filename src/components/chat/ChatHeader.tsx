"use client";

import { TopicSelector } from "./TopicSelector";
import { ChatToolbar } from "./ChatToolbar";
import { OnlineUsersBar } from "./OnlineUsersBar";
import { ConnectionStatus } from "./ConnectionStatus";
import type { ChatTopic, OnlineUser } from "@/stores/chat-store";

type PanelType = "trades" | "watchlist" | "events" | "summary";

interface ChatHeaderProps {
  topics: ChatTopic[];
  currentTopicId: string | null;
  onSelectTopic: (topicId: string) => void;
  onCreateTopic: () => void;
  canManage: boolean;
  onlineUsers: OnlineUser[];
  isConnected: boolean;
  openPanel: PanelType | null;
  onTogglePanel: (panel: PanelType) => void;
}

export function ChatHeader({
  topics,
  currentTopicId,
  onSelectTopic,
  onCreateTopic,
  canManage,
  onlineUsers,
  isConnected,
  openPanel,
  onTogglePanel,
}: ChatHeaderProps) {
  return (
    <div className="border-b">
      <div className="flex items-center justify-between px-3 py-1.5">
        <OnlineUsersBar users={onlineUsers} />
        <div className="flex items-center gap-2">
          <ChatToolbar openPanel={openPanel} onTogglePanel={onTogglePanel} />
          <ConnectionStatus isConnected={isConnected} />
        </div>
      </div>
      <div className="border-t px-2">
        <TopicSelector
          topics={topics}
          currentTopicId={currentTopicId}
          onSelectTopic={onSelectTopic}
          onCreateTopic={onCreateTopic}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
