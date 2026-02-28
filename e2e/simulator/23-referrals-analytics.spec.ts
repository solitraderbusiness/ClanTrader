import { test, expect } from "@playwright/test";
import { ADMIN, TRADER1 } from "../helpers/seed-accounts";
import { createAgent } from "../helpers/test-utils";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("23 — Referrals & Analytics", () => {
  // -----------------------------------------------------------------------
  // Referral Tracking
  // -----------------------------------------------------------------------
  test.describe("Referral Tracking", () => {
    test("track referral (LINK_COPIED) → 200", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.post("/api/referrals/track", { type: "LINK_COPIED" });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test("track referral (LINK_SHARED) → 200", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.post("/api/referrals/track", { type: "LINK_SHARED" });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test("track referral with invalid type → 400", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.post("/api/referrals/track", { type: "INVALID_TYPE" });
      expect(res.status()).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // Analytics
  // -----------------------------------------------------------------------
  test.describe("Analytics", () => {
    test("track analytics event → 200", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.post("/api/analytics/track", {
        event: "page_view",
        metadata: { page: "/home" },
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test("unauthenticated analytics → 401", async ({ request }) => {
      const res = await request.post(`${BASE}/api/analytics/track`, {
        headers: { "content-type": "application/json" },
        data: { event: "page_view" },
      });
      expect(res.status()).toBe(401);
    });
  });

  // -----------------------------------------------------------------------
  // Admin Referrals
  // -----------------------------------------------------------------------
  test.describe("Admin Referrals", () => {
    test("admin referrals overview → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/referrals");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.overview).toBeDefined();
      expect(body.topReferrers).toBeDefined();
      expect(body.dailyStats).toBeDefined();
    });

    test("non-admin referrals → 403", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.get("/api/admin/referrals");
      expect(res.status()).toBe(403);
    });
  });
});
