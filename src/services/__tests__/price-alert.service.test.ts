import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mock declarations (must come before vi.mock calls) ----

const mockPriceAlertCount = vi.fn();
const mockPriceAlertCreate = vi.fn();
const mockPriceAlertUpdateMany = vi.fn();
const mockPriceAlertUpdate = vi.fn();
const mockPriceAlertDeleteMany = vi.fn();
const mockPriceAlertFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    priceAlert: {
      count: (...args: unknown[]) => mockPriceAlertCount(...args),
      create: (...args: unknown[]) => mockPriceAlertCreate(...args),
      updateMany: (...args: unknown[]) => mockPriceAlertUpdateMany(...args),
      update: (...args: unknown[]) => mockPriceAlertUpdate(...args),
      deleteMany: (...args: unknown[]) => mockPriceAlertDeleteMany(...args),
      findMany: (...args: unknown[]) => mockPriceAlertFindMany(...args),
    },
  },
}));

// Mock price-pool service
const mockGetDisplayPrice = vi.fn();
const mockGetAlertHighLow = vi.fn().mockResolvedValue(null);
vi.mock("@/services/price-pool.service", () => ({
  getDisplayPrice: (...args: unknown[]) => mockGetDisplayPrice(...args),
  getAlertHighLow: (...args: unknown[]) => mockGetAlertHighLow(...args),
}));

// Mock createNotification from notification service
const mockCreateNotification = vi.fn();
vi.mock("@/services/notification.service", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

import {
  createPriceAlert,
  cancelPriceAlert,
  deletePriceAlert,
  evaluatePriceAlerts,
  expireStaleAlerts,
  listPriceAlerts,
  getActiveAlertCount,
} from "@/services/price-alert.service";
import { MAX_PRICE_ALERTS_PER_USER } from "@/lib/notification-types";

// ---- Factory helpers ----

function makePriceAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: "alert-1",
    userId: "user-1",
    symbol: "EURUSD",
    condition: "ABOVE" as const,
    targetPrice: 1.1,
    sourceGroup: null,
    status: "ACTIVE",
    lastSeenPrice: null,
    priceAtCreation: null,
    triggeredAt: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date("2026-01-01T10:00:00Z"),
    ...overrides,
  };
}

function makeDisplayPrice(price: number | null, overrides: Record<string, unknown> = {}) {
  return {
    price,
    status: price === null ? "no_price" : "fresh_same_source",
    scope: price === null ? "none" : "display",
    crossSource: false,
    marketOpen: true,
    isEstimated: false,
    sourceGroup: "icmarkets|demo|mt5",
    ...overrides,
  };
}

// ---- createPriceAlert ----

