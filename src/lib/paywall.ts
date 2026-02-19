import { db } from "@/lib/db";

interface PaywallPreview {
  [key: string]: boolean;
}

export async function getPaywallRule(resourceType: string) {
  return db.paywallRule.findUnique({
    where: { resourceType },
  });
}

export function applyPaywall<T extends Record<string, unknown>>(
  data: T,
  freePreview: PaywallPreview | null,
  isPro: boolean
): T {
  if (isPro || !freePreview) return data;

  const redacted = { ...data } as Record<string, unknown>;
  for (const [key, show] of Object.entries(freePreview)) {
    if (!show && key in redacted) {
      redacted[key] = undefined;
    }
  }
  return redacted as T;
}
