"use client";

import { useState } from "react";
import { ChatToolbar } from "./ChatToolbar";
import { MonitorSmartphone, ChevronDown, Plus, Hash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const [topicOpen, setTopicOpen] = useState(false);
  const currentTopic = topics.find((t) => t.id === currentTopicId);

  return (
    <div className="flex items-center gap-1.5 border-b bg-card/80 px-2 py-1.5 backdrop-blur-sm">
      {/* Topic chip — dropdown selector */}
      <DropdownMenu open={topicOpen} onOpenChange={setTopicOpen}>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20">
            <Hash className="h-3 w-3" />
            <span className="max-w-[100px] truncate">{currentTopic?.name || "General"}</span>
            <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-60 overflow-y-auto">
          {topics.map((topic) => (
            <DropdownMenuItem
              key={topic.id}
              onClick={() => { onSelectTopic(topic.id); setTopicOpen(false); }}
              className={currentTopicId === topic.id ? "bg-accent" : ""}
            >
              <Hash className="me-1.5 h-3 w-3 text-muted-foreground" />
              {topic.name}
            </DropdownMenuItem>
          ))}
          {canManage && (
            <DropdownMenuItem onClick={() => { onCreateTopic(); setTopicOpen(false); }}>
              <Plus className="me-1.5 h-3 w-3" />
              {t("chat.createTopic")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Online count — compact */}
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        {onlineUsers.length}
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Toolbar icons */}
      <ChatToolbar openPanel={openPanel} onTogglePanel={onTogglePanel} />

      {/* Connect MT button */}
      {!hasMtAccount && (
        <button
          type="button"
          onClick={onConnectAccount}
          className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <MonitorSmartphone className="h-3 w-3" />
          {t("profile.connect")}
        </button>
      )}
    </div>
  );
}
