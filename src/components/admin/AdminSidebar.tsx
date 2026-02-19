"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Flag, Shield, CreditCard, ScrollText, Trophy, MessageSquare, Database, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/feature-flags", label: "Feature Flags", icon: Flag },
  { href: "/admin/paywall", label: "Paywall Rules", icon: Shield },
  { href: "/admin/plans", label: "Plans", icon: CreditCard },
  { href: "/admin/ranking", label: "Ranking", icon: Trophy },
  { href: "/admin/clans", label: "Clans", icon: MessageSquare },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/admin/demo-data", label: "Demo Data", icon: Database },
  { href: "/admin/testing", label: "Test Runner", icon: FlaskConical },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-accent font-medium text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
