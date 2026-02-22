"use client";

import { useState } from "react";
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
import { Copy, Check, Share2 } from "lucide-react";
import { toast } from "sonner";

interface InviteFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteFriendDialog({ open, onOpenChange }: InviteFriendDialogProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  const username = session?.user?.username;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://clantrader.com";
  const inviteLink = username ? `${origin}/join?ref=${username}` : "";

  async function handleCopy() {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
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
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy();
    }
  }

  if (!username) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a Friend</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You need to set a username before you can invite friends.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite a Friend</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share your personal invite link with friends. When they sign up,
            they&apos;ll be linked to your account.
          </p>

          <div className="space-y-2">
            <Label>Your invite link</Label>
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
              Copy Link
            </Button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <Button variant="outline" onClick={handleShare} className="flex-1">
                <Share2 className="me-2 h-4 w-4" />
                Share
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
