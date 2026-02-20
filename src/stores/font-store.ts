import { create } from "zustand";
import { persist } from "zustand/middleware";

export type EnFont = "inter" | "geist" | "jakarta";
export type FaFont = "vazirmatn" | "sahel";

export const EN_FONT_OPTIONS: { value: EnFont; label: string }[] = [
  { value: "inter", label: "Inter" },
  { value: "geist", label: "Geist" },
  { value: "jakarta", label: "Plus Jakarta Sans" },
];

export const FA_FONT_OPTIONS: { value: FaFont; label: string; labelFa: string }[] = [
  { value: "vazirmatn", label: "Vazirmatn", labelFa: "وزیرمتن" },
  { value: "sahel", label: "Sahel", labelFa: "ساحل" },
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
      faFont: "vazirmatn",
      setEnFont: (font) => set({ enFont: font }),
      setFaFont: (font) => set({ faFont: font }),
    }),
    { name: "clantrader-font" }
  )
);
