import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock declarations (must come before vi.mock calls) ----

const mockNotificationCreate = vi.fn();
const mockNotificationCount = vi.fn();
const mockNotificationUpdateMany = vi.fn();
const mockNotificationFindMany = vi.fn();
const mockNotificationPrefFindUnique = vi.fn();

const mockRedisExists = vi.fn();
const mockRedisSet = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    notification: {
      create: (...args: unknown[]) => mockNotificationCreate(...args),
      count: (...args: unknown[]) => mockNotificationCount(...args),
      updateMany: (...args: unknown[]) => mockNotificationUpdateMany(...args),
      findMany: (...args: unknown[]) => mockNotificationFindMany(...args),
    },
    notificationPreference: {
      findUnique: (...args: unknown[]) => mockNotificationPrefFindUnique(...args),
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  redis: {
    exists: (...args: unknown[]) => mockRedisExists(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
  },
}));

vi.mock("@/lib/chat-constants", () => ({
  SOCKET_EVENTS: {
    NOTIFICATION_NEW: "notification:new",
    NOTIFICATION_COUNT_UPDATE: "notification:count_update",
  },
}));

vi.mock("@/services/web-push.service", () => ({
  sendPushToUser: vi.fn().mockResolvedValue({ sent: 0, failed: 0 }),
}));

import {
  createNotification,
  createNotificationForUsers,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  listNotifications,
} from "@/services/notification.service";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";

// ---- Factory helpers ----

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: "notif-1",
    userId: "user-1",
    type: NOTIFICATION_TYPES.TRADE_CLOSED,
    family: "ACCOUNT",
    severity: "UPDATE",
    title: "Trade closed",
    body: "Your EURUSD trade was closed",
    ctaLabel: null,
    ctaHref: null,
    payload: null,
    isRead: false,
    readAt: null,
    dedupeKey: `${NOTIFICATION_TYPES.TRADE_CLOSED}:user-1`,
    createdAt: new Date("2026-01-01T10:00:00Z"),
    ...overrides,
  };
}

function makePrefs(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    inAppEnabled: true,
    deliveryMode: "all",
    ...overrides,
  };
}

// ---- Tests ----

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no cooldown active, no prefs override
    mockRedisExists.mockResolvedValue(0);
    mockRedisSet.mockResolvedValue("OK");
    mockNotificationCreate.mockResolvedValue(makeNotification());
    mockNotificationPrefFindUnique.mockResolvedValue(null); // defaults: inApp=true, mode=all
    mockNotificationCount.mockResolvedValue(3);
  });

  it("creates a notification and returns id with delivered=true", async () => {
    const result = await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRADE_CLOSED,
      title: "Trade closed",
      body: "Your EURUSD trade was closed",
    });

    expect(result.id).toBe("notif-1");
    expect(result.delivered).toBe(true);
    expect(result.skipped).toBe(false);
    expect(mockNotificationCreate).toHaveBeenCalledOnce();
  });

  it("persists the notification with correct data shape", async () => {
    await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRADE_CLOSED,
      title: "Trade closed",
      body: "Your EURUSD trade was closed",
      ctaLabel: "View",
      ctaHref: "/trades",
      payload: { tradeId: "t-1" },
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          type: NOTIFICATION_TYPES.TRADE_CLOSED,
          title: "Trade closed",
          body: "Your EURUSD trade was closed",
          ctaLabel: "View",
          ctaHref: "/trades",
          severity: "UPDATE",
          family: "ACCOUNT",
        }),
      })
    );
  });

  it("uses override severity and family when provided", async () => {
    await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRADE_CLOSED,
      title: "Critical override",
      body: "body",
      severity: "CRITICAL",
      family: "SYSTEM",
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: "CRITICAL",
          family: "SYSTEM",
        }),
      })
    );
  });

  it("uses custom dedupeKey when provided", async () => {
    await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRADE_CLOSED,
      title: "Trade closed",
      body: "body",
      dedupeKey: "custom:dedupe:key",
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: "custom:dedupe:key",
        }),
      })
    );
  });

  it("defaults dedupeKey to type:userId when not provided", async () => {
    await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRADE_CLOSED,
      title: "Trade closed",
      body: "body",
    });

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          dedupeKey: `${NOTIFICATION_TYPES.TRADE_CLOSED}:user-1`,
        }),
      })
    );
  });

  it("sets cooldown in Redis after creation for cooldown-eligible types", async () => {
    await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRACKING_LOST, // has 3600s cooldown
      title: "Tracking lost",
      body: "body",
    });

    expect(mockRedisSet).toHaveBeenCalledWith(
      "notif-cd:tracking_lost:user-1",
      "1",
      "EX",
      3600
    );
  });

  it("does NOT set cooldown for types with no cooldown window", async () => {
    await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRADE_CLOSED, // no cooldown defined
      title: "Trade closed",
      body: "body",
    });

    expect(mockRedisSet).not.toHaveBeenCalled();
  });
});

