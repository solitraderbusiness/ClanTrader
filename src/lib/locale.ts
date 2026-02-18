export type Locale = "en" | "fa" | "ar";

export const RTL_LOCALES: Locale[] = ["fa", "ar"];

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return isRTL(locale) ? "rtl" : "ltr";
}
