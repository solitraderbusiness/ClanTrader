"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUsernamePromptStore } from "@/stores/username-prompt-store";
import { useTranslation } from "@/lib/i18n";
import { SwitchClanModal } from "@/components/clan/SwitchClanModal";

interface CurrentClanInfo {
  id: string;
  name: string;
  memberCount: number;
  userRole: string;
  members?: { userId: string; name: string }[];
}

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
  currentClanInfo?: CurrentClanInfo | null;
  targetClanName?: string;
}

export function JoinClanButton({
  clanId,
  isMember,
  isLeader,
  isFull,
  currentUserId,
  joinRequestsEnabled,
  existingRequestStatus,
  isInAnotherClan,
  currentClanInfo,
  targetClanName,
}: JoinClanButtonProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [switchModalOpen, setSwitchModalOpen] = useState(false);
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
    const isSoloLeader = isLeader && currentClanInfo?.memberCount === 1;
    const confirmMsg = isSoloLeader
      ? t("clan.confirmLeaveSoloLeader")
      : t("clan.confirmLeave");
    if (!confirm(confirmMsg)) return;

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

  // Solo leader of this clan — can leave (dissolves)
  if (isLeader && isMember && currentClanInfo?.memberCount === 1) {
    return (
      <Button variant="outline" onClick={handleLeave} disabled={loading}>
        {loading ? t("clan.leaving") : t("clan.leaveClan")}
      </Button>
    );
  }

  // Leader with other members — can't leave directly
  if (isMember && isLeader) {
    return (
      <Button variant="outline" disabled>
        {t("clan.leader")}
      </Button>
    );
  }

  // Regular member — can leave
  if (isMember) {
    return (
      <Button variant="outline" onClick={handleLeave} disabled={loading}>
        {loading ? t("clan.leaving") : t("clan.leaveClan")}
      </Button>
    );
  }

  // User is in another clan — show Switch Clan button
  if (isInAnotherClan && currentClanInfo) {
    return (
      <>
        <Button variant="outline" onClick={() => setSwitchModalOpen(true)}>
          {t("clan.switchClan")}
        </Button>
        <SwitchClanModal
          open={switchModalOpen}
          onOpenChange={setSwitchModalOpen}
          currentClan={currentClanInfo}
          currentUserId={currentUserId}
          targetClan={{ id: clanId, name: targetClanName || "" }}
          mode="join"
        />
      </>
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
