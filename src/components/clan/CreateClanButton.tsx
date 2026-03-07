"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SwitchClanModal } from "@/components/clan/SwitchClanModal";

interface CurrentClanInfo {
  id: string;
  name: string;
  memberCount: number;
  userRole: string;
  members?: { userId: string; name: string }[];
}

interface CreateClanButtonProps {
  isInClan: boolean;
  currentClanInfo?: CurrentClanInfo | null;
  currentUserId: string;
  label: string;
}

export function CreateClanButton({
  isInClan,
  currentClanInfo,
  currentUserId,
  label,
}: CreateClanButtonProps) {
  const [switchModalOpen, setSwitchModalOpen] = useState(false);

  if (!isInClan) {
    return (
      <Button asChild>
        <Link href="/clans/create">
          <Plus className="me-2 h-4 w-4" />
          {label}
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setSwitchModalOpen(true)}>
        <Plus className="me-2 h-4 w-4" />
        {label}
      </Button>
      {currentClanInfo && (
        <SwitchClanModal
          open={switchModalOpen}
          onOpenChange={setSwitchModalOpen}
          currentClan={currentClanInfo}
          currentUserId={currentUserId}
          targetClan={null}
          mode="create"
        />
      )}
    </>
  );
}
