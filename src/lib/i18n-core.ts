import fa from "@/locales/fa.json";
import en from "@/locales/en.json";
import type { Locale } from "@/lib/locale";

type TranslationDict = Record<string, Record<string, string>>;

const translations: Record<string, TranslationDict> = { fa, en };

/**
 * Translate a dotted key like "trade.entry" with optional {param} interpolation.
 * Fallback chain: requested locale → en → raw key.
 * Works on both server and client (no "use client" directive).
 */
export function t(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const [namespace, ...rest] = key.split(".");
  const subkey = rest.join(".");

  let value =
    translations[locale]?.[namespace]?.[subkey] ??
    translations.en?.[namespace]?.[subkey] ??
    key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }

  return value;
}
