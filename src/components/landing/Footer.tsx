"use client";

import { CandlestickChart } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-white/10 px-4 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <CandlestickChart className="h-5 w-5 text-green-400" />
          <span className="text-sm text-muted-foreground">
            {t("landing.tagline")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("landing.copyright", { year: String(new Date().getFullYear()) })}
        </p>
      </div>
    </footer>
  );
}
