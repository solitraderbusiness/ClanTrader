/**
 * Centralized notification service.
 * Creates persisted notifications, applies user preferences,
 * delivers via Socket.io, and handles dedupe/cooldown.
 */

import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import {
  type NotificationType,
  type NotificationSeverity,
  type NotificationFamily,
  SEVERITY_MAP,
  FAMILY_MAP,
  COOLDOWN_SECONDS,
} from "@/lib/notification-types";
import { sendPushToUser } from "@/services/web-push.service";

// ---- Types ----

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  payload?: Record<string, unknown>;
  /** Custom dedupe key. If omitted, defaults to `${type}:${userId}` */
  dedupeKey?: string;
  /** Override default severity from SEVERITY_MAP */
  severity?: NotificationSeverity;
  /** Override default family from FAMILY_MAP */
  family?: NotificationFamily;
}

export interface NotificationResult {
  id: string;
  delivered: boolean;
  skipped: boolean;
  reason?: string;
}

// ---- Socket.io ref (set once from server.ts) ----

let _io: Server | null = null;

export function setNotificationIO(io: Server) {
  _io = io;
}

// ---- Cooldown check ----

async function isCooldownActive(
  type: NotificationType,
  dedupeKey: string
): Promise<boolean> {
  const cooldownSec = COOLDOWN_SECONDS[type];
  if (!cooldownSec) return false;

  const redisKey = `notif-cd:${dedupeKey}`;
  const exists = await redis.exists(redisKey);
  return exists === 1;
}

async function setCooldown(
  type: NotificationType,
  dedupeKey: string
): Promise<void> {
  const cooldownSec = COOLDOWN_SECONDS[type];
  if (!cooldownSec) return;

  const redisKey = `notif-cd:${dedupeKey}`;
  await redis.set(redisKey, "1", "EX", cooldownSec);
}

// ---- User preference check ----

interface UserPrefs {
  inAppEnabled: boolean;
  deliveryMode: string;
}

async function getUserPreferences(userId: string): Promise<UserPrefs> {
  const pref = await db.notificationPreference.findUnique({
    where: { userId },
  });
  return {
    inAppEnabled: pref?.inAppEnabled ?? true,
    deliveryMode: pref?.deliveryMode ?? "all",
  };
}

function shouldDeliver(
  prefs: UserPrefs,
  severity: NotificationSeverity
): boolean {
  if (!prefs.inAppEnabled) return false;
  if (prefs.deliveryMode === "critical_only" && severity !== "CRITICAL") {
    return false;
  }
  return true;
}

// ---- Core: create notification ----

export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationResult> {
  const severity = input.severity ?? SEVERITY_MAP[input.type];
  const family = input.family ?? FAMILY_MAP[input.type];
  const dedupeKey =
    input.dedupeKey ?? `${input.type}:${input.userId}`;

  // Check cooldown
  const onCooldown = await isCooldownActive(input.type, dedupeKey);
  if (onCooldown) {
    return { id: "", delivered: false, skipped: true, reason: "cooldown" };
  }

  // Always persist (even if delivery is suppressed by preferences)
  const notification = await db.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      family,
      severity,
      title: input.title,
      body: input.body,
      ctaLabel: input.ctaLabel ?? null,
      ctaHref: input.ctaHref ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: (input.payload ?? undefined) as any,
      dedupeKey,
    },
  });

  // Set cooldown after creation
  await setCooldown(input.type, dedupeKey);

  // Check preferences for delivery
  const prefs = await getUserPreferences(input.userId);
  const deliver = shouldDeliver(prefs, severity);

  if (deliver && _io) {
    // Emit to user-specific room
    const userRoom = `user:${input.userId}`;
    _io.to(userRoom).emit(SOCKET_EVENTS.NOTIFICATION_NEW, {
      id: notification.id,
      type: notification.type,
      family: notification.family,
      severity: notification.severity,
      title: notification.title,
      body: notification.body,
      ctaLabel: notification.ctaLabel,
      ctaHref: notification.ctaHref,
      createdAt: notification.createdAt.toISOString(),
    });

    // Also emit updated unread count
    const unreadCount = await getUnreadCount(input.userId);
    _io.to(userRoom).emit(SOCKET_EVENTS.NOTIFICATION_COUNT_UPDATE, {
      count: unreadCount,
    });
  }

  // Web Push — deliver to subscribed browsers/devices (fire-and-forget)
  if (deliver) {
    sendPushToUser(input.userId, {
      title: notification.title,
      body: notification.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag: notification.type,
      url: input.ctaHref ?? "/notifications",
      type: notification.type,
    }).catch((err) => {
      console.error("[WebPush] delivery error:", err);
    });
  }

  return {
    id: notification.id,
    delivered: deliver,
    skipped: false,
  };
}

// ---- Batch: create for multiple users ----

export async function createNotificationForUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">
): Promise<void> {
  for (const userId of userIds) {
    await createNotification({ ...input, userId });
  }
}

// ---- Queries ----

export async function getUnreadCount(userId: string): Promise<number> {
  return db.notification.count({
    where: { userId, isRead: false },
  });
}

export interface ListNotificationsOptions {
  userId: string;
  severity?: NotificationSeverity;
  unreadOnly?: boolean;
  cursor?: string; // createdAt ISO string for cursor-based pagination
  limit?: number;
}

export async function listNotifications(opts: ListNotificationsOptions) {
  const limit = opts.limit ?? 20;

  const where: Record<string, unknown> = { userId: opts.userId };
  if (opts.severity) where.severity = opts.severity;
  if (opts.unreadOnly) where.isRead = false;
  if (opts.cursor) where.createdAt = { lt: new Date(opts.cursor) };

  const notifications = await db.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;

  return {
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      family: n.family,
      severity: n.severity,
      title: n.title,
      body: n.body,
      ctaLabel: n.ctaLabel,
      ctaHref: n.ctaHref,
      payload: n.payload,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    })),
    nextCursor: hasMore
      ? items[items.length - 1].createdAt.toISOString()
      : null,
  };
}

export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await db.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return result.count;
}
