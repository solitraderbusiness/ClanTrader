import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "@/lib/locale";

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "fa",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "clantrader-locale" }
  )
);
