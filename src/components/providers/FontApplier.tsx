"use client";

import { useEffect } from "react";
import { useFontStore } from "@/stores/font-store";

export function FontApplier() {
  const enFont = useFontStore((s) => s.enFont);
  const faFont = useFontStore((s) => s.faFont);

  useEffect(() => {
    const html = document.documentElement;
    const lang = html.getAttribute("lang") || "en";
    const isRtl = lang === "fa" || lang === "ar";
    const activeFont = isRtl ? faFont : enFont;
    html.setAttribute("data-font", activeFont);
  }, [enFont, faFont]);

  return null;
}
