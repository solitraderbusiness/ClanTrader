import { test, expect } from "@playwright/test";
import { TRADER1, SEED_CLAN_NAME } from "../helpers/seed-accounts";
import { createAgent, createStandaloneAgent } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("20 — Clan Performance", () => {
  let trader: TestAgent;
  let clanId: string;

  test.beforeAll(async () => {
    trader = await createStandaloneAgent(TRADER1, BASE);

    // Find seed clan
    const discRes = await trader.get(`/api/discover/clans?q=${encodeURIComponent(SEED_CLAN_NAME)}`);
    const discBody = await discRes.json();
    const clans = discBody.clans ?? discBody;
    const found = Array.isArray(clans)
      ? clans.find((c: { name: string }) => c.name === SEED_CLAN_NAME)
      : null;
    if (found) clanId = found.id;
    if (!clanId) throw new Error("Seed clan not found — run seed first");
  });

  test.afterAll(async () => {
    await trader?.dispose();
  });

  test("get performance (default period) → 200", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const res = await agent.get(`/api/clans/${clanId}/performance`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
    expect(typeof body).toBe("object");
  });

  test("get with period=month → 200", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const res = await agent.get(`/api/clans/${clanId}/performance?period=month`);
    expect(res.status()).toBe(200);
  });

  test("non-existent clan → 404", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const res = await agent.get("/api/clans/non-existent-clan-id-12345/performance");
    expect(res.status()).toBe(404);
  });

  test("unauthenticated → 401", async ({ request }) => {
    const res = await request.get(`${BASE}/api/clans/${clanId}/performance`);
    expect(res.status()).toBe(401);
  });
});
