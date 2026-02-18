"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { REACTION_EMOJIS } from "@/lib/clan-constants";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface ReactionBarProps {
  postId: string;
  clanId: string;
  reactions: Record<string, string[]>;
  currentUserId: string | null;
}

export function ReactionBar({
  postId,
  clanId,
  reactions,
  currentUserId,
}: ReactionBarProps) {
  const router = useRouter();
  const [localReactions, setLocalReactions] =
    useState<Record<string, string[]>>(reactions);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleToggle(emoji: string) {
    if (!currentUserId) {
      toast.error("Sign in to react");
      return;
    }

    setLoading(true);

    // Optimistic update
    setLocalReactions((prev) => {
      const current = prev[emoji] || [];
      if (current.includes(currentUserId)) {
        const next = current.filter((id) => id !== currentUserId);
        if (next.length === 0) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [emoji]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [emoji]: next };
      }
      return { ...prev, [emoji]: [...current, currentUserId] };
    });

    try {
      const res = await fetch(
        `/api/clans/${clanId}/posts/${postId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setLocalReactions(data.reactions || {});
        router.refresh();
      } else {
        // Revert optimistic update
        setLocalReactions(reactions);
        toast.error("Failed to update reaction");
      }
    } catch {
      setLocalReactions(reactions);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const activeEmojis = Object.entries(localReactions).filter(
    ([, users]) => users.length > 0
  );

  return (
    <div className="flex flex-wrap items-center gap-1">
      {activeEmojis.map(([emoji, users]) => {
        const isActive = currentUserId
          ? users.includes(currentUserId)
          : false;

        return (
          <button
            key={emoji}
            onClick={() => handleToggle(emoji)}
            disabled={loading}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
              isActive
                ? "border-primary bg-primary/10"
                : "border-input hover:bg-accent"
            }`}
          >
            <span>{emoji}</span>
            <span>{users.length}</span>
          </button>
        );
      })}

      {/* Add reaction picker */}
      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowPicker(!showPicker)}
          disabled={loading || !currentUserId}
        >
          <Plus className="h-3 w-3" />
        </Button>

        {showPicker && (
          <div className="absolute bottom-full start-0 z-10 mb-1 flex gap-1 rounded-lg border bg-popover p-2 shadow-md">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  handleToggle(emoji);
                  setShowPicker(false);
                }}
                className="rounded p-1 text-lg hover:bg-accent"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
