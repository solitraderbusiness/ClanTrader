"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Flag,
  Shield,
  CreditCard,
  ScrollText,
  Trophy,
  Award,
  MessageSquare,
  Link2,
  Database,
  FlaskConical,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Dashboard",
    desc: "Overview & stats",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/feature-flags",
    label: "Feature Flags",
    desc: "Toggle platform features",
    icon: Flag,
  },
  {
    href: "/admin/paywall",
    label: "Paywall Rules",
    desc: "Content access control",
    icon: Shield,
  },
  {
    href: "/admin/plans",
    label: "Plans",
    desc: "Subscription pricing",
    icon: CreditCard,
  },
  {
    href: "/admin/ranking",
    label: "Ranking",
    desc: "Leaderboard weights",
    icon: Trophy,
  },
  {
    href: "/admin/badges",
    label: "Badges",
    desc: "Rank & achievement badges",
    icon: Award,
  },
  {
    href: "/admin/clans",
    label: "Clans",
    desc: "Manage & feature clans",
    icon: MessageSquare,
  },
  {
    href: "/admin/referrals",
    label: "Referrals",
    desc: "Invite analytics",
    icon: Link2,
  },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    desc: "Activity history",
    icon: ScrollText,
  },
  {
    href: "/admin/demo-data",
    label: "Demo Data",
    desc: "Generate test data",
    icon: Database,
  },
  {
    href: "/admin/testing",
    label: "Test Runner",
    desc: "E2E test execution",
    icon: FlaskConical,
  },
  {
    href: "/admin/impersonate",
    label: "Switch User",
    desc: "Dev: impersonate users",
    icon: UserCheck,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive && "text-primary")} />
            <div className="min-w-0">
              <p className="truncate leading-tight">{item.label}</p>
              <p className="truncate text-[10px] opacity-60">{item.desc}</p>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
