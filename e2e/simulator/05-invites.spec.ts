import { test, expect } from "@playwright/test";
import { TRADER3, SPECTATOR } from "../helpers/seed-accounts";
import { createAgent, createStandaloneAgent, uniqueName } from "../helpers/test-utils";
import { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("05 — Clan Invites", () => {
  let leader: TestAgent;
  let clanId: string;

  test.beforeAll(async () => {
    leader = await createStandaloneAgent(TRADER3, BASE);

    // Ensure leader is free
    await leader.leaveAllClans();

    const { body } = await leader.createClan({
      name: uniqueName("Invites"),
      isPublic: true,
    });
    clanId = body.id;
  });

  test.afterAll(async () => {
    if (clanId) {
      try { await leader.deleteClan(clanId); } catch { /* ignore */ }
    }
    await leader.dispose();
  });

  test("leader can create an invite", async () => {
    const { res, body } = await leader.createInvite(clanId);
    expect(res.status()).toBeLessThan(300);
    expect(body.code).toBeTruthy();
  });

  test("leader can create invite with max uses", async () => {
    const { res, body } = await leader.createInvite(clanId, { maxUses: 5 });
    expect(res.status()).toBeLessThan(300);
    expect(body.maxUses).toBe(5);
  });

  test("leader can create invite with expiry", async () => {
    const { res, body } = await leader.createInvite(clanId, { expiresInHours: 24 });
    expect(res.status()).toBeLessThan(300);
    expect(body.expiresAt).toBeTruthy();
  });

  test("leader can list invites", async () => {
    const { res, body } = await leader.getInvites(clanId);
    expect(res.status()).toBe(200);
    const invites = Array.isArray(body) ? body : body.invites || [];
    expect(invites.length).toBeGreaterThanOrEqual(3);
  });

  test("leader can revoke an invite", async () => {
    const { body: invite } = await leader.createInvite(clanId);
    const inviteId = invite.id;
    const res = await leader.revokeInvite(clanId, inviteId);
    expect(res.status()).toBeLessThan(300);
  });

  test("non-leader cannot create invite", async ({ request }) => {
    const other = await createAgent(request, SPECTATOR, BASE);
    const { res } = await other.createInvite(clanId);
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("non-leader cannot list invites", async ({ request }) => {
    const other = await createAgent(request, SPECTATOR, BASE);
    const { res } = await other.getInvites(clanId);
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("invite code is unique string", async () => {
    const { body: i1 } = await leader.createInvite(clanId);
    const { body: i2 } = await leader.createInvite(clanId);
    expect(i1.code).not.toBe(i2.code);
    expect(typeof i1.code).toBe("string");
    expect(i1.code.length).toBeGreaterThan(0);
  });
});
