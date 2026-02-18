"use client";

import { useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket-client";
import {
  useChatStore,
  type ChatMessage,
  type OnlineUser,
} from "@/stores/chat-store";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { OnlineUsersBar } from "./OnlineUsersBar";
import { PinnedMessages } from "./PinnedMessages";
import { Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

interface ChatPanelProps {
  clanId: string;
  currentUserId: string;
  memberRole: string;
}

export function ChatPanel({
  clanId,
  currentUserId,
  memberRole,
}: ChatPanelProps) {
  const store = useChatStore();
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;
    const {
      setMessages,
      setHasMore,
      setNextCursor,
      setPinnedMessages,
      setConnected,
      addMessage,
      updateMessage,
      addPinnedMessage,
      removePinnedMessage,
      addTypingUser,
      removeTypingUser,
      setOnlineUsers,
      reset,
    } = useChatStore.getState();

    // Fetch initial messages
    async function fetchInitial() {
      try {
        const [msgRes, pinnedRes] = await Promise.all([
          fetch(`/api/clans/${clanId}/messages`),
          fetch(`/api/clans/${clanId}/messages?pinned=true`),
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
        // silent fail on initial load
      }
    }

    socket.connect();
    socket.emit(SOCKET_EVENTS.JOIN_CLAN, clanId);
    fetchInitial();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, (message: ChatMessage) => {
      addMessage(message);
    });

    socket.on(SOCKET_EVENTS.MESSAGE_PINNED, (message: ChatMessage) => {
      updateMessage(message.id, { isPinned: true });
      addPinnedMessage(message);
    });

    socket.on(
      SOCKET_EVENTS.MESSAGE_UNPINNED,
      (data: { id: string }) => {
        updateMessage(data.id, { isPinned: false });
        removePinnedMessage(data.id);
      }
    );

    socket.on(
      SOCKET_EVENTS.USER_TYPING,
      (data: { userId: string; name: string }) => {
        if (data.userId !== currentUserId) {
          addTypingUser(data.userId, data.name);
        }
      }
    );

    socket.on(
      SOCKET_EVENTS.USER_STOP_TYPING,
      (data: { userId: string }) => {
        removeTypingUser(data.userId);
      }
    );

    socket.on(
      SOCKET_EVENTS.PRESENCE_UPDATE,
      (users: OnlineUser[]) => {
        setOnlineUsers(users);
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
      socket.off(SOCKET_EVENTS.MESSAGE_PINNED);
      socket.off(SOCKET_EVENTS.MESSAGE_UNPINNED);
      socket.off(SOCKET_EVENTS.USER_TYPING);
      socket.off(SOCKET_EVENTS.USER_STOP_TYPING);
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE);
      socket.off(SOCKET_EVENTS.ERROR);
      socket.disconnect();
      reset();
    };
  }, [clanId, currentUserId]);

  async function loadOlderMessages() {
    if (!store.hasMore || !store.nextCursor) return;
    try {
      const res = await fetch(
        `/api/clans/${clanId}/messages?cursor=${store.nextCursor}`
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

  const canPin = memberRole === "LEADER" || memberRole === "CO_LEADER";

  return (
    <div className="flex h-[600px] flex-col rounded-lg border lg:h-[calc(100vh-280px)]">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <OnlineUsersBar users={store.onlineUsers} />
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {store.isConnected ? (
            <>
              <Wifi className="h-3 w-3 text-green-500" /> Connected
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-red-500" /> Reconnecting...
            </>
          )}
        </div>
      </div>

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
      />

      <TypingIndicator
        typingUsers={store.typingUsers}
        currentUserId={currentUserId}
      />

      <MessageInput clanId={clanId} disabled={!store.isConnected} />
    </div>
  );
}
