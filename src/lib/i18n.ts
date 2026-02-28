"use client";

import { useLocaleStore } from "@/stores/locale-store";
import { getDirection } from "@/lib/locale";
import { t } from "@/lib/i18n-core";

// Re-export t for client components that already import from here
export { t } from "@/lib/i18n-core";

/**
 * React hook that reads locale from Zustand and returns a bound t() + metadata.
 */
export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const dir = getDirection(locale);

  const translate = (
    key: string,
    params?: Record<string, string | number>
  ): string => t(locale, key, params);

  return { t: translate, locale, dir } as const;
}
