import { create } from "zustand";

type NavTab = "chats" | "channels" | "dms";

interface ChatItem {
  clanId: string;
  clanName: string;
  clanAvatar: string | null;
  tradingFocus: string | null;
  memberCount: number;
  role: string;
  unreadCount: number;
  lastMessage: {
    content: string;
    userName: string | null;
    createdAt: string;
  } | null;
  lastActivityAt: string;
}

interface ChannelItem {
  clanId: string;
  clanName: string;
  clanAvatar: string | null;
  tradingFocus: string | null;
  memberCount: number;
  isMember: boolean;
  isFollowing: boolean;
  unreadCount: number;
  lastPost: {
    title: string | null;
    preview: string;
    authorName: string | null;
    createdAt: string;
  } | null;
  lastActivityAt: string;
}

interface DmConvItem {
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

interface NavStore {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;

  search: string;
  setSearch: (s: string) => void;

  chats: ChatItem[];
  setChats: (chats: ChatItem[]) => void;

  channels: ChannelItem[];
  setChannels: (channels: ChannelItem[]) => void;

  dmConversations: DmConvItem[];
  setDmConversations: (dms: DmConvItem[]) => void;

  loading: boolean;
  setLoading: (v: boolean) => void;
}

export const useNavStore = create<NavStore>((set) => ({
  activeTab: "chats",
  setActiveTab: (tab) => set({ activeTab: tab }),

  search: "",
  setSearch: (search) => set({ search }),

  chats: [],
  setChats: (chats) => set({ chats }),

  channels: [],
  setChannels: (channels) => set({ channels }),

  dmConversations: [],
  setDmConversations: (dmConversations) => set({ dmConversations }),

  loading: true,
  setLoading: (loading) => set({ loading }),
}));

export type { ChatItem, ChannelItem, DmConvItem, NavTab };