describe("createPriceAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPriceAlertCount.mockResolvedValue(0); // under limit by default
    mockPriceAlertCreate.mockResolvedValue(makePriceAlert());
    mockPriceAlertUpdate.mockResolvedValue(makePriceAlert({ status: "TRIGGERED" }));
    mockCreateNotification.mockResolvedValue({ id: "notif-1", delivered: true, skipped: false });
  });

  it("creates an ABOVE alert and returns it", async () => {
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09)); // below target, no trigger

    const result = await createPriceAlert({
      userId: "user-1",
      symbol: "EURUSD",
      condition: "ABOVE",
      targetPrice: 1.1,
    });

    expect(result.error).toBeNull();
    expect(result.alert).not.toBeNull();
    expect(result.alert!.id).toBe("alert-1");
    expect(mockPriceAlertCreate).toHaveBeenCalledOnce();
  });

  it("creates a BELOW alert and returns it", async () => {
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.11)); // above target, no trigger for BELOW

    const result = await createPriceAlert({
      userId: "user-1",
      symbol: "EURUSD",
      condition: "BELOW",
      targetPrice: 1.1,
    });

    expect(result.error).toBeNull();
    expect(result.alert).not.toBeNull();
    expect(mockPriceAlertCreate).toHaveBeenCalledOnce();
  });

  it("persists lastSeenPrice and priceAtCreation from current price at creation time", async () => {
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09));

    await createPriceAlert({
      userId: "user-1",
      symbol: "EURUSD",
      condition: "ABOVE",
      targetPrice: 1.1,
    });

    expect(mockPriceAlertCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastSeenPrice: 1.09,
          priceAtCreation: 1.09,
        }),
      })
    );
  });

  it("sets expiresAt to 30 days in the future", async () => {
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09));

    await createPriceAlert({
      userId: "user-1",
      symbol: "EURUSD",
      condition: "ABOVE",
      targetPrice: 1.1,
    });

    const createCall = mockPriceAlertCreate.mock.calls[0][0];
    const expiresAt = createCall.data.expiresAt as Date;
    const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(daysUntilExpiry).toBeGreaterThan(29);
    expect(daysUntilExpiry).toBeLessThanOrEqual(30);
  });

  it("rejects creation when user is at MAX_PRICE_ALERTS_PER_USER limit", async () => {
    mockPriceAlertCount.mockResolvedValue(MAX_PRICE_ALERTS_PER_USER);

    const result = await createPriceAlert({
      userId: "user-1",
      symbol: "EURUSD",
      condition: "ABOVE",
      targetPrice: 1.1,
    });

    expect(result.error).toBe("MAX_ALERTS_REACHED");
    expect(result.alert).toBeNull();
    expect(mockPriceAlertCreate).not.toHaveBeenCalled();
  });

  it("allows creation when user is one below the limit", async () => {
    mockPriceAlertCount.mockResolvedValue(MAX_PRICE_ALERTS_PER_USER - 1);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09));

    const result = await createPriceAlert({
      userId: "user-1",
      symbol: "EURUSD",
      condition: "ABOVE",
      targetPrice: 1.1,
    });

    expect(result.error).toBeNull();
    expect(mockPriceAlertCreate).toHaveBeenCalledOnce();
  });

  it("passes sourceGroup to getDisplayPrice", async () => {
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09));

    await createPriceAlert({
      userId: "user-1",
      symbol: "EURUSD",
      condition: "ABOVE",
      targetPrice: 1.1,
      sourceGroup: "icmarkets|demo|mt5",
    });

    expect(mockGetDisplayPrice).toHaveBeenCalledWith("EURUSD", "icmarkets|demo|mt5");
  });

  // ---- Immediate trigger on creation ----

  describe("immediate trigger on creation", () => {
    it("triggers ABOVE alert immediately when currentPrice >= targetPrice", async () => {
      mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.1)); // exactly at target

      const result = await createPriceAlert({
        userId: "user-1",
        symbol: "EURUSD",
        condition: "ABOVE",
        targetPrice: 1.1,
      });

      expect(mockPriceAlertUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "alert-1" },
          data: expect.objectContaining({ status: "TRIGGERED" }),
        })
      );
      expect(mockCreateNotification).toHaveBeenCalledOnce();
      expect(result.alert!.status).toBe("TRIGGERED");
    });

    it("triggers ABOVE alert immediately when currentPrice is above targetPrice", async () => {
      mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.15)); // above target

      const result = await createPriceAlert({
        userId: "user-1",
        symbol: "EURUSD",
        condition: "ABOVE",
        targetPrice: 1.1,
      });

      expect(mockPriceAlertUpdate).toHaveBeenCalledOnce();
      expect(mockCreateNotification).toHaveBeenCalledOnce();
      expect(result.alert!.status).toBe("TRIGGERED");
    });

    it("triggers BELOW alert immediately when currentPrice <= targetPrice", async () => {
      mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09)); // below target

      const result = await createPriceAlert({
        userId: "user-1",
        symbol: "EURUSD",
        condition: "BELOW",
        targetPrice: 1.1,
      });

      expect(mockPriceAlertUpdate).toHaveBeenCalledOnce();
      expect(mockCreateNotification).toHaveBeenCalledOnce();
      expect(result.alert!.status).toBe("TRIGGERED");
    });

    it("does NOT trigger ABOVE alert when price is below target", async () => {
      mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09)); // below target

      await createPriceAlert({
        userId: "user-1",
        symbol: "EURUSD",
        condition: "ABOVE",
        targetPrice: 1.1,
      });

      expect(mockPriceAlertUpdate).not.toHaveBeenCalled();
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("does NOT trigger BELOW alert when price is above target", async () => {
      mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.11)); // above target

      await createPriceAlert({
        userId: "user-1",
        symbol: "EURUSD",
        condition: "BELOW",
        targetPrice: 1.1,
      });

      expect(mockPriceAlertUpdate).not.toHaveBeenCalled();
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("does NOT trigger when currentPrice is null (no price data)", async () => {
      mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(null));

      await createPriceAlert({
        userId: "user-1",
        symbol: "EURUSD",
        condition: "ABOVE",
        targetPrice: 1.1,
      });

      expect(mockPriceAlertUpdate).not.toHaveBeenCalled();
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("sends notification with correct symbol, condition and prices in body", async () => {
      mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.1));

      await createPriceAlert({
        userId: "user-1",
        symbol: "EURUSD",
        condition: "ABOVE",
        targetPrice: 1.1,
      });

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          title: "EURUSD hit your target",
          payload: expect.objectContaining({
            alertId: "alert-1",
            symbol: "EURUSD",
            condition: "ABOVE",
            targetPrice: 1.1,
            currentPrice: 1.1,
          }),
          dedupeKey: "price_alert:alert-1",
        })
      );
    });
  });
});