// ---- Cooldown tests ----

describe("createNotification — cooldown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotificationPrefFindUnique.mockResolvedValue(null);
    mockNotificationCount.mockResolvedValue(0);
  });

  it("skips creation entirely when cooldown is active", async () => {
    mockRedisExists.mockResolvedValue(1); // cooldown key exists

    const result = await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRACKING_LOST,
      title: "Tracking lost",
      body: "body",
    });

    expect(result.skipped).toBe(true);
    expect(result.delivered).toBe(false);
    expect(result.id).toBe("");
    expect(result.reason).toBe("cooldown");
    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });

  it("proceeds with creation when cooldown is not active", async () => {
    mockRedisExists.mockResolvedValue(0);
    mockNotificationCreate.mockResolvedValue(makeNotification());

    const result = await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRACKING_LOST,
      title: "Tracking lost",
      body: "body",
    });

    expect(result.skipped).toBe(false);
    expect(mockNotificationCreate).toHaveBeenCalledOnce();
  });

  it("checks cooldown with the custom dedupeKey", async () => {
    mockRedisExists.mockResolvedValue(1);

    await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRACKING_LOST,
      title: "Tracking lost",
      body: "body",
      dedupeKey: "custom:key",
    });

    expect(mockRedisExists).toHaveBeenCalledWith("notif-cd:custom:key");
  });
});

// ---- Preference tests ----

describe("createNotification — user preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisExists.mockResolvedValue(0);
    mockRedisSet.mockResolvedValue("OK");
    mockNotificationCreate.mockResolvedValue(makeNotification());
    mockNotificationCount.mockResolvedValue(0);
  });

  it("persists notification even when inAppEnabled is false", async () => {
    mockNotificationPrefFindUnique.mockResolvedValue(
      makePrefs({ inAppEnabled: false })
    );

    const result = await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRADE_CLOSED,
      title: "Trade closed",
      body: "body",
    });

    // Notification is still persisted
    expect(mockNotificationCreate).toHaveBeenCalledOnce();
    // But not delivered
    expect(result.delivered).toBe(false);
  });

  it("skips socket delivery when deliveryMode is critical_only and severity is not CRITICAL", async () => {
    mockNotificationPrefFindUnique.mockResolvedValue(
      makePrefs({ deliveryMode: "critical_only" })
    );
    // TRADE_CLOSED is severity "UPDATE" — not CRITICAL
    const result = await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRADE_CLOSED,
      title: "Trade closed",
      body: "body",
    });

    expect(result.delivered).toBe(false);
    // Notification still persisted
    expect(mockNotificationCreate).toHaveBeenCalledOnce();
  });

  it("delivers when deliveryMode is critical_only and severity IS CRITICAL", async () => {
    mockNotificationPrefFindUnique.mockResolvedValue(
      makePrefs({ deliveryMode: "critical_only" })
    );
    mockNotificationCreate.mockResolvedValue(
      makeNotification({ severity: "CRITICAL", type: NOTIFICATION_TYPES.RISK_NO_SL })
    );

    const result = await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.RISK_NO_SL, // severity CRITICAL
      title: "No SL",
      body: "body",
    });

    expect(result.delivered).toBe(true);
  });

  it("uses default preferences (inApp=true, mode=all) when no prefs row found", async () => {
    mockNotificationPrefFindUnique.mockResolvedValue(null);
    mockNotificationCreate.mockResolvedValue(makeNotification());

    const result = await createNotification({
      userId: "user-1",
      type: NOTIFICATION_TYPES.TRADE_CLOSED,
      title: "Trade closed",
      body: "body",
    });

    // With defaults, should be delivered (no socket — _io is null in tests, but delivered=true)
    expect(result.delivered).toBe(true);
  });
});

// ---- getUnreadCount ----

