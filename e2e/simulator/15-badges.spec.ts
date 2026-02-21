import { test, expect } from "@playwright/test";
import { ADMIN, TRADER1 } from "../helpers/seed-accounts";
import { createAgent } from "../helpers/test-utils";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("15 — Badges & Ranking System", () => {
  test.describe("Admin Badge CRUD", () => {
    test("admin can list badge definitions", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/badges");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.badges).toBeDefined();
      expect(Array.isArray(body.badges)).toBe(true);
      // Seed should have created at least 9 rank + 4 perf + 2 trophy = 15 badges
      expect(body.badges.length).toBeGreaterThanOrEqual(15);
    });

    test("admin can filter badges by category", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/badges?category=RANK");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.badges.length).toBe(9);
      for (const badge of body.badges) {
        expect(badge.category).toBe("RANK");
      }
    });

    test("admin can create a new badge", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.post("/api/admin/badges", {
        key: `test-badge-${Date.now()}`,
        category: "OTHER",
        name: "Test Badge",
        description: "A test badge",
        requirementsJson: { type: "manual" },
        enabled: true,
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.badge.name).toBe("Test Badge");
      expect(body.badge.category).toBe("OTHER");
    });

    test("admin can update a badge", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);

      // Get badges and update the first one
      const listRes = await agent.get("/api/admin/badges?category=OTHER");
      const listBody = await listRes.json();
      const badge = listBody.badges[0];

      if (badge) {
        const res = await agent.put(`/api/admin/badges/${badge.id}`, {
          name: "Updated Test Badge",
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.badge.name).toBe("Updated Test Badge");
      }
    });

    test("admin can soft-delete a badge", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);

      // Create a badge to delete
      const createRes = await agent.post("/api/admin/badges", {
        key: `delete-test-${Date.now()}`,
        category: "OTHER",
        name: "To Delete",
        requirementsJson: { type: "manual" },
      });
      const { badge } = await createRes.json();

      const res = await agent.delete(`/api/admin/badges/${badge.id}`);
      expect(res.status()).toBe(200);

      // Verify it's soft-deleted
      const getRes = await agent.get(`/api/admin/badges/${badge.id}`);
      const getBody = await getRes.json();
      expect(getBody.badge.isDeleted).toBe(true);
      expect(getBody.badge.enabled).toBe(false);
    });

    test("admin can reorder rank badges", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);

      const listRes = await agent.get("/api/admin/badges?category=RANK");
      const { badges } = await listRes.json();

      // Reverse the order
      const items = badges.map((b: { id: string }, i: number) => ({
        id: b.id,
        displayOrder: badges.length - 1 - i,
      }));

      const res = await agent.put("/api/admin/badges/reorder", { items });
      expect(res.status()).toBe(200);

      // Restore original order
      const restoreItems = badges.map((b: { id: string; displayOrder: number }) => ({
        id: b.id,
        displayOrder: b.displayOrder,
      }));
      await agent.put("/api/admin/badges/reorder", { items: restoreItems });
    });

    test("non-admin cannot access badge admin routes", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.get("/api/admin/badges");
      expect(res.status()).toBe(403);
    });
  });

  test.describe("Badge Audit Trail", () => {
    test("admin can view badge admin changes", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/badges/audit");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.changes).toBeDefined();
      expect(body.pagination).toBeDefined();
    });
  });

  test.describe("User Badge API", () => {
    test("user can fetch own badges", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.get(`/api/users/${agent.userId}/badges`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.rank).toBeDefined();
      expect(body.performance).toBeDefined();
      expect(body.trophy).toBeDefined();
      expect(body.nextRank).toBeDefined();
    });

    test("user can fetch badge history", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.get(`/api/users/${agent.userId}/badges/history`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.badges).toBeDefined();
      expect(body.pagination).toBeDefined();
    });
  });

  test.describe("Recompute & Dry-run", () => {
    test("admin can recompute badges for a user", async ({ request }) => {
      const traderAgent = await createAgent(request, TRADER1, BASE);
      const agent = await createAgent(request, ADMIN, BASE);

      const res = await agent.post("/api/admin/badges/recompute", {
        scope: "user",
        targetId: traderAgent.userId,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.result).toBeDefined();
      expect(body.result.userId).toBe(traderAgent.userId);
    });

    test("admin can start a global recompute", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);

      const res = await agent.post("/api/admin/badges/recompute", {
        scope: "all",
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.jobId).toBeTruthy();
      expect(body.status).toBe("running");

      // Check progress
      const progressRes = await agent.get(
        `/api/admin/badges/recompute?jobId=${body.jobId}`
      );
      expect(progressRes.status()).toBe(200);
    });

    test("admin can run dry-run on a badge", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);

      // Get a rank badge
      const listRes = await agent.get("/api/admin/badges?category=RANK");
      const { badges } = await listRes.json();
      const bronzeBadge = badges.find(
        (b: { key: string }) => b.key === "rank-bronze"
      );

      if (bronzeBadge) {
        const res = await agent.post("/api/admin/badges/dry-run", {
          badgeId: bronzeBadge.id,
          requirementsJson: { type: "rank", min_closed_trades: 5 },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.wouldGain).toBeDefined();
        expect(body.wouldLose).toBeDefined();
        expect(typeof body.unchanged).toBe("number");
      }
    });
  });
});
