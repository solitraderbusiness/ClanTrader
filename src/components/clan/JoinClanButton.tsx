"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUsernamePromptStore } from "@/stores/username-prompt-store";
import { useTranslation } from "@/lib/i18n";

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
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const openUsernamePrompt = useUsernamePromptStore((s) => s.open);
  const { t } = useTranslation();

  async function handleRequestJoin() {
    // Require username before joining a clan
    if (!session?.user?.username) {
      openUsernamePrompt();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/join-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        toast.success(t("clan.joinRequestSent"));
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || t("clan.failedSendRequest"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave() {
    if (!confirm(t("clan.confirmLeave"))) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/members/${currentUserId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(t("clan.leftClan"));
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || t("clan.failedLeaveClan"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  if (isMember && isLeader) {
    return (
      <Button variant="outline" disabled>
        {t("clan.leader")}
      </Button>
    );
  }

  if (isMember) {
    return (
      <Button variant="outline" onClick={handleLeave} disabled={loading}>
        {loading ? t("clan.leaving") : t("clan.leaveClan")}
      </Button>
    );
  }

  if (isInAnotherClan) {
    return (
      <Button variant="outline" disabled>
        {t("clan.leaveFirst")}
      </Button>
    );
  }

  if (isFull) {
    return (
      <Button variant="outline" disabled>
        {t("clan.clanFull")}
      </Button>
    );
  }

  if (existingRequestStatus === "PENDING") {
    return (
      <Button variant="outline" disabled>
        {t("clan.requestPending")}
      </Button>
    );
  }

  if (joinRequestsEnabled) {
    return (
      <Button onClick={handleRequestJoin} disabled={loading}>
        {loading ? t("clan.sending") : t("clan.requestToJoin")}
      </Button>
    );
  }

  // Not public and no join requests — invite only
  return (
    <Button variant="outline" disabled>
      {t("clan.inviteOnly")}
    </Button>
  );
}
