import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Env stubs (must come before module evaluation) ----
//
// The web-push.service reads VAPID keys into module-level constants at load
// time, so we must set them before any import resolves.  vi.hoisted() runs
// before vi.mock() hoisting, ensuring the env is in place when the module
// constants are captured.

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "BPublicKeyForTests";
  process.env.VAPID_PRIVATE_KEY = "PrivateKeyForTests";
  process.env.NEXT_PUBLIC_APP_URL = "https://clantrader.com";
});

// ---- Mock declarations (must precede vi.mock calls) ----

const mockPrefFindUnique = vi.fn();
const mockPrefUpsert = vi.fn();
const mockPrefUpdateMany = vi.fn();
const mockSubFindMany = vi.fn();
const mockSubUpsert = vi.fn();
const mockSubCount = vi.fn();
const mockSubDeleteMany = vi.fn();

const mockWebpushSetVapidDetails = vi.fn();
const mockWebpushSendNotification = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    notificationPreference: {
      findUnique: (...args: unknown[]) => mockPrefFindUnique(...args),
      upsert: (...args: unknown[]) => mockPrefUpsert(...args),
      updateMany: (...args: unknown[]) => mockPrefUpdateMany(...args),
    },
    pushSubscription: {
      findMany: (...args: unknown[]) => mockSubFindMany(...args),
      upsert: (...args: unknown[]) => mockSubUpsert(...args),
      count: (...args: unknown[]) => mockSubCount(...args),
      deleteMany: (...args: unknown[]) => mockSubDeleteMany(...args),
    },
  },
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => mockWebpushSetVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mockWebpushSendNotification(...args),
  },
}));

// ---- Imports (after all vi.mock calls) ----

import { sendPushToUser, savePushSubscription, removePushSubscription } from "@/services/web-push.service";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";

// ---- Environment setup ----
//
// The module reads env vars at import time to build VAPID_PUBLIC_KEY /
// VAPID_PRIVATE_KEY / VAPID_SUBJECT. We set them before importing so that
// ensureConfigured() returns true (the "configured" singleton is evaluated
// once per Vitest worker, but vi.resetModules is NOT used here because we
// want the singleton state — which starts as false — to be exercised
// naturally).  The simplest approach is to set the env vars before any
// import and rely on the fact that the module hasn't been imported yet
// inside this test file.

// ---- Factory helpers ----

function makePrefs(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    pushEnabled: true,
    pushCategories: {},
    inAppEnabled: true,
    deliveryMode: "all",
    ...overrides,
  };
}

function makeSub(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    userId: "user-1",
    endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
    p256dh: "p256dh-key",
    auth: "auth-key",
    userAgent: null,
    ...overrides,
  };
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Test notification",
    body: "Test body",
    type: NOTIFICATION_TYPES.TRADE_CLOSED,
    ...overrides,
  };
}

// ---- Shared beforeEach ----

beforeEach(() => {
  vi.clearAllMocks();

  // Default: VAPID is already configured (setVapidDetails called by ensureConfigured on first import)
  mockWebpushSetVapidDetails.mockReturnValue(undefined);
  mockWebpushSendNotification.mockResolvedValue({ statusCode: 201 });

  // Default: prefs with pushEnabled=true and no category overrides
  mockPrefFindUnique.mockResolvedValue(makePrefs());

  // Default: one valid subscription
  mockSubFindMany.mockResolvedValue([makeSub()]);

  // Default db writes succeed
  mockSubDeleteMany.mockResolvedValue({ count: 0 });
  mockSubUpsert.mockResolvedValue({});
  mockPrefUpsert.mockResolvedValue({});
  mockSubCount.mockResolvedValue(0);
  mockPrefUpdateMany.mockResolvedValue({ count: 1 });
});

// ============================================================
// sendPushToUser — pushEnabled gate
// ============================================================

describe("sendPushToUser — pushEnabled gate", () => {
  it("returns {sent:0, failed:0} when pushEnabled is false", async () => {
    mockPrefFindUnique.mockResolvedValue(makePrefs({ pushEnabled: false }));

    const result = await sendPushToUser("user-1", makePayload());

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockWebpushSendNotification).not.toHaveBeenCalled();
  });

  it("returns {sent:0, failed:0} when prefs row does not exist", async () => {
    mockPrefFindUnique.mockResolvedValue(null);

    const result = await sendPushToUser("user-1", makePayload());

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockWebpushSendNotification).not.toHaveBeenCalled();
  });
});