// ---- cancelPriceAlert ----

describe("cancelPriceAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true when an active alert is successfully cancelled", async () => {
    mockPriceAlertUpdateMany.mockResolvedValue({ count: 1 });

    const result = await cancelPriceAlert("alert-1", "user-1");

    expect(result).toBe(true);
    expect(mockPriceAlertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alert-1", userId: "user-1", status: "ACTIVE" },
        data: { status: "CANCELLED" },
      })
    );
  });

  it("returns false when alert not found or not ACTIVE", async () => {
    mockPriceAlertUpdateMany.mockResolvedValue({ count: 0 });

    const result = await cancelPriceAlert("alert-1", "user-1");

    expect(result).toBe(false);
  });

  it("scopes cancel to the owning userId (cannot cancel another user's alert)", async () => {
    mockPriceAlertUpdateMany.mockResolvedValue({ count: 0 });

    const result = await cancelPriceAlert("alert-1", "wrong-user");

    expect(result).toBe(false);
    expect(mockPriceAlertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "wrong-user" }),
      })
    );
  });
});

// ---- deletePriceAlert ----

describe("deletePriceAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("soft-hides alert (sets hiddenFromUser=true) instead of hard-deleting", async () => {
    mockPriceAlertUpdateMany.mockResolvedValue({ count: 1 });

    const result = await deletePriceAlert("alert-1", "user-1");

    expect(result).toBe(true);
    expect(mockPriceAlertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "alert-1", userId: "user-1" }),
        data: { hiddenFromUser: true },
      })
    );
  });

  it("returns false when alert not found", async () => {
    mockPriceAlertUpdateMany.mockResolvedValue({ count: 0 });

    const result = await deletePriceAlert("nonexistent", "user-1");

    expect(result).toBe(false);
  });

  it("scopes soft-hide to the owning userId", async () => {
    mockPriceAlertUpdateMany.mockResolvedValue({ count: 0 });

    await deletePriceAlert("alert-1", "wrong-user");

    expect(mockPriceAlertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "wrong-user" }),
      })
    );
  });

  it("only allows hiding non-ACTIVE alerts", async () => {
    mockPriceAlertUpdateMany.mockResolvedValue({ count: 1 });

    await deletePriceAlert("alert-1", "user-1");

    expect(mockPriceAlertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: "ACTIVE" } }),
      })
    );
  });
});

// ---- listPriceAlerts ----

