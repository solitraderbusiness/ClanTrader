import { test, expect } from "@playwright/test";
import { TRADER1, SPECTATOR, SEED_CLAN_NAME } from "../helpers/seed-accounts";
import { createAgent, createStandaloneAgent } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("18 — Clan Watchlist", () => {
  let leader: TestAgent;
  let clanId: string;

  test.beforeAll(async () => {
    leader = await createStandaloneAgent(TRADER1, BASE);

    // Find the seed clan (Golden Eagles) where TRADER1 is leader
    const res = await leader.get("/api/me/chats");
    const data = await res.json();
    const chatList = data.chats ?? (Array.isArray(data) ? data : []);
    const seedClan = chatList.find(
      (c: { name?: string; clanName?: string }) =>
        (c.name || c.clanName) === SEED_CLAN_NAME,
    );
    if (seedClan) {
      clanId = seedClan.clanId ?? seedClan.id;
    }

    // Fallback: search for the clan
    if (!clanId) {
      const discRes = await leader.get(`/api/discover/clans?q=${encodeURIComponent(SEED_CLAN_NAME)}`);
      const discBody = await discRes.json();
      const clans = discBody.clans ?? discBody;
      const found = Array.isArray(clans)
        ? clans.find((c: { name: string }) => c.name === SEED_CLAN_NAME)
        : null;
      if (found) clanId = found.id;
    }

    if (!clanId) throw new Error("Seed clan not found — run seed first");
  });

  test.afterAll(async () => {
    await leader?.dispose();
  });

  test("get clan watchlist → 200", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const res = await agent.get(`/api/clans/${clanId}/watchlist`);
    expect(res.status()).toBe(200);
  });

  test("add instrument to watchlist → 201", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const instrument = `TEST${Date.now().toString().slice(-4)}`;
    const res = await agent.post(`/api/clans/${clanId}/watchlist`, { instrument });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.item).toBeDefined();
  });

  test("add duplicate instrument → error or idempotent", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const instrument = "DUPTEST";

    // Add first time
    await agent.post(`/api/clans/${clanId}/watchlist`, { instrument });

    // Add again — should either 409/400 or 201 (idempotent)
    const res = await agent.post(`/api/clans/${clanId}/watchlist`, { instrument });
    expect([200, 201, 400, 409]).toContain(res.status());
  });

  test("non-member cannot access watchlist → 403", async ({ request }) => {
    const spectator = await createAgent(request, SPECTATOR, BASE);
    const res = await spectator.get(`/api/clans/${clanId}/watchlist`);
    expect(res.status()).toBe(403);
  });

  test("delete instrument from watchlist → 200", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const instrument = "DELTEST";

    // Add first
    await agent.post(`/api/clans/${clanId}/watchlist`, { instrument });

    // Delete
    const res = await agent.delete(
      `/api/clans/${clanId}/watchlist/${encodeURIComponent(instrument)}`,
    );
    expect(res.status()).toBe(200);
  });
});