// ============================================================
// sendPushToUser — push category filtering
// ============================================================

describe("sendPushToUser — category filtering: disabled category is suppressed", () => {
  it("skips send when payload.type maps to a disabled category (tracking: false)", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { tracking: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.TRACKING_LOST })
    );

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockWebpushSendNotification).not.toHaveBeenCalled();
  });

  it("skips send for tracking_restored when tracking category is disabled", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { tracking: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.TRACKING_RESTORED })
    );

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockWebpushSendNotification).not.toHaveBeenCalled();
  });

  it("skips send for risk_no_sl when risk category is disabled", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { risk: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.RISK_NO_SL })
    );

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockWebpushSendNotification).not.toHaveBeenCalled();
  });

  it("skips send for price_alert_triggered when price_alerts category is disabled", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { price_alerts: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED })
    );

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockWebpushSendNotification).not.toHaveBeenCalled();
  });

  it("skips send for integrity_lost when integrity category is disabled", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { integrity: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.INTEGRITY_LOST })
    );

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockWebpushSendNotification).not.toHaveBeenCalled();
  });

  it("skips send for rank_change when clan category is disabled", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { clan: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.RANK_CHANGE })
    );

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockWebpushSendNotification).not.toHaveBeenCalled();
  });
});

describe("sendPushToUser — category filtering: unrelated category disabled does not block send", () => {
  it("sends trade_closed push even when tracking category is disabled", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { tracking: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.TRADE_CLOSED })
    );

    // trades category is not disabled → should send
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockWebpushSendNotification).toHaveBeenCalledOnce();
  });

  it("sends risk_drawdown push when only clan category is disabled", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { clan: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.RISK_DRAWDOWN })
    );

    expect(result.sent).toBe(1);
    expect(mockWebpushSendNotification).toHaveBeenCalledOnce();
  });

  it("sends price_alert_triggered when only trades and clan categories are disabled", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { trades: false, clan: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED })
    );

    expect(result.sent).toBe(1);
    expect(mockWebpushSendNotification).toHaveBeenCalledOnce();
  });
});

describe("sendPushToUser — category filtering: empty pushCategories means all enabled", () => {
  it("sends push when pushCategories is empty {} (all defaults enabled)", async () => {
    mockPrefFindUnique.mockResolvedValue(makePrefs({ pushCategories: {} }));

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.TRACKING_LOST })
    );

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockWebpushSendNotification).toHaveBeenCalledOnce();
  });

  it("sends push when pushCategories is null (treated as all-defaults)", async () => {
    mockPrefFindUnique.mockResolvedValue(makePrefs({ pushCategories: null }));

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.TRADE_CLOSED })
    );

    expect(result.sent).toBe(1);
    expect(mockWebpushSendNotification).toHaveBeenCalledOnce();
  });
});

describe("sendPushToUser — category filtering: explicit true allows send", () => {
  it("sends push when the relevant category is explicitly set to true", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({ pushCategories: { tracking: true, clan: false } })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.TRACKING_RESTORED })
    );

    expect(result.sent).toBe(1);
    expect(mockWebpushSendNotification).toHaveBeenCalledOnce();
  });

  it("sends trades push when trades is explicitly true and other categories are false", async () => {
    mockPrefFindUnique.mockResolvedValue(
      makePrefs({
        pushCategories: {
          trades: true,
          tracking: false,
          risk: false,
          integrity: false,
          clan: false,
          price_alerts: false,
        },
      })
    );

    const result = await sendPushToUser(
      "user-1",
      makePayload({ type: NOTIFICATION_TYPES.TRADE_ACTION_SUCCESS })
    );

    expect(result.sent).toBe(1);
    expect(mockWebpushSendNotification).toHaveBeenCalledOnce();
  });
});

describe("sendPushToUser — category filtering: unknown type is not blocked", () => {
  it("sends push when payload.type is undefined (no category to check)", async () => {
    mockPrefFindUnique.mockResolvedValue(makePrefs({ pushCategories: {} }));

    // No type field → category check is skipped → proceeds to send
    const result = await sendPushToUser("user-1", {
      title: "Generic push",
      body: "No type set",
    });

    expect(result.sent).toBe(1);
    expect(mockWebpushSendNotification).toHaveBeenCalledOnce();
  });

  it("sends push when payload.type is a string not in PUSH_CATEGORY_MAP", async () => {
    mockPrefFindUnique.mockResolvedValue(makePrefs({ pushCategories: {} }));

    const result = await sendPushToUser("user-1", {
      title: "Unknown type push",
      body: "body",
      type: "unknown_type_not_in_map",
    });

    expect(result.sent).toBe(1);
    expect(mockWebpushSendNotification).toHaveBeenCalledOnce();
  });
});

