"use client";

import { useState } from "react";
import { Menu, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { FontSwitch } from "@/components/ui/font-switch";
import { UserMenu } from "./UserMenu";
import { useSidebarStore } from "@/stores/sidebar-store";
import { InviteFriendDialog } from "@/components/shared/InviteFriendDialog";

export function TopBar() {
  const { open } = useSidebarStore();
  const [inviteOpen, setInviteOpen] = useState(false);

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
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setInviteOpen(true)}
          title="Invite a friend"
        >
          <UserPlus className="h-4 w-4" />
        </Button>
        <FontSwitch />
        <ThemeToggle />
        <UserMenu />
      </div>

      <InviteFriendDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </header>
  );
}
