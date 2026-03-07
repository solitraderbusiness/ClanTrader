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
import { Rocket } from "lucide-react";
import { track } from "@/lib/analytics";
import { useTranslation } from "@/lib/i18n";

export function OnboardingIntentModal() {
  const { t } = useTranslation();
  const { data: session, update } = useSession();
  const [open, setOpen] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!session || session.user.onboardingComplete) return null;

  async function handleContinue(skipped: boolean) {
    setSaving(true);
    track(skipped ? "onboarding_skipped" : "onboarding_started");
    try {
      await fetch("/api/users/me/onboarding-intent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: null }),
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
    <Dialog open={open} onOpenChange={(v) => !v && handleContinue(true)}>
      <DialogContent className="sm:max-w-sm text-center">
        <DialogHeader className="items-center">
          <Rocket className="h-10 w-10 text-primary mb-2" />
          <DialogTitle className="text-xl">
            {t("onboarding.welcomeTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("onboarding.welcomeDesc")}
          </DialogDescription>
        </DialogHeader>
        <Button
          disabled={saving}
          onClick={() => handleContinue(false)}
          className="w-full mt-2"
          size="lg"
        >
          {t("onboarding.letsGo")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={() => handleContinue(true)}
          className="mx-auto"
        >
          {t("onboarding.skipForNow")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
