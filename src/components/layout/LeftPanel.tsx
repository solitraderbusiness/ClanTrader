"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Home,
  Compass,
  Settings,
  ShieldCheck,
  Search,
  MessageSquare,
  Megaphone,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavStore, type ChatItem, type ChannelItem } from "@/stores/nav-store";
import { useSidebarStore } from "@/stores/sidebar-store";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function LeftPanel() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { close: closeSidebar } = useSidebarStore();
  const {
    activeTab,
    setActiveTab,
    search,
    setSearch,
    chats,
    setChats,
    channels,
    setChannels,
    loading,
    setLoading,
  } = useNavStore();

  const isAdmin = session?.user?.role === "ADMIN";
  const hasChats = chats.length > 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [chatsRes, channelsRes] = await Promise.all([
        fetch("/api/me/chats"),
        fetch("/api/me/channels"),
      ]);
      if (chatsRes.ok) {
        const data = await chatsRes.json();
        setChats(data.chats || []);
      }
      if (channelsRes.ok) {
        const data = await channelsRes.json();
        setChannels(data.channels || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [setChats, setChannels, setLoading]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchData();
      // Refresh every 30s
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [session?.user?.id, fetchData]);

  // If user has no chats, default to channels tab
  useEffect(() => {
    if (!loading && !hasChats && activeTab === "chats") {
      setActiveTab("channels");
    }
  }, [loading, hasChats, activeTab, setActiveTab]);

  const filteredChats = search
    ? chats.filter((c) =>
        c.clanName.toLowerCase().includes(search.toLowerCase())
      )
    : chats;

  const filteredChannels = search
    ? channels.filter((c) =>
        c.clanName.toLowerCase().includes(search.toLowerCase())
      )
    : channels;

  function navigateTo(href: string) {
    closeSidebar();
    router.push(href);
  }

  const totalUnreadChats = chats.reduce((s, c) => s + c.unreadCount, 0);
  const totalUnreadChannels = channels.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar: logo + icon nav */}
      <div className="flex items-center justify-between border-b px-3 h-14">
        <Link
          href="/home"
          className="flex items-center gap-2"
          onClick={() => closeSidebar()}
        >
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-base font-bold">ClanTrader</span>
        </Link>
        <div className="flex items-center gap-0.5">
          <NavIcon
            icon={Home}
            label="Home"
            active={pathname === "/home"}
            onClick={() => navigateTo("/home")}
          />
          <NavIcon
            icon={Compass}
            label="Explore"
            active={pathname.startsWith("/explore")}
            onClick={() => navigateTo("/explore")}
          />
          <NavIcon
            icon={Settings}
            label="Settings"
            active={pathname.startsWith("/settings")}
            onClick={() => navigateTo("/settings")}
          />
          {isAdmin && (
            <NavIcon
              icon={ShieldCheck}
              label="Admin"
              active={pathname.startsWith("/admin")}
              onClick={() => navigateTo("/admin")}
            />
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b px-3">
        {hasChats && (
          <button
            onClick={() => setActiveTab("chats")}
            className={cn(
              "relative flex-1 py-2.5 text-center text-sm font-medium transition-colors",
              activeTab === "chats"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="flex items-center justify-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Chats
              {totalUnreadChats > 0 && (
                <Badge
                  variant="destructive"
                  className="h-5 min-w-5 px-1 text-[10px] leading-none"
                >
                  {totalUnreadChats > 99 ? "99+" : totalUnreadChats}
                </Badge>
              )}
            </span>
            {activeTab === "chats" && (
              <span className="absolute bottom-0 inset-x-0 h-0.5 bg-primary" />
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab("channels")}
          className={cn(
            "relative flex-1 py-2.5 text-center text-sm font-medium transition-colors",
            activeTab === "channels"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Megaphone className="h-4 w-4" />
            Channels
            {totalUnreadChannels > 0 && (
              <Badge
                variant="destructive"
                className="h-5 min-w-5 px-1 text-[10px] leading-none"
              >
                {totalUnreadChannels > 99 ? "99+" : totalUnreadChannels}
              </Badge>
            )}
          </span>
          {activeTab === "channels" && (
            <span className="absolute bottom-0 inset-x-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : activeTab === "chats" ? (
          filteredChats.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No chats yet"
              description="Join a clan to start chatting with other traders."
              ctaLabel="Explore Clans"
              ctaHref="/explore"
              onNavigate={navigateTo}
            />
          ) : (
            <div className="py-1">
              {filteredChats.map((chat) => (
                <ChatListItem
                  key={chat.clanId}
                  chat={chat}
                  active={pathname === `/clans/${chat.clanId}`}
                  onClick={() => navigateTo(`/clans/${chat.clanId}?tab=chat`)}
                />
              ))}
            </div>
          )
        ) : filteredChannels.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No channels yet"
            description="Follow clans to see their channel posts here."
            ctaLabel="Explore"
            ctaHref="/explore"
            onNavigate={navigateTo}
          />
        ) : (
          <div className="py-1">
            {filteredChannels.map((ch) => (
              <ChannelListItem
                key={ch.clanId}
                channel={ch}
                active={pathname === `/clans/${ch.clanId}`}
                onClick={() => navigateTo(`/clans/${ch.clanId}?tab=channel`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function NavIcon({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ChatListItem({
  chat,
  active,
  onClick,
}: {
  chat: ChatItem;
  active: boolean;
  onClick: () => void;
}) {
  const hasUnread = chat.unreadCount > 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors",
        active ? "bg-accent" : "hover:bg-accent/50"
      )}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={chat.clanAvatar || undefined} alt={chat.clanName} />
        <AvatarFallback className="text-xs">
          {getInitials(chat.clanName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "truncate text-sm",
              hasUnread ? "font-semibold" : "font-medium"
            )}
          >
            {chat.clanName}
          </span>
          {chat.lastMessage && (
            <span className="flex-shrink-0 text-[11px] text-muted-foreground">
              {timeAgo(chat.lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p
            className={cn(
              "truncate text-xs",
              hasUnread ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {chat.lastMessage
              ? `${chat.lastMessage.userName || "Someone"}: ${chat.lastMessage.content}`
              : "No messages yet"}
          </p>
          {hasUnread && (
            <Badge
              variant="destructive"
              className="ms-2 h-5 min-w-5 flex-shrink-0 px-1 text-[10px] leading-none"
            >
              {chat.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function ChannelListItem({
  channel,
  active,
  onClick,
}: {
  channel: ChannelItem;
  active: boolean;
  onClick: () => void;
}) {
  const hasUnread = channel.unreadCount > 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-start transition-colors",
        active ? "bg-accent" : "hover:bg-accent/50"
      )}
    >
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage
          src={channel.clanAvatar || undefined}
          alt={channel.clanName}
        />
        <AvatarFallback className="text-xs">
          {getInitials(channel.clanName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "truncate text-sm",
              hasUnread ? "font-semibold" : "font-medium"
            )}
          >
            {channel.clanName}
          </span>
          {channel.lastPost && (
            <span className="flex-shrink-0 text-[11px] text-muted-foreground">
              {timeAgo(channel.lastPost.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p
            className={cn(
              "truncate text-xs",
              hasUnread ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {channel.lastPost
              ? channel.lastPost.preview
              : "No posts yet"}
          </p>
          {hasUnread && (
            <Badge
              variant="destructive"
              className="ms-2 h-5 min-w-5 flex-shrink-0 px-1 text-[10px] leading-none"
            >
              {channel.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  onNavigate,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  onNavigate: (href: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => onNavigate(ctaHref)}>
        {ctaLabel}
      </Button>
    </div>
  );
}
