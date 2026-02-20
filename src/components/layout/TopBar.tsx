"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FontSwitch } from "@/components/ui/font-switch";
import { UserMenu } from "./UserMenu";
import { useSidebarStore } from "@/stores/sidebar-store";

export function TopBar() {
  const { open } = useSidebarStore();

  return (
    <header className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={open}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <FontSwitch />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
