"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

interface InviteJoinButtonProps {
  code: string;
  isLoggedIn: boolean;
  isMember: boolean;
}

export function InviteJoinButton({
  code,
  isLoggedIn,
  isMember,
}: InviteJoinButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (!isLoggedIn) {
    return (
      <Button asChild className="w-full">
        <Link href={`/login?callbackUrl=/invite/${code}`}>
          Login to Join
        </Link>
      </Button>
    );
  }

  if (isMember) {
    return (
      <Button disabled className="w-full" variant="outline">
        Already a Member
      </Button>
    );
  }

  async function handleJoin() {
    setLoading(true);
    try {
      const res = await fetch(`/api/invites/${code}`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("Joined clan!");
        router.push(`/clans/${data.clan.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to join");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleJoin} disabled={loading} className="w-full">
      {loading ? "Joining..." : "Accept Invite"}
    </Button>
  );
}
