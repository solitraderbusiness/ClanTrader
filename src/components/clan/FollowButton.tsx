"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

interface FollowButtonProps {
  clanId: string;
  initialFollowing: boolean;
}

export function FollowButton({ clanId, initialFollowing }: FollowButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

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
        toast.error(t("clan.failedFollow"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
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
      {following ? t("clan.following") : t("clan.follow")}
    </Button>
  );
}
