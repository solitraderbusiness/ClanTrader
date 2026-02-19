import { create } from "zustand";

export interface TradeCardData {
  id: string;
  instrument: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  targets: number[];
  timeframe: string;
  riskPct: number | null;
  note: string | null;
  tags: string[];
  trade: { id: string; status: string; userId: string } | null;
}

export interface ChatMessage {
  id: string;
  clanId: string;
  topicId: string | null;
  content: string;
  type: "TEXT" | "TRADE_CARD" | "SYSTEM_SUMMARY" | "TRADE_ACTION";
  isPinned: boolean;
  isEdited: boolean;
  reactions: Record<string, string[]> | null;
  replyTo: {
    id: string;
    content: string;
    user: { id: string; name: string | null };
  } | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    avatar: string | null;
    role?: string;
  };
  tradeCard: TradeCardData | null;
}

export interface OnlineUser {
  id: string;
  name: string | null;
  role?: string;
}

export interface ClanMember {
  id: string;
  name: string | null;
  avatar: string | null;
  role?: string;
  memberRole?: string;
}

export interface ChatTopic {
  id: string;
  clanId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  status: string;
  sortOrder: number;
}

type OpenPanel = "trades" | "watchlist" | "events" | "summary" | null;

interface ChatState {
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  // Topic state
  currentTopicId: string | null;
  setCurrentTopicId: (topicId: string | null) => void;
  topics: ChatTopic[];
  setTopics: (topics: ChatTopic[]) => void;
  addTopic: (topic: ChatTopic) => void;
  updateTopic: (id: string, updates: Partial<ChatTopic>) => void;
  removeTopic: (id: string) => void;

  // Panel state
  openPanel: OpenPanel;
  setOpenPanel: (panel: OpenPanel) => void;

  // Highlight state (for jump-to-message)
  highlightMessageId: string | null;
  setHighlightMessageId: (id: string | null) => void;

  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;

  hasMore: boolean;
  nextCursor: string | null;
  setHasMore: (hasMore: boolean) => void;
  setNextCursor: (cursor: string | null) => void;
  prependMessages: (messages: ChatMessage[]) => void;

  pinnedMessages: ChatMessage[];
  setPinnedMessages: (messages: ChatMessage[]) => void;
  addPinnedMessage: (message: ChatMessage) => void;
  removePinnedMessage: (messageId: string) => void;

  typingUsers: Map<string, string>;
  addTypingUser: (userId: string, name: string) => void;
  removeTypingUser: (userId: string) => void;

  onlineUsers: OnlineUser[];
  setOnlineUsers: (users: OnlineUser[]) => void;

  // Reply state
  replyingTo: ChatMessage | null;
  setReplyingTo: (message: ChatMessage | null) => void;

  // Edit state
  editingMessage: ChatMessage | null;
  setEditingMessage: (message: ChatMessage | null) => void;

  // Clan members (for @mentions)
  clanMembers: ClanMember[];
  setClanMembers: (members: ClanMember[]) => void;

  // Trade card status update
  updateTradeCardStatus: (messageId: string, trade: { id: string; status: string; userId: string }) => void;

  reset: () => void;
}

const initialState = {
  isConnected: false,
  currentTopicId: null as string | null,
  topics: [] as ChatTopic[],
  openPanel: null as OpenPanel,
  highlightMessageId: null as string | null,
  messages: [] as ChatMessage[],
  hasMore: false,
  nextCursor: null as string | null,
  pinnedMessages: [] as ChatMessage[],
  typingUsers: new Map<string, string>(),
  onlineUsers: [] as OnlineUser[],
  replyingTo: null as ChatMessage | null,
  editingMessage: null as ChatMessage | null,
  clanMembers: [] as ClanMember[],
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ isConnected: connected }),

  // Topic actions
  setCurrentTopicId: (topicId) => set({ currentTopicId: topicId }),
  setTopics: (topics) => set({ topics }),
  addTopic: (topic) =>
    set((state) => ({ topics: [...state.topics, topic] })),
  updateTopic: (id, updates) =>
    set((state) => ({
      topics: state.topics.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  removeTopic: (id) =>
    set((state) => ({
      topics: state.topics.filter((t) => t.id !== id),
    })),

  // Panel actions
  setOpenPanel: (panel) =>
    set((state) => ({
      openPanel: state.openPanel === panel ? null : panel,
    })),

  // Highlight actions
  setHighlightMessageId: (id) => set({ highlightMessageId: id }),

  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),
  removeMessage: (id) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    })),

  setHasMore: (hasMore) => set({ hasMore }),
  setNextCursor: (nextCursor) => set({ nextCursor }),
  prependMessages: (messages) =>
    set((state) => ({ messages: [...messages, ...state.messages] })),

  setPinnedMessages: (messages) => set({ pinnedMessages: messages }),
  addPinnedMessage: (message) =>
    set((state) => ({
      pinnedMessages: [...state.pinnedMessages, message],
    })),
  removePinnedMessage: (messageId) =>
    set((state) => ({
      pinnedMessages: state.pinnedMessages.filter((m) => m.id !== messageId),
    })),

  addTypingUser: (userId, name) =>
    set((state) => {
      const newMap = new Map(state.typingUsers);
      newMap.set(userId, name);
      return { typingUsers: newMap };
    }),
  removeTypingUser: (userId) =>
    set((state) => {
      const newMap = new Map(state.typingUsers);
      newMap.delete(userId);
      return { typingUsers: newMap };
    }),

  setOnlineUsers: (users) => set({ onlineUsers: users }),

  setReplyingTo: (message) => set({ replyingTo: message, editingMessage: null }),
  setEditingMessage: (message) => set({ editingMessage: message, replyingTo: null }),

  setClanMembers: (members) => set({ clanMembers: members }),

  updateTradeCardStatus: (messageId, trade) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId && m.tradeCard
          ? { ...m, tradeCard: { ...m.tradeCard, trade } }
          : m
      ),
    })),

  reset: () => set({ ...initialState, typingUsers: new Map() }),
}));
