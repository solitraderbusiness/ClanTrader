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
  joinRequestsEnabled: boolean;
  existingRequestStatus: string | null;
  isInAnotherClan: boolean;
}

export function JoinClanButton({
  clanId,
  isMember,
  isLeader,
  isFull,
  isPublic: _isPublic,
  currentUserId,
  joinRequestsEnabled,
  existingRequestStatus,
  isInAnotherClan,
}: JoinClanButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRequestJoin() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        toast.success("Join request sent!");
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send request");
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

  if (isInAnotherClan) {
    return (
      <Button variant="outline" disabled>
        Leave your clan first
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

  if (existingRequestStatus === "PENDING") {
    return (
      <Button variant="outline" disabled>
        Request Pending
      </Button>
    );
  }

  if (joinRequestsEnabled) {
    return (
      <Button onClick={handleRequestJoin} disabled={loading}>
        {loading ? "Sending..." : "Request to Join"}
      </Button>
    );
  }

  // Not public and no join requests — invite only
  return (
    <Button variant="outline" disabled>
      Invite Only
    </Button>
  );
}
