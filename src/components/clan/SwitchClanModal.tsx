"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

interface CurrentClanInfo {
  id: string;
  name: string;
  memberCount: number;
  userRole: string;
  members?: { userId: string; name: string }[];
}

interface TargetClanInfo {
  id: string;
  name: string;
}

interface SwitchClanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentClan: CurrentClanInfo;
  currentUserId: string;
  targetClan: TargetClanInfo | null;
  mode: "join" | "create";
}

type Scenario = "simple" | "dissolve" | "transfer";

function getScenario(currentClan: CurrentClanInfo): Scenario {
  if (currentClan.userRole !== "LEADER") return "simple";
  if (currentClan.memberCount === 1) return "dissolve";
  return "transfer";
}

export function SwitchClanModal({
  open,
  onOpenChange,
  currentClan,
  currentUserId,
  targetClan,
  mode,
}: SwitchClanModalProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [selectedLeader, setSelectedLeader] = useState("");

  const scenario = getScenario(currentClan);
  const targetName = targetClan?.name ?? t("clan.create");

  function getDescription() {
    switch (scenario) {
      case "simple":
        return t("clan.switchClanMemberDesc")
          .replace("{current}", currentClan.name)
          .replace("{target}", targetName);
      case "dissolve":
        return t("clan.switchClanSoloLeaderDesc").replace("{current}", currentClan.name);
      case "transfer":
        return t("clan.switchClanLeaderDesc").replace("{current}", currentClan.name);
    }
  }

  function getActionLabel() {
    if (scenario === "transfer") return t("clan.transferAndSwitch");
    if (scenario === "dissolve") {
      return mode === "join" ? t("clan.dissolveAndJoin") : t("clan.dissolveAndCreate");
    }
    return mode === "join" ? t("clan.leaveAndJoin") : t("clan.leaveAndCreate");
  }

  async function handleAction() {
    setLoading(true);
    try {
      if (scenario === "transfer") {
        // Step 1: Transfer leadership
        const transferRes = await fetch(
          `/api/clans/${currentClan.id}/transfer-leadership`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newLeaderUserId: selectedLeader }),
          }
        );
        if (!transferRes.ok) {
          const data = await transferRes.json();
          toast.error(data.error || t("clan.failedTransferLeadership"));
          return;
        }
      }

      if (mode === "join" && targetClan) {
        // Use switch endpoint — handles leave + join atomically
        const switchRes = await fetch(`/api/clans/${targetClan.id}/switch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentClanId: currentClan.id }),
        });
        if (!switchRes.ok) {
          const data = await switchRes.json();
          toast.error(data.error || t("common.somethingWentWrong"));
          return;
        }
        const switchData = await switchRes.json();
        if (switchData.requestCreated) {
          toast.success(t("clan.joinRequestSent"));
        } else {
          toast.success(t("clan.switchSuccess"));
        }
        onOpenChange(false);
        router.refresh();
      } else {
        // mode === "create": leave current clan, then redirect to create
        const leaveRes = await fetch(
          `/api/clans/${currentClan.id}/members/${currentUserId}`,
          { method: "DELETE" }
        );
        if (!leaveRes.ok) {
          const data = await leaveRes.json();
          toast.error(data.error || t("clan.failedLeaveClan"));
          return;
        }
        toast.success(t("clan.leftClan"));
        onOpenChange(false);
        router.push("/clans/create");
        router.refresh();
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  const isActionDisabled = loading || (scenario === "transfer" && !selectedLeader);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("clan.switchClanTitle")}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        {scenario === "transfer" && currentClan.members && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("clan.selectNewLeader")}</label>
            <select
              value={selectedLeader}
              onChange={(e) => setSelectedLeader(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("clan.selectNewLeader")}</option>
              {currentClan.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleAction}
            disabled={isActionDisabled}
            variant={scenario === "dissolve" ? "destructive" : "default"}
          >
            {loading ? t("clan.switching") : getActionLabel()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
