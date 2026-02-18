import { create } from "zustand";

export interface ChatMessage {
  id: string;
  clanId: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
}

export interface OnlineUser {
  id: string;
  name: string | null;
}

interface ChatState {
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  messages: ChatMessage[];
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;

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

  reset: () => void;
}

const initialState = {
  isConnected: false,
  messages: [] as ChatMessage[],
  hasMore: false,
  nextCursor: null as string | null,
  pinnedMessages: [] as ChatMessage[],
  typingUsers: new Map<string, string>(),
  onlineUsers: [] as OnlineUser[],
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ isConnected: connected }),

  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
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

  reset: () => set({ ...initialState, typingUsers: new Map() }),
}));
