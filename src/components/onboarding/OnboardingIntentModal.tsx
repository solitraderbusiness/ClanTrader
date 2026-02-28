"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GraduationCap, Trophy, Megaphone, Users } from "lucide-react";
import { track } from "@/lib/analytics";

const INTENTS = [
  {
    value: "LEARN",
    label: "Learn from pros",
    description: "Follow top traders and study their strategies",
    icon: GraduationCap,
  },
  {
    value: "COMPETE",
    label: "Compete on leaderboards",
    description: "Prove your edge and climb the rankings",
    icon: Trophy,
  },
  {
    value: "SHARE",
    label: "Share my signals",
    description: "Post trade ideas and build a following",
    icon: Megaphone,
  },
  {
    value: "RECRUIT",
    label: "Recruit for my clan",
    description: "Build a team of traders and compete together",
    icon: Users,
  },
] as const;

export function OnboardingIntentModal() {
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!session || session.user.onboardingComplete) return null;

  async function handleSelect(intent: string | null) {
    setSaving(true);
    if (intent) {
      track("onboarding_intent_selected", { intent });
    } else {
      track("onboarding_skipped");
    }
    try {
      await fetch("/api/users/me/onboarding-intent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      await update();
      setOpen(false);
    } catch {
      // Silent — non-critical
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleSelect(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What brings you to ClanTrader?</DialogTitle>
          <DialogDescription>
            Help us personalize your experience. You can change this later.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {INTENTS.map((intent) => {
            const Icon = intent.icon;
            return (
              <button
                key={intent.value}
                disabled={saving}
                onClick={() => handleSelect(intent.value)}
                className="flex items-center gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-accent disabled:opacity-50"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">{intent.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {intent.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => handleSelect(null)}
          className="mx-auto mt-2"
        >
          Skip for now
        </Button>
      </DialogContent>
    </Dialog>
  );
}
