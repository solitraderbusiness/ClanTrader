"use client";

import { useLayoutEffect } from "react";
import { useLocaleStore } from "@/stores/locale-store";
import { getDirection, isRTL } from "@/lib/locale";

export function LocaleApplier() {
  const locale = useLocaleStore((s) => s.locale);

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.setAttribute("lang", locale);
    html.setAttribute("dir", getDirection(locale));

    // Set cookie for SSR
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;samesite=lax`;

    // Switch font class based on locale
    if (isRTL(locale)) {
      html.classList.add("locale-rtl");
      html.classList.remove("locale-ltr");
    } else {
      html.classList.add("locale-ltr");
      html.classList.remove("locale-rtl");
    }
  }, [locale]);

  return null;
}
