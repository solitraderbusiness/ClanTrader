import { test, expect } from "@playwright/test";
import { TRADER1, TRADER2, SPECTATOR } from "../helpers/seed-accounts";
import { createStandaloneAgent } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("11 — Discovery & Follow", () => {
  let ali: TestAgent;
  let spectator: TestAgent;

  test.beforeAll(async () => {
    ali = await createStandaloneAgent(TRADER1, BASE);
    spectator = await createStandaloneAgent(SPECTATOR, BASE);
  });

  test.afterAll(async () => {
    await ali.dispose();
    await spectator.dispose();
  });

  test("discover public clans", async () => {
    const { res, body } = await ali.discoverClans();
    expect(res.status()).toBe(200);
    const clans = Array.isArray(body) ? body : body.clans || [];
    expect(clans.length).toBeGreaterThan(0);
  });

  test("discover clans with search query", async () => {
    const { res, body } = await ali.discoverClans("Golden");
    expect(res.status()).toBe(200);
    const clans = Array.isArray(body) ? body : body.clans || [];
    expect(clans.length).toBeGreaterThan(0);
    expect(clans[0].name).toContain("Golden");
  });

  test("discover clans returns clan details", async () => {
    const { body } = await ali.discoverClans("Golden Eagles");
    const clans = Array.isArray(body) ? body : body.clans || [];
    const ge = clans.find((c: { name: string }) => c.name === "Golden Eagles");
    expect(ge).toBeTruthy();
    expect(ge.id).toBeTruthy();
    expect(ge.isPublic).toBe(true);
  });

  test("discover free agents", async () => {
    const { res, body } = await ali.discoverFreeAgents();
    expect(res.status()).toBe(200);
    const agents = Array.isArray(body) ? body : body.traders || body.freeAgents || [];
    // May be empty if all traders are in clans
    expect(Array.isArray(agents)).toBe(true);
  });

  test("spectator can discover clans", async () => {
    const { res, body } = await spectator.discoverClans();
    expect(res.status()).toBe(200);
    const clans = Array.isArray(body) ? body : body.clans || [];
    expect(clans.length).toBeGreaterThan(0);
  });

  test("clan details include member count", async () => {
    const { body } = await ali.discoverClans("Golden Eagles");
    const clans = Array.isArray(body) ? body : body.clans || [];
    const ge = clans.find((c: { name: string }) => c.name === "Golden Eagles");
    expect(ge).toBeTruthy();
    // memberCount or _count.members
    const memberCount = ge.memberCount ?? ge._count?.members;
    expect(memberCount).toBeGreaterThan(0);
  });

  test("empty search returns results or empty array", async () => {
    const { res, body } = await ali.discoverClans("zzzznonexistent");
    expect(res.status()).toBe(200);
    const clans = Array.isArray(body) ? body : body.clans || [];
    // Should be empty or very small
    expect(Array.isArray(clans)).toBe(true);
  });

  test("get public user profile", async () => {
    const { res, body } = await spectator.getUser(ali.userId);
    expect(res.status()).toBe(200);
    expect(body.name).toBe(TRADER1.name);
  });
});
