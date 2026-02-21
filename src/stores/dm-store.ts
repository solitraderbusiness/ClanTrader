import { create } from "zustand";

export interface DmMessage {
  id: string;
  conversationId: string;
  content: string;
  senderId: string;
  isEdited: boolean;
  isRead: boolean;
  replyTo: {
    id: string;
    content: string;
    sender: { id: string; name: string | null };
  } | null;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
}

export interface DmConversation {
  id: string;
  otherUser: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  lastMessageAt: string;
}

interface DmStore {
  conversations: DmConversation[];
  setConversations: (convs: DmConversation[]) => void;

  activeRecipientId: string | null;
  setActiveRecipientId: (id: string | null) => void;

  messages: DmMessage[];
  setMessages: (msgs: DmMessage[]) => void;
  addMessage: (msg: DmMessage) => void;
  updateMessage: (id: string, updates: Partial<DmMessage>) => void;
  removeMessage: (id: string) => void;

  replyingTo: DmMessage | null;
  setReplyingTo: (msg: DmMessage | null) => void;

  typingUsers: Map<string, string>;
  setTypingUser: (recipientId: string, userId: string, name: string) => void;
  clearTypingUser: (recipientId: string, userId: string) => void;

  loading: boolean;
  setLoading: (v: boolean) => void;
}

export const useDmStore = create<DmStore>((set) => ({
  conversations: [],
  setConversations: (conversations) => set({ conversations }),

  activeRecipientId: null,
  setActiveRecipientId: (activeRecipientId) => set({ activeRecipientId }),

  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) =>
    set((state) => {
      // Deduplicate by id
      if (state.messages.some((m) => m.id === msg.id)) return state;
      return { messages: [...state.messages, msg] };
    }),
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

  replyingTo: null,
  setReplyingTo: (replyingTo) => set({ replyingTo }),

  typingUsers: new Map(),
  setTypingUser: (recipientId, userId, name) =>
    set((state) => {
      const newMap = new Map(state.typingUsers);
      newMap.set(`${recipientId}:${userId}`, name);
      return { typingUsers: newMap };
    }),
  clearTypingUser: (recipientId, userId) =>
    set((state) => {
      const newMap = new Map(state.typingUsers);
      newMap.delete(`${recipientId}:${userId}`);
      return { typingUsers: newMap };
    }),

  loading: false,
  setLoading: (loading) => set({ loading }),
}));
