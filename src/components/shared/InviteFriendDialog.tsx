"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Share2, MousePointerClick, UserPlus, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useUsernamePromptStore } from "@/stores/username-prompt-store";
import { useTranslation } from "@/lib/i18n";

interface InviteFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReferralStats {
  shares: number;
  clicks: number;
  signups: number;
}

export function InviteFriendDialog({ open, onOpenChange }: InviteFriendDialogProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const openUsernamePrompt = useUsernamePromptStore((s) => s.open);
  const { t } = useTranslation();

  useEffect(() => {
    if (open && session?.user?.username) {
      fetch("/api/users/me/referrals")
        .then((res) => res.json())
        .then((data) => setStats(data.stats))
        .catch(() => {});
    }
  }, [open, session?.user?.username]);

  const username = session?.user?.username;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://clantrader.com";
  const inviteLink = username ? `${origin}/join?ref=${username}` : "";

  // If no username, close this dialog and open the username prompt instead
  if (open && !username) {
    onOpenChange(false);
    openUsernamePrompt();
    return null;
  }

  function trackReferralEvent(type: string) {
    fetch("/api/referrals/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => {});
  }

  async function handleCopy() {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success(t("common.linkCopied"));
      trackReferralEvent("LINK_COPIED");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("common.failedCopyLink"));
    }
  }

  async function handleShare() {
    if (!inviteLink) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join ClanTrader",
          text: "Join me on ClanTrader — the competitive social trading platform!",
          url: inviteLink,
        });
        trackReferralEvent("LINK_SHARED");
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("common.inviteFriend")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("common.inviteFriendDesc")}
          </p>

          <div className="space-y-2">
            <Label>{t("common.yourInviteLink")}</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={inviteLink}
                className="text-sm"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCopy} className="flex-1">
              <Copy className="me-2 h-4 w-4" />
              {t("common.copyLink")}
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button variant="outline" onClick={handleShare} className="flex-1">
                <Share2 className="me-2 h-4 w-4" />
                {t("common.share")}
              </Button>
            )}
          </div>

          {stats && (stats.shares > 0 || stats.clicks > 0 || stats.signups > 0) && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("common.yourStats")}
              </p>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{stats.shares}</span>
                  <span className="text-muted-foreground">{t("common.shares")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{stats.clicks}</span>
                  <span className="text-muted-foreground">{t("common.clicks")}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{stats.signups}</span>
                  <span className="text-muted-foreground">{t("common.signups")}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
