/**
 * Web Push notification service.
 * Sends push notifications to subscribed browsers/devices via VAPID.
 */

import webpush from "web-push";
import { db } from "@/lib/db";
import {
  type NotificationType,
  type PushCategory,
  PUSH_CATEGORY_MAP,
  DEFAULT_PUSH_CATEGORIES,
} from "@/lib/notification-types";

// ---- VAPID config ----

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_APP_URL
  ? `mailto:admin@${new URL(process.env.NEXT_PUBLIC_APP_URL).hostname}`
  : "mailto:admin@clantrader.com";

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

// ---- Subscribe / Unsubscribe ----

export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function savePushSubscription(
  userId: string,
  sub: PushSubscriptionInput,
  userAgent?: string
) {
  // Upsert by endpoint (same device re-subscribing)
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent ?? null,
    },
    update: {
      userId, // ownership may transfer if same browser, different login
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent ?? null,
    },
  });

  // Enable push in preferences
  await db.notificationPreference.upsert({
    where: { userId },
    create: { userId, pushEnabled: true },
    update: { pushEnabled: true },
  });
}

export async function removePushSubscription(
  userId: string,
  endpoint: string
) {
  await db.pushSubscription.deleteMany({
    where: { userId, endpoint },
  });

  // Check if user has any remaining subscriptions
  const remaining = await db.pushSubscription.count({
    where: { userId },
  });
  if (remaining === 0) {
    await db.notificationPreference.updateMany({
      where: { userId },
      data: { pushEnabled: false },
    });
  }
}

// ---- Send push to user ----

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  type?: string;
}

/** Resolve effective push categories from stored JSON (empty = all enabled) */
function getEffectivePushCategories(
  stored: Record<string, boolean> | null | undefined
): Record<PushCategory, boolean> {
  if (!stored || Object.keys(stored).length === 0) {
    return { ...DEFAULT_PUSH_CATEGORIES };
  }
  // Merge with defaults: missing keys = enabled
  const result = { ...DEFAULT_PUSH_CATEGORIES };
  for (const [key, val] of Object.entries(stored)) {
    if (key in result) {
      result[key as PushCategory] = val;
    }
  }
  return result;
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureConfigured()) {
    return { sent: 0, failed: 0 };
  }

  // Check user preferences
  const prefs = await db.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs?.pushEnabled) {
    return { sent: 0, failed: 0 };
  }

  // Check per-category push preference
  if (payload.type) {
    const category = PUSH_CATEGORY_MAP[payload.type as NotificationType];
    if (category) {
      const cats = getEffectivePushCategories(
        prefs.pushCategories as Record<string, boolean> | null
      );
      if (!cats[category]) {
        return { sent: 0, failed: 0 };
      }
    }
  }

  // Get all subscriptions for this user
  const subs = await db.pushSubscription.findMany({
    where: { userId },
  });
  if (subs.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const jsonPayload = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const expiredIds: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        jsonPayload,
        { TTL: 3600 } // 1 hour TTL
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired or invalid — mark for cleanup
        expiredIds.push(sub.id);
      }
      failed++;
    }
  }

  // Clean up expired subscriptions
  if (expiredIds.length > 0) {
    await db.pushSubscription.deleteMany({
      where: { id: { in: expiredIds } },
    });
  }

  return { sent, failed };
}
