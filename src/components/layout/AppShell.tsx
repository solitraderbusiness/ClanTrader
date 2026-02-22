"use client";

import { useSession } from "next-auth/react";
import { LeftPanel } from "./LeftPanel";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { useSidebarStore } from "@/stores/sidebar-store";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { SetUsernameDialog } from "@/components/shared/SetUsernameDialog";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isOpen, close } = useSidebarStore();
  const { data: session } = useSession();

  const needsUsername = session?.user && !session.user.username;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop left panel */}
      <aside className="hidden lg:flex lg:w-[320px] lg:flex-col lg:border-e">
        <LeftPanel />
      </aside>

      {/* Mobile left panel (sheet) */}
      <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
        <SheetContent side="left" className="w-full max-w-[320px] p-0">
          <VisuallyHidden>
            <SheetTitle>Navigation</SheetTitle>
          </VisuallyHidden>
          <LeftPanel />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-20 lg:pb-4">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />

      {/* Prompt existing users to set username */}
      {needsUsername && <SetUsernameDialog />}
    </div>
  );
}