// ============================================================
// sendPushToUser — subscription handling
// ============================================================

describe("sendPushToUser — subscription handling", () => {
  it("returns {sent:0, failed:0} when user has no subscriptions", async () => {
    mockSubFindMany.mockResolvedValue([]);

    const result = await sendPushToUser("user-1", makePayload());

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockWebpushSendNotification).not.toHaveBeenCalled();
  });

  it("sends to all subscriptions and returns correct sent count", async () => {
    mockSubFindMany.mockResolvedValue([
      makeSub({ id: "sub-1", endpoint: "https://endpoint-1.example.com" }),
      makeSub({ id: "sub-2", endpoint: "https://endpoint-2.example.com" }),
      makeSub({ id: "sub-3", endpoint: "https://endpoint-3.example.com" }),
    ]);

    const result = await sendPushToUser("user-1", makePayload());

    expect(result.sent).toBe(3);
    expect(result.failed).toBe(0);
    expect(mockWebpushSendNotification).toHaveBeenCalledTimes(3);
  });

  it("passes correct subscription fields to webpush.sendNotification", async () => {
    const sub = makeSub({
      endpoint: "https://specific-endpoint.example.com",
      p256dh: "specific-p256dh",
      auth: "specific-auth",
    });
    mockSubFindMany.mockResolvedValue([sub]);

    await sendPushToUser("user-1", makePayload());

    expect(mockWebpushSendNotification).toHaveBeenCalledWith(
      {
        endpoint: "https://specific-endpoint.example.com",
        keys: {
          p256dh: "specific-p256dh",
          auth: "specific-auth",
        },
      },
      expect.any(String),
      { TTL: 3600 }
    );
  });

  it("sends the payload as a JSON string", async () => {
    const payload = makePayload({
      title: "Custom title",
      body: "Custom body",
      url: "/trades/123",
    });

    await sendPushToUser("user-1", payload);

    const jsonArg = mockWebpushSendNotification.mock.calls[0][1] as string;
    const parsed = JSON.parse(jsonArg) as Record<string, unknown>;
    expect(parsed.title).toBe("Custom title");
    expect(parsed.body).toBe("Custom body");
    expect(parsed.url).toBe("/trades/123");
  });
});

// ============================================================
// sendPushToUser — expired subscription cleanup
// ============================================================

describe("sendPushToUser — expired subscription cleanup (410/404)", () => {
  it("counts failed when sendNotification throws with a non-expiry status code", async () => {
    mockWebpushSendNotification.mockRejectedValue({ statusCode: 500 });

    const result = await sendPushToUser("user-1", makePayload());

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    // Non-expiry errors do not trigger deleteMany for the subscription
    expect(mockSubDeleteMany).not.toHaveBeenCalled();
  });

  it("cleans up subscription and counts failed when statusCode is 410 (Gone)", async () => {
    mockSubFindMany.mockResolvedValue([makeSub({ id: "sub-expired" })]);
    mockWebpushSendNotification.mockRejectedValue({ statusCode: 410 });

    const result = await sendPushToUser("user-1", makePayload());

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(mockSubDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["sub-expired"] } },
      })
    );
  });

  it("cleans up subscription and counts failed when statusCode is 404 (Not Found)", async () => {
    mockSubFindMany.mockResolvedValue([makeSub({ id: "sub-404" })]);
    mockWebpushSendNotification.mockRejectedValue({ statusCode: 404 });

    const result = await sendPushToUser("user-1", makePayload());

    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
    expect(mockSubDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["sub-404"] } },
      })
    );
  });

  it("cleans up only expired subs and counts sent+failed when mixed results", async () => {
    mockSubFindMany.mockResolvedValue([
      makeSub({ id: "sub-good", endpoint: "https://good-endpoint.example.com" }),
      makeSub({ id: "sub-gone", endpoint: "https://gone-endpoint.example.com" }),
    ]);

    // First call succeeds, second throws 410
    mockWebpushSendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce({ statusCode: 410 });

    const result = await sendPushToUser("user-1", makePayload());

    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(mockSubDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["sub-gone"] } },
      })
    );
  });

  it("does not call deleteMany when no subscriptions expired", async () => {
    mockWebpushSendNotification.mockResolvedValue({ statusCode: 201 });

    await sendPushToUser("user-1", makePayload());

    expect(mockSubDeleteMany).not.toHaveBeenCalled();
  });
});

