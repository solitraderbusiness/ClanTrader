"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search } from "lucide-react";

interface SearchUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  tradingStyle: string | null;
}

interface StartDmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StartDmDialog({ open, onOpenChange }: StartDmDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.users || []);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    // Debounce using timeout in a simple way
    const timeout = setTimeout(() => searchUsers(value), 300);
    return () => clearTimeout(timeout);
  }

  function handleSelect(userId: string) {
    onOpenChange(false);
    setQuery("");
    setResults([]);
    router.push(`/dm/${userId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="ps-8"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto">
          {loading && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Searching...
            </p>
          )}
          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No users found
            </p>
          )}
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => handleSelect(user.id)}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-start hover:bg-accent"
            >
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar || undefined} alt={user.name || ""} />
                <AvatarFallback className="text-xs">
                  {(user.name || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.name || "Unknown"}
                  {user.username && (
                    <span className="ms-1 font-normal text-muted-foreground">
                      @{user.username}
                    </span>
                  )}
                </p>
                {user.tradingStyle && (
                  <p className="truncate text-xs text-muted-foreground">
                    {user.tradingStyle}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
