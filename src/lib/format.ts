import type { Locale } from "@/lib/locale";

const LOCALE_MAP: Record<string, string> = {
  fa: "fa-IR",
  en: "en-US",
  ar: "ar-SA",
};

/**
 * Format a number with locale-appropriate separators and digits.
 * fa → Persian digits, en → standard digits.
 */
export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_MAP[locale] || "en-US").format(n);
}

/**
 * Format a date with locale-appropriate calendar.
 * fa → Jalali (Persian calendar), en → Gregorian.
 */
export function formatDate(
  date: string | Date,
  locale: Locale,
  style: "short" | "long" = "short"
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const intlLocale =
    locale === "fa" ? "fa-IR-u-ca-persian" : (LOCALE_MAP[locale] || "en-US");

  if (style === "long") {
    return new Intl.DateTimeFormat(intlLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(d);
  }

  return new Intl.DateTimeFormat(intlLocale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Format relative time like "2 minutes ago" / "۲ دقیقه پیش".
 */
export function formatRelativeTime(
  date: string | Date,
  locale: Locale
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const rtf = new Intl.RelativeTimeFormat(LOCALE_MAP[locale] || "en-US", {
    numeric: "auto",
  });

  if (diffSec < 60) return rtf.format(-diffSec, "second");
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  if (diffHour < 24) return rtf.format(-diffHour, "hour");
  if (diffDay < 30) return rtf.format(-diffDay, "day");

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return rtf.format(-diffMonth, "month");

  return rtf.format(-Math.floor(diffMonth / 12), "year");
}
