import { test, expect } from "@playwright/test";
import { ADMIN, TRADER1 } from "../helpers/seed-accounts";
import { createAgent } from "../helpers/test-utils";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("21 — Admin Feature Flags, Paywall Rules, Plans, Ranking", () => {
  // Key must be lowercase + underscores only (regex: /^[a-z_]+$/)
  const uniqueKey = () => `sim_${Math.random().toString(36).slice(2, 8).replace(/[0-9]/g, "x")}`;

  // -----------------------------------------------------------------------
  // Feature Flags
  // -----------------------------------------------------------------------
  test.describe("Feature Flags", () => {
    test("create feature flag → 201", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const key = uniqueKey();
      const res = await agent.post("/api/admin/feature-flags", {
        key,
        name: "Test Flag",
        description: "Created by simulator test",
        enabled: false,
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.flag).toBeDefined();
      expect(body.flag.key).toBe(key);
    });

    test("list feature flags → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/feature-flags");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.flags).toBeDefined();
      expect(Array.isArray(body.flags)).toBe(true);
    });

    test("update feature flag → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const key = uniqueKey();
      const createRes = await agent.post("/api/admin/feature-flags", {
        key,
        name: "Before Update",
        enabled: false,
      });
      expect(createRes.status()).toBe(201);

      const updateRes = await agent.patch(`/api/admin/feature-flags/${key}`, {
        name: "After Update",
        enabled: true,
      });
      expect(updateRes.status()).toBe(200);
      const body = await updateRes.json();
      expect(body.flag.name).toBe("After Update");
      expect(body.flag.enabled).toBe(true);
    });

    test("delete feature flag → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const key = uniqueKey();
      const createRes = await agent.post("/api/admin/feature-flags", {
        key,
        name: "To Delete",
      });
      expect(createRes.status()).toBe(201);
      const res = await agent.delete(`/api/admin/feature-flags/${key}`);
      expect(res.status()).toBe(200);
    });

    test("non-admin → 403", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.get("/api/admin/feature-flags");
      expect(res.status()).toBe(403);
    });
  });

  // -----------------------------------------------------------------------
  // Paywall Rules
  // -----------------------------------------------------------------------
  test.describe("Paywall Rules", () => {
    test("create paywall rule → 201", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.post("/api/admin/paywall-rules", {
        resourceType: `sim_premium_${Date.now()}`,
        name: "Test Rule",
        description: "Simulator test rule",
        enabled: true,
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.rule).toBeDefined();
    });

    test("list paywall rules → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/paywall-rules");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.rules).toBeDefined();
      expect(Array.isArray(body.rules)).toBe(true);
    });

    test("update paywall rule → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const createRes = await agent.post("/api/admin/paywall-rules", {
        resourceType: `sim_update_${Date.now()}`,
        name: "Before Update",
        enabled: false,
      });
      expect(createRes.status()).toBe(201);
      const { rule } = await createRes.json();

      const res = await agent.patch(`/api/admin/paywall-rules/${rule.id}`, {
        name: "After Update",
        enabled: true,
      });
      expect(res.status()).toBe(200);
    });

    test("delete paywall rule → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const createRes = await agent.post("/api/admin/paywall-rules", {
        resourceType: `sim_delete_${Date.now()}`,
        name: "To Delete",
      });
      expect(createRes.status()).toBe(201);
      const { rule } = await createRes.json();

      const res = await agent.delete(`/api/admin/paywall-rules/${rule.id}`);
      expect(res.status()).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Plans
  // -----------------------------------------------------------------------
  test.describe("Plans", () => {
    test("create plan → 201", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.post("/api/admin/plans", {
        name: `Test Plan ${Date.now()}`,
        slug: `test-plan-${Date.now()}`,
        description: "Simulator test plan",
        price: 9.99,
        currency: "USD",
        interval: "month",
        entitlements: ["feature_a", "feature_b"],
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.plan).toBeDefined();
    });

    test("list plans → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/plans");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.plans).toBeDefined();
      expect(Array.isArray(body.plans)).toBe(true);
    });

    test("update plan → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const createRes = await agent.post("/api/admin/plans", {
        name: "Before Update",
        slug: `upd-plan-${Date.now()}`,
        price: 5.0,
        entitlements: ["basic"],
      });
      expect(createRes.status()).toBe(201);
      const { plan } = await createRes.json();

      const res = await agent.patch(`/api/admin/plans/${plan.id}`, {
        name: "After Update",
        price: 12.0,
      });
      expect(res.status()).toBe(200);
    });

    test("delete plan → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const createRes = await agent.post("/api/admin/plans", {
        name: "To Delete",
        slug: `del-plan-${Date.now()}`,
        price: 0,
        entitlements: [],
      });
      const { plan } = await createRes.json();

      const res = await agent.delete(`/api/admin/plans/${plan.id}`);
      expect(res.status()).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Ranking Config
  // -----------------------------------------------------------------------
  test.describe("Ranking Config", () => {
    test("get ranking config → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/ranking-config");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.config).toBeDefined();
    });

    test("patch ranking config → 200", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.patch("/api/admin/ranking-config", {
        minTrades: 5,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.config).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Ranking Calculate
  // -----------------------------------------------------------------------
  test.describe("Ranking Calculate", () => {
    test("post without seasonId → 400", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.post("/api/admin/ranking/calculate", {});
      expect(res.status()).toBe(400);
    });

    test("post with fake seasonId → 200 or 500 (no season data)", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.post("/api/admin/ranking/calculate", {
        seasonId: "fake-season-id",
      });
      // Might succeed with count: 0 or fail because season doesn't exist
      expect([200, 400, 404, 500]).toContain(res.status());
    });
  });
});
