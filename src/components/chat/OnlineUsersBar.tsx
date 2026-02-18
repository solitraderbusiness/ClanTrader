"use client";

import type { OnlineUser } from "@/stores/chat-store";
import { Users } from "lucide-react";

interface OnlineUsersBarProps {
  users: OnlineUser[];
}

export function OnlineUsersBar({ users }: OnlineUsersBarProps) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Users className="h-3.5 w-3.5" />
      <span className="font-medium">{users.length} online</span>
      {users.length > 0 && users.length <= 5 && (
        <span className="truncate">
          ({users.map((u) => u.name || "Unknown").join(", ")})
        </span>
      )}
    </div>
  );
}