describe("listPriceAlerts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns alerts for a user ordered by createdAt desc", async () => {
    const alerts = [
      makePriceAlert({ id: "alert-2", createdAt: new Date("2026-01-02") }),
      makePriceAlert({ id: "alert-1", createdAt: new Date("2026-01-01") }),
    ];
    mockPriceAlertFindMany.mockResolvedValue(alerts);

    const result = await listPriceAlerts("user-1");

    expect(result).toHaveLength(2);
    expect(mockPriceAlertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", hiddenFromUser: false },
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("returns empty array when user has no alerts", async () => {
    mockPriceAlertFindMany.mockResolvedValue([]);

    const result = await listPriceAlerts("user-1");

    expect(result).toHaveLength(0);
  });
});

// ---- evaluatePriceAlerts ----

// ---- getActiveAlertCount ----

describe("getActiveAlertCount", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the count of active alerts for a user", async () => {
    mockPriceAlertCount.mockResolvedValue(5);

    const count = await getActiveAlertCount("user-1");

    expect(count).toBe(5);
    expect(mockPriceAlertCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", status: "ACTIVE" },
      })
    );
  });
});

// ---- expireStaleAlerts ----

describe("expireStaleAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPriceAlertUpdateMany.mockResolvedValue({ count: 1 });
    mockCreateNotification.mockResolvedValue({ id: "notif-1", delivered: true, skipped: false });
  });

  it("returns 0 when no alerts are expired", async () => {
    mockPriceAlertFindMany.mockResolvedValue([]);

    const count = await expireStaleAlerts();

    expect(count).toBe(0);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("expires alerts past their expiresAt and sends notification", async () => {
    const expiredAlert = makePriceAlert({
      id: "expired-1",
      expiresAt: new Date(Date.now() - 1000), // already past
    });
    mockPriceAlertFindMany.mockResolvedValue([expiredAlert]);

    const count = await expireStaleAlerts();

    expect(count).toBe(1);
    expect(mockPriceAlertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["expired-1"] } },
        data: { status: "EXPIRED" },
      })
    );
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        type: "price_alert_expired",
      })
    );
  });

  it("sends batch notification when multiple alerts expire for same user", async () => {
    mockPriceAlertFindMany.mockResolvedValue([
      makePriceAlert({ id: "expired-1" }),
      makePriceAlert({ id: "expired-2", symbol: "XAUUSD" }),
    ]);

    await expireStaleAlerts();

    // Should send one batch notification, not two individual ones
    expect(mockCreateNotification).toHaveBeenCalledTimes(1);
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "2 alerts expired",
      })
    );
  });
});

// ---- evaluatePriceAlerts ----

