import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/locale";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * Read locale synchronously to prevent flash of wrong language.
 *
 * Priority chain:
 * 1. Server-injected global (window.__CT_LOCALE__) — matches SSR cookie, no mismatch
 * 2. localStorage (Zustand persist format) — fallback for edge cases
 * 3. "fa" default
 */
function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "fa";

  // 1. Server-injected via blocking <script> — most reliable
  const injected = (window as unknown as Record<string, unknown>).__CT_LOCALE__;
  if (injected === "en" || injected === "fa" || injected === "ar") return injected as Locale;

  // 2. Zustand persist localStorage
  try {
    const raw = localStorage.getItem("clantrader-locale");
    if (raw) {
      const parsed = JSON.parse(raw);
      const stored = parsed?.state?.locale;
      if (stored === "en" || stored === "fa" || stored === "ar") return stored;
    }
  } catch {
    // corrupt localStorage — fall through
  }
  return "fa";
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: getInitialLocale(),
      setLocale: (locale) => set({ locale }),
    }),
    { name: "clantrader-locale" }
  )
);
