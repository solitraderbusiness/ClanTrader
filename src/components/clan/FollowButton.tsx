"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";

interface FollowButtonProps {
  clanId: string;
  initialFollowing: boolean;
}

export function FollowButton({ clanId, initialFollowing }: FollowButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/follow`, {
        method: following ? "DELETE" : "POST",
      });

      if (res.ok) {
        setFollowing(!following);
        router.refresh();
      } else {
        toast.error("Failed to update follow status");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={following ? "secondary" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
    >
      <Heart
        className={`me-1 h-4 w-4 ${following ? "fill-current" : ""}`}
      />
      {following ? "Following" : "Follow"}
    </Button>
  );
}
