import { test, expect } from "@playwright/test";
import { TRADER1, SEED_CLAN_NAME } from "../helpers/seed-accounts";
import { createAgent, createStandaloneAgent } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("19 — Trade Journal", () => {
  let trader: TestAgent;
  let clanId: string;

  test.beforeAll(async () => {
    trader = await createStandaloneAgent(TRADER1, BASE);

    // Find seed clan for filter tests
    const discRes = await trader.get(`/api/discover/clans?q=${encodeURIComponent(SEED_CLAN_NAME)}`);
    const discBody = await discRes.json();
    const clans = discBody.clans ?? discBody;
    const found = Array.isArray(clans)
      ? clans.find((c: { name: string }) => c.name === SEED_CLAN_NAME)
      : null;
    if (found) clanId = found.id;
  });

  test.afterAll(async () => {
    await trader?.dispose();
  });

  test("get journal (no filters) → 200 with data object", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const res = await agent.get("/api/me/journal");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
    expect(typeof body).toBe("object");
  });

  test("filter by clanId → 200", async ({ request }) => {
    test.skip(!clanId, "No seed clan found");
    const agent = await createAgent(request, TRADER1, BASE);
    const res = await agent.get(`/api/me/journal?clanId=${clanId}`);
    expect(res.status()).toBe(200);
  });

  test("filter by date range → 200", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const from = new Date(Date.now() - 30 * 86400000).toISOString();
    const to = new Date().toISOString();
    const res = await agent.get(`/api/me/journal?from=${from}&to=${to}`);
    expect(res.status()).toBe(200);
  });

  test("unauthenticated → 401", async ({ request }) => {
    const res = await request.get(`${BASE}/api/me/journal`);
    expect(res.status()).toBe(401);
  });
});
