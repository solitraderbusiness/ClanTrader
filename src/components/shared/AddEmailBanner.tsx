"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface AddEmailBannerProps {
  hasEmail: boolean;
}

export function AddEmailBanner({ hasEmail }: AddEmailBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (hasEmail || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {t("banner.addEmail")}
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/settings/security">{t("banner.addEmailBtn")}</Link>
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        aria-label={t("common.dismiss")}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
