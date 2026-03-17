import { test, expect } from "@playwright/test";
import { TRADER1 } from "../helpers/seed-accounts";
import { createStandaloneAgents } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("11 — Notifications & Price Alerts (REST)", () => {
  let ali: TestAgent;

  test.beforeAll(async () => {
    [ali] = await createStandaloneAgents([TRADER1], BASE);
  });

  test.afterAll(async () => {
    await ali.dispose();
  });

  // ── Notification Preferences ────────────────────────────────

  test("get default notification preferences", async () => {
    const res = await ali.get("/api/users/me/notification-preferences");
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Default: in-app on, all alerts
    expect(body.inAppEnabled).toBe(true);
    expect(body.deliveryMode).toBe("all");
  });

  test("update notification preferences", async () => {
    const res = await ali.patch("/api/users/me/notification-preferences", {
      deliveryMode: "critical_only",
    });
    expect(res.status()).toBe(200);

    // Verify persisted
    const getRes = await ali.get("/api/users/me/notification-preferences");
    const body = await getRes.json();
    expect(body.deliveryMode).toBe("critical_only");

    // Reset back
    await ali.patch("/api/users/me/notification-preferences", {
      deliveryMode: "all",
    });
  });

  // ── Unread Count ────────────────────────────────────────────

  test("get unread notification count", async () => {
    const res = await ali.get("/api/notifications/unread-count");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.count).toBe("number");
    expect(body.count).toBeGreaterThanOrEqual(0);
  });

  // ── Notification List ───────────────────────────────────────

  test("list notifications returns paginated items", async () => {
    const res = await ali.get("/api/notifications?limit=5");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    // nextCursor is null or string
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(true);
  });

  test("list notifications with severity filter", async () => {
    const res = await ali.get("/api/notifications?severity=CRITICAL&limit=5");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    // All items should be CRITICAL if any exist
    for (const item of body.items) {
      expect(item.severity).toBe("CRITICAL");
    }
  });

  test("list notifications with unread filter", async () => {
    const res = await ali.get("/api/notifications?unread=true&limit=5");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    for (const item of body.items) {
      expect(item.isRead).toBe(false);
    }
  });

  // ── Mark All Read ───────────────────────────────────────────

  test("mark all notifications as read", async () => {
    const res = await ali.patch("/api/notifications", {
      action: "mark_all_read",
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.updated).toBe("number");

    // Verify unread count is 0
    const countRes = await ali.get("/api/notifications/unread-count");
    const countBody = await countRes.json();
    expect(countBody.count).toBe(0);
  });

  // ── Price Alerts CRUD ───────────────────────────────────────

  let alertId: string;

  test("create a price alert", async () => {
    const res = await ali.post("/api/price-alerts", {
      symbol: "XAUUSD",
      condition: "ABOVE",
      targetPrice: 99999, // Unrealistic price to avoid immediate trigger
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.alert).toBeTruthy();
    expect(body.alert.symbol).toBe("XAUUSD");
    expect(body.alert.condition).toBe("ABOVE");
    expect(body.alert.targetPrice).toBe(99999);
    expect(body.alert.status).toBe("ACTIVE");
    alertId = body.alert.id;
  });

  test("list price alerts includes created alert", async () => {
    const res = await ali.get("/api/price-alerts");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.alerts)).toBe(true);
    const found = body.alerts.find((a: { id: string }) => a.id === alertId);
    expect(found).toBeTruthy();
    expect(found.status).toBe("ACTIVE");
  });

  test("cancel a price alert", async () => {
    const res = await ali.patch(`/api/price-alerts/${alertId}`);
    expect(res.status()).toBe(200);

    // Verify cancelled
    const listRes = await ali.get("/api/price-alerts");
    const body = await listRes.json();
    const found = body.alerts.find((a: { id: string }) => a.id === alertId);
    expect(found.status).toBe("CANCELLED");
  });

  test("delete a price alert", async () => {
    const res = await ali.del(`/api/price-alerts/${alertId}`);
    expect(res.status()).toBe(200);

    // Verify deleted
    const listRes = await ali.get("/api/price-alerts");
    const body = await listRes.json();
    const found = body.alerts.find((a: { id: string }) => a.id === alertId);
    expect(found).toBeFalsy();
  });

  test("create BELOW alert with immediate trigger when price is available", async () => {
    // targetPrice is very high — if current price is below it, should trigger immediately
    const res = await ali.post("/api/price-alerts", {
      symbol: "XAUUSD",
      condition: "BELOW",
      targetPrice: 999999, // Way above any real price — should trigger immediately
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    // If price was available, status should be TRIGGERED
    // If no price data (market closed / no EA running), it stays ACTIVE
    expect(["ACTIVE", "TRIGGERED"]).toContain(body.alert.status);

    // Cleanup
    if (body.alert.status === "ACTIVE") {
      await ali.patch(`/api/price-alerts/${body.alert.id}`);
    }
    await ali.del(`/api/price-alerts/${body.alert.id}`);
  });

  test("reject creation when max alerts reached", async () => {
    // Create 20 alerts to hit the limit
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await ali.post("/api/price-alerts", {
        symbol: "XAUUSD",
        condition: "ABOVE",
        targetPrice: 100000 + i,
      });
      const body = await res.json();
      if (body.alert?.id) ids.push(body.alert.id);
    }

    // 21st should fail
    const overLimitRes = await ali.post("/api/price-alerts", {
      symbol: "XAUUSD",
      condition: "ABOVE",
      targetPrice: 200000,
    });
    expect(overLimitRes.status()).toBe(400);
    const errorBody = await overLimitRes.json();
    expect(errorBody.code).toBe("MAX_ALERTS_REACHED");

    // Cleanup
    for (const id of ids) {
      await ali.patch(`/api/price-alerts/${id}`); // cancel first
      await ali.del(`/api/price-alerts/${id}`);
    }
  });

  test("validation rejects invalid price alert input", async () => {
    // Missing symbol
    const res1 = await ali.post("/api/price-alerts", {
      condition: "ABOVE",
      targetPrice: 2000,
    });
    expect(res1.status()).toBe(400);

    // Invalid condition
    const res2 = await ali.post("/api/price-alerts", {
      symbol: "XAUUSD",
      condition: "EQUALS",
      targetPrice: 2000,
    });
    expect(res2.status()).toBe(400);

    // Negative price
    const res3 = await ali.post("/api/price-alerts", {
      symbol: "XAUUSD",
      condition: "ABOVE",
      targetPrice: -100,
    });
    expect(res3.status()).toBe(400);
  });

  // ── Mark Single Read ────────────────────────────────────────

  test("mark individual notification as read", async () => {
    // Get any notification
    const listRes = await ali.get("/api/notifications?limit=1");
    const body = await listRes.json();

    if (body.items.length > 0) {
      const notifId = body.items[0].id;
      const res = await ali.patch(`/api/notifications/${notifId}`);
      expect(res.status()).toBe(200);
    }
    // If no notifications exist, this test passes silently (no data to test)
  });

  // ── Auth Guard ──────────────────────────────────────────────

  test("notifications API requires authentication", async () => {
    // Use a raw request without cookies
    const { request } = await import("@playwright/test");
    const ctx = await request.newContext({ baseURL: BASE });

    const res = await ctx.get(`${BASE}/api/notifications/unread-count`);
    expect(res.status()).toBe(401);

    const alertRes = await ctx.get(`${BASE}/api/price-alerts`);
    expect(alertRes.status()).toBe(401);

    await ctx.dispose();
  });
});
