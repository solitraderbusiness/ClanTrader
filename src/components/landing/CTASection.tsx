"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function CTASection() {
  const { t } = useTranslation();
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-3xl rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 p-10 text-center">
        <h2 className="text-3xl font-bold">{t("landing.ctaHeading")}</h2>
        <p className="mt-3 text-muted-foreground">
          {t("landing.ctaDescription")}
        </p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/signup">{t("landing.getStartedFree")}</Link>
        </Button>
      </div>
    </section>
  );
}
