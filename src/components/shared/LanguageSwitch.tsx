"use client";

import { useLocaleStore } from "@/stores/locale-store";
import { Button } from "@/components/ui/button";

export function LanguageSwitch() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setLocale(locale === "fa" ? "en" : "fa")}
      className="h-8 w-8 text-xs font-bold"
      title={locale === "fa" ? "Switch to English" : "تغییر به فارسی"}
    >
      {locale === "fa" ? "EN" : "فا"}
    </Button>
  );
}
