"use client";

import { TopicSelector } from "./TopicSelector";
import { ChatToolbar } from "./ChatToolbar";
import { OnlineUsersBar } from "./OnlineUsersBar";
import { MonitorSmartphone } from "lucide-react";
import type { ChatTopic, OnlineUser } from "@/stores/chat-store";
import { useTranslation } from "@/lib/i18n";

type PanelType = "trades" | "watchlist" | "events" | "summary" | "digest";

interface ChatHeaderProps {
  topics: ChatTopic[];
  currentTopicId: string | null;
  onSelectTopic: (topicId: string) => void;
  onCreateTopic: () => void;
  canManage: boolean;
  onlineUsers: OnlineUser[];
  hasMtAccount?: boolean;
  onConnectAccount: () => void;
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
  hasMtAccount,
  onConnectAccount,
  openPanel,
  onTogglePanel,
}: ChatHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b bg-card/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-3 py-1.5">
        <OnlineUsersBar users={onlineUsers} />
        <div className="flex items-center gap-2">
          <ChatToolbar openPanel={openPanel} onTogglePanel={onTogglePanel} />
          {!hasMtAccount && (
            <button
              type="button"
              onClick={onConnectAccount}
              className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <MonitorSmartphone className="h-3 w-3" />
              {t("profile.connect")}
            </button>
          )}
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
