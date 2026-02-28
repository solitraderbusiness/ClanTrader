"use client";

import { useLayoutEffect } from "react";
import { useFontStore } from "@/stores/font-store";
import { useLocaleStore } from "@/stores/locale-store";
import { isRTL } from "@/lib/locale";

export function FontApplier() {
  const enFont = useFontStore((s) => s.enFont);
  const faFont = useFontStore((s) => s.faFont);
  const locale = useLocaleStore((s) => s.locale);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const rtl = isRTL(locale);
    const activeFont = rtl ? faFont : enFont;
    html.setAttribute("data-font", activeFont);
  }, [enFont, faFont, locale]);

  return null;
}
