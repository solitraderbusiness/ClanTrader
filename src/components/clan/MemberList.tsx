"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserMinus, Crown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getInitials } from "@/lib/utils";

interface Member {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    avatar: string | null;
    tradingStyle: string | null;
  };
}

interface MemberListProps {
  clanId: string;
  members: Member[];
  currentUserRole: string;
  currentUserId: string;
}

const ROLE_BADGE_VARIANT: Record<
  string,
  "default" | "secondary" | "outline"
> = {
  LEADER: "default",
  CO_LEADER: "secondary",
  MEMBER: "outline",
};

export function MemberList({
  clanId,
  members,
  currentUserRole,
  currentUserId,
}: MemberListProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { t } = useTranslation();

  async function handleRoleChange(userId: string, newRole: string) {
    setLoadingId(userId);
    try {
      const res = await fetch(`/api/clans/${clanId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        toast.success(t("clan.roleUpdated"));
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || t("clan.failedUpdateRole"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      setLoadingId(null);
    }
  }

  async function handleTransferLeadership(userId: string, name: string) {
    const msg = t("clan.confirmTransferLeadership").replace("{name}", name);
    if (!confirm(msg)) return;

    setLoadingId(userId);
    try {
      const res = await fetch(`/api/clans/${clanId}/transfer-leadership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newLeaderUserId: userId }),
      });

      if (res.ok) {
        toast.success(t("clan.leadershipTransferred"));
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || t("clan.failedTransferLeadership"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      setLoadingId(null);
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm(t("clan.confirmRemoveMember"))) return;

    setLoadingId(userId);
    try {
      const res = await fetch(`/api/clans/${clanId}/members/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(t("clan.memberRemoved"));
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || t("clan.failedRemoveMember"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      setLoadingId(null);
    }
  }

  function canRemove(member: Member): boolean {
    if (member.userId === currentUserId) return false;
    if (currentUserRole === "LEADER") return member.role !== "LEADER";
    if (currentUserRole === "CO_LEADER") return member.role === "MEMBER";
    return false;
  }

  function canChangeRole(member: Member): boolean {
    return (
      currentUserRole === "LEADER" &&
      member.role !== "LEADER" &&
      member.userId !== currentUserId
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.id}
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={member.user.avatar || undefined}
              alt={member.user.name || ""}
            />
            <AvatarFallback>
              {getInitials(member.user.name || "?")}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">
                {member.user.name || "Unknown"}
              </span>
              <Badge variant={ROLE_BADGE_VARIANT[member.role] || "outline"}>
                {member.role}
              </Badge>
            </div>
            {member.user.username && (
              <p className="text-xs text-muted-foreground">
                @{member.user.username}
              </p>
            )}
            {member.user.tradingStyle && (
              <p className="text-xs text-muted-foreground">
                {member.user.tradingStyle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canChangeRole(member) && (
              <select
                value={member.role}
                onChange={(e) =>
                  handleRoleChange(member.userId, e.target.value)
                }
                disabled={loadingId === member.userId}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="CO_LEADER">{t("clan.coLeader")}</option>
                <option value="MEMBER">{t("clan.member")}</option>
              </select>
            )}

            {canChangeRole(member) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  handleTransferLeadership(
                    member.userId,
                    member.user.name || "Unknown"
                  )
                }
                disabled={loadingId === member.userId}
                className="h-8 w-8"
                title={t("clan.transferLeadership")}
              >
                <Crown className="h-4 w-4" />
              </Button>
            )}

            {canRemove(member) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(member.userId)}
                disabled={loadingId === member.userId}
                className="h-8 w-8 text-destructive hover:text-destructive"
              >
                <UserMinus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
