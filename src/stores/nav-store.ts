import { create } from "zustand";

type NavTab = "chats" | "channels";

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

interface NavStore {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;

  search: string;
  setSearch: (s: string) => void;

  chats: ChatItem[];
  setChats: (chats: ChatItem[]) => void;

  channels: ChannelItem[];
  setChannels: (channels: ChannelItem[]) => void;

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

  loading: true,
  setLoading: (loading) => set({ loading }),
}));

export type { ChatItem, ChannelItem, NavTab };
