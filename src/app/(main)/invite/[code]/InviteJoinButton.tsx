"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();

  if (!isLoggedIn) {
    return (
      <Button asChild className="w-full">
        <Link href={`/login?callbackUrl=/invite/${code}`}>
          {t("clan.loginToJoin")}
        </Link>
      </Button>
    );
  }

  if (isMember) {
    return (
      <Button disabled className="w-full" variant="outline">
        {t("clan.alreadyMember")}
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
        toast.success(t("clan.joinedClan"));
        router.push(`/clans/${data.clan.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || t("clan.failedJoin"));
      }
    } catch {
      toast.error(t("common.somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleJoin} disabled={loading} className="w-full">
      {loading ? t("clan.joining") : t("clan.acceptInvite")}
    </Button>
  );
}