describe("getUnreadCount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the unread count for a user", async () => {
    mockNotificationCount.mockResolvedValue(5);

    const count = await getUnreadCount("user-1");

    expect(count).toBe(5);
    expect(mockNotificationCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", isRead: false }),
      })
    );
  });

  it("returns 0 when there are no unread notifications", async () => {
    mockNotificationCount.mockResolvedValue(0);

    const count = await getUnreadCount("user-1");

    expect(count).toBe(0);
  });
});

// ---- markAsRead ----

describe("markAsRead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when the notification was found and updated", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 1 });

    const result = await markAsRead("notif-1", "user-1");

    expect(result).toBe(true);
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "notif-1", userId: "user-1" },
        data: expect.objectContaining({ isRead: true }),
      })
    );
  });

  it("returns false when the notification was not found (wrong userId)", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 0 });

    const result = await markAsRead("notif-1", "wrong-user");

    expect(result).toBe(false);
  });

  it("sets readAt when marking as read", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 1 });

    await markAsRead("notif-1", "user-1");

    expect(mockNotificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      })
    );
  });
});

// ---- markAllAsRead ----

describe("markAllAsRead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks all unread notifications as read and returns the count", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 7 });

    const count = await markAllAsRead("user-1");

    expect(count).toBe(7);
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isRead: false },
        data: expect.objectContaining({ isRead: true }),
      })
    );
  });

  it("returns 0 when there are no unread notifications", async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 0 });

    const count = await markAllAsRead("user-1");

    expect(count).toBe(0);
  });
});

// ---- listNotifications ----

describe("listNotifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated notifications with hasMore=false when at limit", async () => {
    const items = Array.from({ length: 3 }, (_, i) =>
      makeNotification({ id: `notif-${i}`, createdAt: new Date(2026, 0, i + 1) })
    );
    mockNotificationFindMany.mockResolvedValue(items);

    const result = await listNotifications({ userId: "user-1", limit: 5 });

    expect(result.items).toHaveLength(3);
    expect(result.nextCursor).toBeNull();
  });

  it("returns nextCursor when there are more items than the limit", async () => {
    // limit=2, service fetches limit+1=3
    const items = Array.from({ length: 3 }, (_, i) =>
      makeNotification({ id: `notif-${i}`, createdAt: new Date(2026, 0, 3 - i) })
    );
    mockNotificationFindMany.mockResolvedValue(items);

    const result = await listNotifications({ userId: "user-1", limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).not.toBeNull();
  });

  it("passes unreadOnly filter to query when set", async () => {
    mockNotificationFindMany.mockResolvedValue([]);

    await listNotifications({ userId: "user-1", unreadOnly: true });

    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", isRead: false }),
      })
    );
  });

  it("passes severity filter when provided", async () => {
    mockNotificationFindMany.mockResolvedValue([]);

    await listNotifications({ userId: "user-1", severity: "CRITICAL" });

    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: "CRITICAL" }),
      })
    );
  });

  it("applies cursor (createdAt lt) when cursor is provided", async () => {
    mockNotificationFindMany.mockResolvedValue([]);
    const cursor = "2026-01-01T10:00:00.000Z";

    await listNotifications({ userId: "user-1", cursor });

    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lt: new Date(cursor) },
        }),
      })
    );
  });

  it("serializes createdAt as ISO string in response items", async () => {
    const ts = new Date("2026-01-01T10:00:00Z");
    mockNotificationFindMany.mockResolvedValue([makeNotification({ createdAt: ts })]);

    const result = await listNotifications({ userId: "user-1" });

    expect(result.items[0].createdAt).toBe(ts.toISOString());
  });
});

// ---- createNotificationForUsers ----

describe("createNotificationForUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisExists.mockResolvedValue(0);
    mockRedisSet.mockResolvedValue("OK");
    mockNotificationCreate.mockResolvedValue(makeNotification());
    mockNotificationPrefFindUnique.mockResolvedValue(null);
    mockNotificationCount.mockResolvedValue(0);
  });

  it("calls createNotification once per user", async () => {
    await createNotificationForUsers(["user-1", "user-2", "user-3"], {
      type: NOTIFICATION_TYPES.RANK_CHANGE,
      title: "Rank changed",
      body: "Your rank changed",
    });

    // create is called once per user
    expect(mockNotificationCreate).toHaveBeenCalledTimes(3);
  });

  it("does not call createNotification when userIds is empty", async () => {
    await createNotificationForUsers([], {
      type: NOTIFICATION_TYPES.RANK_CHANGE,
      title: "Rank changed",
      body: "body",
    });

    expect(mockNotificationCreate).not.toHaveBeenCalled();
  });
});