describe("evaluatePriceAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPriceAlertUpdate.mockResolvedValue({});
    mockPriceAlertUpdateMany.mockResolvedValue({ count: 1 });
    mockCreateNotification.mockResolvedValue({ id: "notif-1", delivered: true, skipped: false });
    mockGetAlertHighLow.mockResolvedValue(null); // default: no candle data, falls back to current price
    // expireStaleAlerts runs first — return no expired alerts by default
    mockPriceAlertFindMany.mockResolvedValue([]);
  });

  it("returns 0 immediately when there are no active alerts", async () => {
    // First call: expireStaleAlerts finds no expired alerts
    // Second call: evaluatePriceAlerts finds no active alerts
    mockPriceAlertFindMany.mockResolvedValue([]);

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(0);
    expect(mockGetDisplayPrice).not.toHaveBeenCalled();
  });

  it("triggers ABOVE alert when price crosses threshold", async () => {
    // First call: expire (none), second call: active alerts
    mockPriceAlertFindMany
      .mockResolvedValueOnce([]) // expireStaleAlerts
      .mockResolvedValueOnce([makePriceAlert({ condition: "ABOVE", targetPrice: 1.1 })]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.11));

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(1);
    expect(mockPriceAlertUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alert-1" },
        data: expect.objectContaining({ status: "TRIGGERED" }),
      })
    );
    expect(mockCreateNotification).toHaveBeenCalledOnce();
  });

  it("triggers BELOW alert when price crosses threshold", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ condition: "BELOW", targetPrice: 1.1 })]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09));

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(1);
    expect(mockCreateNotification).toHaveBeenCalledOnce();
  });

  it("does not trigger ABOVE alert when price is below threshold", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ condition: "ABOVE", targetPrice: 1.1 })]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09));

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(0);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("does not trigger BELOW alert when price is above threshold", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ condition: "BELOW", targetPrice: 1.1 })]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.11));

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(0);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("skips evaluation when price is null (no price data)", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ condition: "ABOVE", targetPrice: 1.1 })]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(null));

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(0);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("skips evaluation when status is no_price", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ condition: "ABOVE", targetPrice: 1.1 })]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(null, { status: "no_price" }));

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(0);
  });

  it("skips triggering on stale price when market is closed (weekend guard)", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ condition: "ABOVE", targetPrice: 1.1 })]);
    mockGetDisplayPrice.mockResolvedValue(
      makeDisplayPrice(1.15, {
        marketOpen: false,
        status: "stale_same_source",
      })
    );

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(0);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("still updates lastSeenPrice on stale market-closed price (no trigger)", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ condition: "ABOVE", targetPrice: 1.1 })]);
    mockGetDisplayPrice.mockResolvedValue(
      makeDisplayPrice(1.15, {
        marketOpen: false,
        status: "stale_same_source",
      })
    );

    await evaluatePriceAlerts();

    expect(mockPriceAlertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lastSeenPrice: 1.15 },
      })
    );
  });

  it("DOES trigger on fresh price even when market is closed (crypto 24/7)", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ symbol: "BTCUSD", condition: "ABOVE", targetPrice: 50000 })]);
    mockGetDisplayPrice.mockResolvedValue(
      makeDisplayPrice(51000, {
        marketOpen: false,
        status: "fresh_same_source",
      })
    );

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(1);
  });

  it("batches lastSeenPrice updates for non-triggered alerts", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makePriceAlert({ id: "alert-1", condition: "ABOVE", targetPrice: 1.2 }),
        makePriceAlert({ id: "alert-2", condition: "ABOVE", targetPrice: 1.3 }),
      ]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.15));

    await evaluatePriceAlerts();

    // Should batch update both non-triggered alerts with updateMany
    expect(mockPriceAlertUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["alert-1", "alert-2"] } },
        data: { lastSeenPrice: 1.15 },
      })
    );
  });

  it("triggers multiple alerts in the same evaluation run", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makePriceAlert({ id: "alert-1", symbol: "EURUSD", condition: "ABOVE", targetPrice: 1.1 }),
        makePriceAlert({ id: "alert-2", symbol: "EURUSD", condition: "BELOW", targetPrice: 1.05 }),
      ]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.11));

    const triggered = await evaluatePriceAlerts();

    expect(triggered).toBe(1);
  });

  it("batches price lookups per symbol+sourceGroup group", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makePriceAlert({ id: "alert-1", symbol: "EURUSD", condition: "ABOVE", targetPrice: 1.1 }),
        makePriceAlert({ id: "alert-2", symbol: "EURUSD", condition: "BELOW", targetPrice: 1.05 }),
        makePriceAlert({ id: "alert-3", symbol: "XAUUSD", condition: "ABOVE", targetPrice: 2000 }),
      ]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09));

    await evaluatePriceAlerts();

    expect(mockGetDisplayPrice).toHaveBeenCalledTimes(2);
  });

  it("handles alerts with sourceGroup correctly in price lookup", async () => {
    const sg = "icmarkets-demo-mt5";
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ condition: "ABOVE", targetPrice: 1.1, sourceGroup: sg })]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09));

    await evaluatePriceAlerts();

    expect(mockGetDisplayPrice).toHaveBeenCalledWith("EURUSD", sg);
  });

  it("handles alerts without sourceGroup (null becomes undefined in lookup)", async () => {
    mockPriceAlertFindMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([makePriceAlert({ condition: "ABOVE", targetPrice: 1.1, sourceGroup: null })]);
    mockGetDisplayPrice.mockResolvedValue(makeDisplayPrice(1.09));

    await evaluatePriceAlerts();

    expect(mockGetDisplayPrice).toHaveBeenCalledWith("EURUSD", undefined);
  });
});
