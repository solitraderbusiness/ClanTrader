"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavStore } from "@/stores/nav-store";
import { useTranslation } from "@/lib/i18n";

interface MobileTab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function MobileNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { chats } = useNavStore();
  const hasChats = chats.length > 0;
  const totalUnread = chats.reduce((s, c) => s + c.unreadCount, 0);

  const renderedTabs: MobileTab[] = hasChats
    ? [
        { href: "/home", label: t("nav.home"), icon: Home },
        {
          href: "/clans",
          label: t("nav.chats"),
          icon: MessageSquare,
          badge: totalUnread || undefined,
        },
        { href: "/explore", label: t("nav.explore"), icon: Compass },
        { href: "/settings/profile", label: t("nav.profile"), icon: User },
      ]
    : [
        { href: "/home", label: t("nav.home"), icon: Home },
        { href: "/explore", label: t("nav.explore"), icon: Compass },
        { href: "/settings/profile", label: t("nav.profile"), icon: User },
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden">
      <div className="flex items-center justify-around">
        {renderedTabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="absolute -top-0.5 end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
