"use client";

import Link from "next/link";
import { CandlestickChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function Navbar() {
  const { t } = useTranslation();
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-background/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <CandlestickChart className="h-6 w-6 text-green-400" />
          <span className="text-lg font-bold">{t("landing.brandName")}</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">{t("landing.signIn")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">{t("landing.getStarted")}</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}
