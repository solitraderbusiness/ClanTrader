import { test, expect } from "@playwright/test";
import { TRADER1 } from "../helpers/seed-accounts";
import { createStandaloneAgent } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("12 — Leaderboard", () => {
  let ali: TestAgent;

  test.beforeAll(async () => {
    ali = await createStandaloneAgent(TRADER1, BASE);
  });

  test.afterAll(async () => {
    await ali.dispose();
  });

  test("get composite leaderboard", async () => {
    const { res, body } = await ali.getLeaderboard("composite");
    expect(res.status()).toBe(200);
    const entries = Array.isArray(body) ? body : body.entries || body.rankings || [];
    expect(Array.isArray(entries)).toBe(true);
  });

  test("get winRate leaderboard", async () => {
    const { res, body } = await ali.getLeaderboard("winRate");
    expect(res.status()).toBe(200);
    const entries = Array.isArray(body) ? body : body.entries || body.rankings || [];
    expect(Array.isArray(entries)).toBe(true);
  });

  test("get profitFactor leaderboard", async () => {
    const { res, body } = await ali.getLeaderboard("profitFactor");
    expect(res.status()).toBe(200);
  });

  test("default leaderboard (no lens) returns results", async () => {
    const { res, body } = await ali.getLeaderboard();
    expect(res.status()).toBe(200);
    const entries = Array.isArray(body) ? body : body.entries || body.rankings || [];
    expect(Array.isArray(entries)).toBe(true);
  });
});
