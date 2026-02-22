import { test, expect } from "@playwright/test";
import { ADMIN, TRADER1 } from "../helpers/seed-accounts";
import { createAgent, createStandaloneAgent } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Badge seed data — same as prisma/seed.ts
// ---------------------------------------------------------------------------
const RANK_BADGES = [
  { key: "rank-bronze", name: "Bronze", displayOrder: 0, min_closed_trades: 10 },
  { key: "rank-silver", name: "Silver", displayOrder: 1, min_closed_trades: 25 },
  { key: "rank-gold", name: "Gold", displayOrder: 2, min_closed_trades: 50 },
  { key: "rank-platinum", name: "Platinum", displayOrder: 3, min_closed_trades: 100 },
  { key: "rank-a", name: "A", displayOrder: 4, min_closed_trades: 250 },
  { key: "rank-s", name: "S", displayOrder: 5, min_closed_trades: 500 },
  { key: "rank-ss", name: "SS", displayOrder: 6, min_closed_trades: 1000 },
  { key: "rank-sss", name: "SSS", displayOrder: 7, min_closed_trades: 2500 },
  { key: "rank-divine", name: "Divine", displayOrder: 8, min_closed_trades: 5000 },
];

const PERF_BADGES = [
  {
    key: "perf-sharpshooter", name: "Sharpshooter",
    description: "Win rate >= 60% over 100 trades",
    requirementsJson: { type: "performance", metric: "win_rate", window: 100, op: ">=", value: 0.6 },
  },
  {
    key: "perf-r-machine", name: "R-Machine",
    description: "Net R >= 10 over 50 trades",
    requirementsJson: { type: "performance", metric: "net_r", window: 50, op: ">=", value: 10 },
  },
  {
    key: "perf-steady-hands", name: "Steady Hands",
    description: "Max drawdown R <= 8 over 100 trades",
    requirementsJson: { type: "performance", metric: "max_drawdown_r", window: 100, op: "<=", value: 8 },
  },
  {
    key: "perf-consistent", name: "Consistent",
    description: "Avg R >= 0.2 over 100 trades",
    requirementsJson: { type: "performance", metric: "avg_r", window: 100, op: ">=", value: 0.2 },
  },
];

const TROPHY_BADGES = [
  {
    key: "trophy-champion", name: "Season Champion",
    description: "1st place in season composite ranking",
    requirementsJson: { type: "trophy", season_id: "*", lens: "composite", rank_min: 1, rank_max: 1 },
  },
  {
    key: "trophy-top3", name: "Podium Finish",
    description: "Top 3 in season composite ranking",
    requirementsJson: { type: "trophy", season_id: "*", lens: "composite", rank_min: 1, rank_max: 3 },
  },
];

const TOTAL_SEED_BADGES = RANK_BADGES.length + PERF_BADGES.length + TROPHY_BADGES.length; // 15

test.describe("15 — Badges & Ranking System", () => {
  let seedAdmin: TestAgent;

  // Ensure badge definitions exist before any tests run
  test.beforeAll(async () => {
    seedAdmin = await createStandaloneAgent(ADMIN, BASE);

    const listRes = await seedAdmin.get("/api/admin/badges?includeDeleted=true");
    const { badges } = await listRes.json();

    if (!badges || badges.length < TOTAL_SEED_BADGES) {
      // Seed rank badges
      for (const b of RANK_BADGES) {
        await seedAdmin.post("/api/admin/badges", {
          key: b.key,
          category: "RANK",
          name: b.name,
          description: `Awarded for closing ${b.min_closed_trades} valid trades`,
          requirementsJson: { type: "rank", min_closed_trades: b.min_closed_trades },
          displayOrder: b.displayOrder,
          enabled: true,
        });
      }
      // Seed performance badges
      for (const b of PERF_BADGES) {
        await seedAdmin.post("/api/admin/badges", {
          key: b.key,
          category: "PERFORMANCE",
          name: b.name,
          description: b.description,
          requirementsJson: b.requirementsJson,
          enabled: true,
        });
      }
      // Seed trophy badges
      for (const b of TROPHY_BADGES) {
        await seedAdmin.post("/api/admin/badges", {
          key: b.key,
          category: "TROPHY",
          name: b.name,
          description: b.description,
          requirementsJson: b.requirementsJson,
          enabled: true,
        });
      }
    }
  });

  test.afterAll(async () => {
    await seedAdmin?.dispose();
  });

  test.describe("Admin Badge CRUD", () => {
    test("admin can list badge definitions", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/badges");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.badges).toBeDefined();
      expect(Array.isArray(body.badges)).toBe(true);
      // Seed should have created at least 9 rank + 4 perf + 2 trophy = 15 badges
      expect(body.badges.length).toBeGreaterThanOrEqual(TOTAL_SEED_BADGES);
    });

    test("admin can filter badges by category", async ({ request }) => {
      const agent = await createAgent(request, ADMIN, BASE);
      const res = await agent.get("/api/admin/badges?category=RANK");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.badges.length).toBe(RANK_BADGES.length);
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

      // Create a badge to update
      const createRes = await agent.post("/api/admin/badges", {
        key: `update-test-${Date.now()}`,
        category: "OTHER",
        name: "Before Update",
        requirementsJson: { type: "manual" },
        enabled: true,
      });
      expect(createRes.status()).toBe(201);
      const { badge } = await createRes.json();

      const res = await agent.put(`/api/admin/badges/${badge.id}`, {
        name: "Updated Test Badge",
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.badge.name).toBe("Updated Test Badge");
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
    test("admin can recompute badges for a user", async () => {
      // Use standalone agents to avoid shared request context cookie collision
      const traderAgent = await createStandaloneAgent(TRADER1, BASE);
      const agent = await createStandaloneAgent(ADMIN, BASE);

      try {
        const res = await agent.post("/api/admin/badges/recompute", {
          scope: "user",
          targetId: traderAgent.userId,
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.result).toBeDefined();
        expect(body.result.userId).toBe(traderAgent.userId);
      } finally {
        await traderAgent.dispose();
        await agent.dispose();
      }
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
