"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import {
  useChatStore,
  type ChatMessage,
  type OnlineUser,
  type ChatTopic,
} from "@/stores/chat-store";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { PinnedMessages } from "./PinnedMessages";
import { TopicManageDialog } from "./TopicManageDialog";
import { TradeCardComposerDialog } from "./TradeCardComposerDialog";
import { TradeCardDetailSheet } from "./TradeCardDetailSheet";
import { LatestTradesSheet } from "./LatestTradesSheet";
import { WatchlistSheet } from "./WatchlistSheet";
import { EventsSheet } from "./EventsSheet";
import { SummarySheet } from "./SummarySheet";
import { toast } from "sonner";

interface ChatPanelProps {
  clanId: string;
  currentUserId: string;
  memberRole: string;
  initialTopics?: ChatTopic[];
}

export function ChatPanel({
  clanId,
  currentUserId,
  memberRole,
  initialTopics,
}: ChatPanelProps) {
  const store = useChatStore();
  const socketRef = useRef(getSocket());
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [tradeCardDialogOpen, setTradeCardDialogOpen] = useState(false);
  const [tradeDetailId, setTradeDetailId] = useState<string | null>(null);
  const [tradeDetailOpen, setTradeDetailOpen] = useState(false);

  const canManage = memberRole === "LEADER" || memberRole === "CO_LEADER";
  const canPin = canManage;

  // Initialize topics
  useEffect(() => {
    if (initialTopics && initialTopics.length > 0) {
      useChatStore.getState().setTopics(initialTopics);
      const defaultTopic = initialTopics.find((t) => t.isDefault) || initialTopics[0];
      if (defaultTopic) {
        useChatStore.getState().setCurrentTopicId(defaultTopic.id);
      }
    }
  }, [initialTopics]);

  useEffect(() => {
    const socket = socketRef.current;
    const {
      setMessages,
      setHasMore,
      setNextCursor,
      setPinnedMessages,
      setClanMembers,
      setConnected,
      addMessage,
      updateMessage,
      removeMessage,
      addPinnedMessage,
      removePinnedMessage,
      addTypingUser,
      removeTypingUser,
      setOnlineUsers,
      addTopic,
      updateTopic: updateTopicInStore,
      removeTopic,
      updateTradeCardStatus,
      reset,
    } = useChatStore.getState();

    async function fetchMessages(topicId: string) {
      try {
        const [msgRes, pinnedRes] = await Promise.all([
          fetch(`/api/clans/${clanId}/topics/${topicId}/messages`),
          fetch(`/api/clans/${clanId}/topics/${topicId}/messages?pinned=true`),
        ]);

        if (msgRes.ok) {
          const data = await msgRes.json();
          setMessages(data.messages);
          setHasMore(data.hasMore);
          setNextCursor(data.nextCursor);
        }

        if (pinnedRes.ok) {
          const data = await pinnedRes.json();
          setPinnedMessages(data.messages);
        }
      } catch {
        // silent fail
      }
    }

    async function fetchMembers() {
      try {
        const res = await fetch(`/api/clans/${clanId}/messages?members=true`);
        if (res.ok) {
          const data = await res.json();
          setClanMembers(data.members);
        }
      } catch {
        // silent fail
      }
    }

    const currentTopicId = useChatStore.getState().currentTopicId;

    socket.connect();
    socket.emit(SOCKET_EVENTS.JOIN_CLAN, { clanId, topicId: currentTopicId || undefined });

    if (currentTopicId) {
      fetchMessages(currentTopicId);
    }
    fetchMembers();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (message: ChatMessage) => {
      addMessage(message);
    });

    socket.on(
      SOCKET_EVENTS.MESSAGE_EDITED,
      (data: ChatMessage | { id: string; clanId: string; content: string; isEdited: boolean }) => {
        if ("tradeCard" in data) {
          updateMessage(data.id, data);
        } else {
          updateMessage(data.id, { content: data.content, isEdited: data.isEdited });
        }
      }
    );

    socket.on(SOCKET_EVENTS.MESSAGE_DELETED, (data: { id: string }) => {
      removeMessage(data.id);
    });

    socket.on(
      SOCKET_EVENTS.MESSAGE_REACTED,
      (data: { id: string; reactions: Record<string, string[]> | null }) => {
        updateMessage(data.id, { reactions: data.reactions });
      }
    );

    socket.on(SOCKET_EVENTS.MESSAGE_PINNED, (message: ChatMessage) => {
      updateMessage(message.id, { isPinned: true });
      addPinnedMessage(message);
    });

    socket.on(SOCKET_EVENTS.MESSAGE_UNPINNED, (data: { id: string }) => {
      updateMessage(data.id, { isPinned: false });
      removePinnedMessage(data.id);
    });

    socket.on(
      SOCKET_EVENTS.USER_TYPING,
      (data: { userId: string; name: string }) => {
        if (data.userId !== currentUserId) {
          addTypingUser(data.userId, data.name);
        }
      }
    );

    socket.on(SOCKET_EVENTS.USER_STOP_TYPING, (data: { userId: string }) => {
      removeTypingUser(data.userId);
    });

    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    socket.on(SOCKET_EVENTS.TOPIC_CREATED, (topic: ChatTopic) => {
      addTopic(topic);
    });

    socket.on(SOCKET_EVENTS.TOPIC_UPDATED, (topic: ChatTopic) => {
      updateTopicInStore(topic.id, topic);
    });

    socket.on(SOCKET_EVENTS.TOPIC_ARCHIVED, (data: { topicId: string }) => {
      removeTopic(data.topicId);
    });

    socket.on(
      SOCKET_EVENTS.TRADE_STATUS_UPDATED,
      (data: { messageId: string; trade: { id: string; status: string; userId: string } }) => {
        updateTradeCardStatus(data.messageId, data.trade);
      }
    );

    socket.on(
      SOCKET_EVENTS.ERROR,
      (data: { event: string; message: string }) => {
        toast.error(data.message);
      }
    );

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_CLAN, clanId);
      socket.off("connect");
      socket.off("disconnect");
      socket.off(SOCKET_EVENTS.RECEIVE_MESSAGE);
      socket.off(SOCKET_EVENTS.MESSAGE_EDITED);
      socket.off(SOCKET_EVENTS.MESSAGE_DELETED);
      socket.off(SOCKET_EVENTS.MESSAGE_REACTED);
      socket.off(SOCKET_EVENTS.MESSAGE_PINNED);
      socket.off(SOCKET_EVENTS.MESSAGE_UNPINNED);
      socket.off(SOCKET_EVENTS.USER_TYPING);
      socket.off(SOCKET_EVENTS.USER_STOP_TYPING);
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE);
      socket.off(SOCKET_EVENTS.TOPIC_CREATED);
      socket.off(SOCKET_EVENTS.TOPIC_UPDATED);
      socket.off(SOCKET_EVENTS.TOPIC_ARCHIVED);
      socket.off(SOCKET_EVENTS.TRADE_STATUS_UPDATED);
      socket.off(SOCKET_EVENTS.ERROR);
      socket.disconnect();
      reset();
    };
  }, [clanId, currentUserId]);

  const handleSwitchTopic = useCallback(
    async (topicId: string) => {
      const currentTopicId = useChatStore.getState().currentTopicId;
      if (topicId === currentTopicId) return;

      const socket = socketRef.current;
      const {
        setCurrentTopicId,
        setMessages,
        setHasMore,
        setNextCursor,
        setPinnedMessages,
      } = useChatStore.getState();

      if (currentTopicId) {
        socket.emit(SOCKET_EVENTS.SWITCH_TOPIC, {
          clanId,
          fromTopicId: currentTopicId,
          toTopicId: topicId,
        });
      }

      setCurrentTopicId(topicId);
      setMessages([]);
      setHasMore(false);
      setNextCursor(null);
      setPinnedMessages([]);

      try {
        const [msgRes, pinnedRes] = await Promise.all([
          fetch(`/api/clans/${clanId}/topics/${topicId}/messages`),
          fetch(`/api/clans/${clanId}/topics/${topicId}/messages?pinned=true`),
        ]);

        if (msgRes.ok) {
          const data = await msgRes.json();
          setMessages(data.messages);
          setHasMore(data.hasMore);
          setNextCursor(data.nextCursor);
        }

        if (pinnedRes.ok) {
          const data = await pinnedRes.json();
          setPinnedMessages(data.messages);
        }
      } catch {
        toast.error("Failed to load messages");
      }
    },
    [clanId]
  );

  async function loadOlderMessages() {
    if (!store.hasMore || !store.nextCursor || !store.currentTopicId) return;
    try {
      const res = await fetch(
        `/api/clans/${clanId}/topics/${store.currentTopicId}/messages?cursor=${store.nextCursor}`
      );
      if (res.ok) {
        const data = await res.json();
        store.prependMessages(data.messages);
        store.setHasMore(data.hasMore);
        store.setNextCursor(data.nextCursor);
      }
    } catch {
      toast.error("Failed to load older messages");
    }
  }

  function handleTopicCreated(topic: ChatTopic) {
    store.addTopic(topic);
  }

  function handleOpenTradeDetail(tradeId: string) {
    setTradeDetailId(tradeId);
    setTradeDetailOpen(true);
  }

  const currentTopicName = store.topics.find(
    (t) => t.id === store.currentTopicId
  )?.name;

  return (
    <div className="flex h-[600px] flex-col rounded-lg border lg:h-[calc(100vh-280px)]">
      <ChatHeader
        topics={store.topics}
        currentTopicId={store.currentTopicId}
        onSelectTopic={handleSwitchTopic}
        onCreateTopic={() => setTopicDialogOpen(true)}
        canManage={canManage}
        onlineUsers={store.onlineUsers}
        isConnected={store.isConnected}
        openPanel={store.openPanel}
        onTogglePanel={(panel) => store.setOpenPanel(panel)}
      />

      {store.pinnedMessages.length > 0 && (
        <PinnedMessages messages={store.pinnedMessages} />
      )}

      <MessageList
        messages={store.messages}
        currentUserId={currentUserId}
        hasMore={store.hasMore}
        onLoadMore={loadOlderMessages}
        canPin={canPin}
        clanId={clanId}
        topicName={currentTopicName}
        highlightMessageId={store.highlightMessageId}
        memberRole={memberRole}
      />

      <TypingIndicator
        typingUsers={store.typingUsers}
        currentUserId={currentUserId}
      />

      <MessageInput
        key={store.editingMessage?.id || "new"}
        clanId={clanId}
        topicId={store.currentTopicId || ""}
        disabled={!store.isConnected}
        onOpenPanel={(panel) => store.setOpenPanel(panel)}
        onOpenTradeCard={() => setTradeCardDialogOpen(true)}
      />

      {/* Dialogs */}
      <TopicManageDialog
        open={topicDialogOpen}
        onOpenChange={setTopicDialogOpen}
        clanId={clanId}
        onTopicCreated={handleTopicCreated}
      />

      <TradeCardComposerDialog
        open={tradeCardDialogOpen}
        onOpenChange={setTradeCardDialogOpen}
        clanId={clanId}
        topicId={store.currentTopicId || ""}
      />

      {/* Sheets — only one open at a time */}
      <LatestTradesSheet
        open={store.openPanel === "trades"}
        onOpenChange={(open) => {
          if (!open) store.setOpenPanel(null);
        }}
        clanId={clanId}
        onOpenDetail={handleOpenTradeDetail}
      />

      <WatchlistSheet
        open={store.openPanel === "watchlist"}
        onOpenChange={(open) => {
          if (!open) store.setOpenPanel(null);
        }}
        clanId={clanId}
      />

      <EventsSheet
        open={store.openPanel === "events"}
        onOpenChange={(open) => {
          if (!open) store.setOpenPanel(null);
        }}
      />

      <SummarySheet
        open={store.openPanel === "summary"}
        onOpenChange={(open) => {
          if (!open) store.setOpenPanel(null);
        }}
        clanId={clanId}
        topicId={store.currentTopicId}
      />

      <TradeCardDetailSheet
        open={tradeDetailOpen}
        onOpenChange={setTradeDetailOpen}
        tradeId={tradeDetailId}
        clanId={clanId}
        currentUserId={currentUserId}
      />
    </div>
  );
}
