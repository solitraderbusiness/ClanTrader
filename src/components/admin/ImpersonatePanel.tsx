"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isPro: boolean;
  avatar: string | null;
  clanCount: number;
}

interface ImpersonatePanelProps {
  users: User[];
  currentUserId: string;
}

export function ImpersonatePanel({
  users,
  currentUserId,
}: ImpersonatePanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleImpersonate(userId: string, userName: string | null) {
    setLoading(userId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (res.ok) {
        toast.success(`Switched to ${userName || "user"}`);
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to impersonate");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((user) => {
        const isCurrent = user.id === currentUserId;
        return (
          <div
            key={user.id}
            className={`flex items-center gap-3 rounded-lg border p-4 ${
              isCurrent ? "border-primary bg-primary/5" : ""
            }`}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={user.avatar || undefined}
                alt={user.name || ""}
              />
              <AvatarFallback>
                {(user.name || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">
                  {user.name || "Unknown"}
                </span>
                {isCurrent && (
                  <Badge variant="default" className="text-xs">
                    You
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {user.role}
                </Badge>
                {user.isPro && (
                  <Badge variant="secondary" className="text-xs">
                    PRO
                  </Badge>
                )}
                {user.clanCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {user.clanCount} clan{user.clanCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
            {!isCurrent && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading === user.id}
                onClick={() => handleImpersonate(user.id, user.name)}
              >
                <UserCheck className="me-1 h-3 w-3" />
                {loading === user.id ? "..." : "Switch"}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
