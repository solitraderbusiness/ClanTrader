import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EnFont = "inter" | "geist" | "jakarta";
export type FaFont = "vazirmatn" | "yekanbakh" | "shabnam" | "estedad" | "samim";

export const EN_FONT_OPTIONS: { value: EnFont; label: string }[] = [
  { value: "inter", label: "Inter" },
  { value: "geist", label: "Geist" },
  { value: "jakarta", label: "Plus Jakarta Sans" },
];

export const FA_FONT_OPTIONS: { value: FaFont; label: string; labelFa: string }[] = [
  { value: "vazirmatn", label: "Vazirmatn", labelFa: "وزیرمتن" },
  { value: "yekanbakh", label: "YekanBakh", labelFa: "یکان‌بخ" },
  { value: "shabnam", label: "Shabnam", labelFa: "شبنم" },
  { value: "estedad", label: "Estedad", labelFa: "استعداد" },
  { value: "samim", label: "Samim", labelFa: "صمیم" },
];

interface FontState {
  enFont: EnFont;
  faFont: FaFont;
  setEnFont: (font: EnFont) => void;
  setFaFont: (font: FaFont) => void;
}

export const useFontStore = create<FontState>()(
  persist(
    (set) => ({
      enFont: "inter",
      faFont: "estedad",
      setEnFont: (font) => set({ enFont: font }),
      setFaFont: (font) => set({ faFont: font }),
    }),
    { name: "clantrader-font" }
  )
);