// ============================================================
// savePushSubscription
// ============================================================

describe("savePushSubscription", () => {
  it("upserts the subscription by endpoint", async () => {
    const sub = {
      endpoint: "https://fcm.example.com/send/token",
      keys: { p256dh: "key-p256dh", auth: "key-auth" },
    };

    await savePushSubscription("user-1", sub, "Mozilla/5.0");

    expect(mockSubUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: sub.endpoint },
        create: expect.objectContaining({
          userId: "user-1",
          endpoint: sub.endpoint,
          p256dh: "key-p256dh",
          auth: "key-auth",
          userAgent: "Mozilla/5.0",
        }),
        update: expect.objectContaining({
          userId: "user-1",
          p256dh: "key-p256dh",
          auth: "key-auth",
        }),
      })
    );
  });

  it("sets pushEnabled to true in NotificationPreference", async () => {
    await savePushSubscription("user-1", {
      endpoint: "https://fcm.example.com/send/token",
      keys: { p256dh: "k", auth: "a" },
    });

    expect(mockPrefUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({ pushEnabled: true }),
        update: expect.objectContaining({ pushEnabled: true }),
      })
    );
  });

  it("stores null userAgent when not provided", async () => {
    await savePushSubscription("user-1", {
      endpoint: "https://fcm.example.com/send/token",
      keys: { p256dh: "k", auth: "a" },
    });

    expect(mockSubUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userAgent: null }),
      })
    );
  });
});

// ============================================================
// removePushSubscription
// ============================================================

describe("removePushSubscription", () => {
  it("calls deleteMany with userId and endpoint", async () => {
    mockSubCount.mockResolvedValue(1); // still has one remaining sub

    await removePushSubscription("user-1", "https://fcm.example.com/send/token");

    expect(mockSubDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", endpoint: "https://fcm.example.com/send/token" },
      })
    );
  });

  it("disables pushEnabled when no subscriptions remain", async () => {
    mockSubCount.mockResolvedValue(0); // last sub removed

    await removePushSubscription("user-1", "https://fcm.example.com/send/token");

    expect(mockPrefUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        data: { pushEnabled: false },
      })
    );
  });

  it("does NOT disable pushEnabled when other subscriptions remain", async () => {
    mockSubCount.mockResolvedValue(2); // still 2 subs left

    await removePushSubscription("user-1", "https://fcm.example.com/send/old");

    expect(mockPrefUpdateMany).not.toHaveBeenCalled();
  });
});

// ============================================================
// Regression: all 6 categories can each be individually disabled
// ============================================================

describe("sendPushToUser — regression: each category can be independently disabled", () => {
  const categoryTestCases = [
    {
      category: "trades",
      type: NOTIFICATION_TYPES.TRADE_CLOSED,
      disabledMap: { trades: false },
    },
    {
      category: "price_alerts",
      type: NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED,
      disabledMap: { price_alerts: false },
    },
    {
      category: "risk",
      type: NOTIFICATION_TYPES.RISK_DRAWDOWN,
      disabledMap: { risk: false },
    },
    {
      category: "tracking",
      type: NOTIFICATION_TYPES.TRACKING_PROVISIONAL,
      disabledMap: { tracking: false },
    },
    {
      category: "integrity",
      type: NOTIFICATION_TYPES.QUALIFICATION_MISSED,
      disabledMap: { integrity: false },
    },
    {
      category: "clan",
      type: NOTIFICATION_TYPES.CLAN_JOIN_APPROVED,
      disabledMap: { clan: false },
    },
  ] as const;

  for (const { category, type, disabledMap } of categoryTestCases) {
    it(`suppresses ${String(type)} push when ${category} category is disabled`, async () => {
      mockPrefFindUnique.mockResolvedValue(
        makePrefs({ pushCategories: disabledMap })
      );

      const result = await sendPushToUser("user-1", makePayload({ type }));

      expect(result).toEqual({ sent: 0, failed: 0 });
      expect(mockWebpushSendNotification).not.toHaveBeenCalled();
    });
  }
});
