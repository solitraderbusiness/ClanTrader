import { test, expect } from "@playwright/test";
import { TRADER3, SPECTATOR } from "../helpers/seed-accounts";
import { createAgent, createStandaloneAgent, uniqueName } from "../helpers/test-utils";
import { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("02 — Clans CRUD", () => {
  let leader: TestAgent;
  let clanId: string;
  const clanName = uniqueName("TestClan");

  test.beforeAll(async () => {
    leader = await createStandaloneAgent(TRADER3, BASE);
    // Ensure trader3 isn't in a clan (leave if needed)
    await leader.leaveAllClans();
  });

  test.afterAll(async () => {
    if (clanId) {
      try { await leader.deleteClan(clanId); } catch { /* ignore */ }
    }
    await leader.dispose();
  });

  test("create a public clan", async () => {
    const { res, body } = await leader.createClan({
      name: clanName,
      description: "A test clan for CI",
      tradingFocus: "XAUUSD",
      isPublic: true,
    });
    expect(res.status()).toBe(201);
    expect(body.name).toBe(clanName);
    expect(body.isPublic).toBe(true);
    clanId = body.id;
  });

  test("get clan details", async () => {
    const { res, body } = await leader.getClan(clanId);
    expect(res.status()).toBe(200);
    expect(body.id).toBe(clanId);
    expect(body.name).toBe(clanName);
  });

  test("update clan description", async () => {
    const { res, body } = await leader.updateClan(clanId, { description: "Updated!" });
    expect(res.status()).toBe(200);
    expect(body.description).toBe("Updated!");
  });

  test("update clan name", async () => {
    const newName = uniqueName("Renamed");
    const { res, body } = await leader.updateClan(clanId, { name: newName });
    expect(res.status()).toBe(200);
    expect(body.name).toBe(newName);
  });

  test("update clan settings", async () => {
    const { res, body } = await leader.updateClanSettings(clanId, {
      joinRequestsEnabled: true,
      autoPostEnabled: false,
    });
    expect(res.status()).toBe(200);
    expect(body.settings.joinRequestsEnabled).toBe(true);
  });

  test("non-leader cannot update clan", async ({ request }) => {
    const other = await createAgent(request, SPECTATOR, BASE);
    const { res } = await other.updateClan(clanId, { description: "Hacked" });
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("non-leader cannot delete clan", async ({ request }) => {
    const other = await createAgent(request, SPECTATOR, BASE);
    const res = await other.deleteClan(clanId);
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("clan name validation rejects special chars", async () => {
    const { res } = await leader.createClan({
      name: "!!!bad!!!",
      isPublic: true,
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("clan name validation rejects too-short names", async () => {
    const { res } = await leader.createClan({ name: "ab", isPublic: true });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test("leader can delete clan", async () => {
    // Delete the main test clan first (one-clan limit means we can't create another)
    await leader.deleteClan(clanId);

    // Create a fresh throwaway clan to test full create-then-delete flow
    const { body } = await leader.createClan({
      name: uniqueName("Deleteme"),
      isPublic: true,
    });
    const res = await leader.deleteClan(body.id);
    expect(res.status()).toBeLessThan(300);
    // Verify it's gone
    const check = await leader.getClan(body.id);
    expect(check.res.status()).toBeGreaterThanOrEqual(400);
    // Clear clanId so afterAll doesn't try to delete again
    clanId = "";
  });
});
