"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface JoinClanButtonProps {
  clanId: string;
  isMember: boolean;
  isLeader: boolean;
  isFull: boolean;
  isPublic: boolean;
  currentUserId: string;
}

export function JoinClanButton({
  clanId,
  isMember,
  isLeader,
  isFull,
  isPublic,
  currentUserId,
}: JoinClanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/members`, {
        method: "POST",
      });

      if (res.ok) {
        toast.success("Joined clan!");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to join clan");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave() {
    if (!confirm("Are you sure you want to leave this clan?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/members/${currentUserId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("Left clan");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to leave clan");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (isMember && isLeader) {
    return (
      <Button variant="outline" disabled>
        Leader
      </Button>
    );
  }

  if (isMember) {
    return (
      <Button variant="outline" onClick={handleLeave} disabled={loading}>
        {loading ? "Leaving..." : "Leave Clan"}
      </Button>
    );
  }

  if (isFull) {
    return (
      <Button variant="outline" disabled>
        Clan Full
      </Button>
    );
  }

  if (!isPublic) {
    return (
      <Button variant="outline" disabled>
        Invite Only
      </Button>
    );
  }

  return (
    <Button onClick={handleJoin} disabled={loading}>
      {loading ? "Joining..." : "Join Clan"}
    </Button>
  );
}
