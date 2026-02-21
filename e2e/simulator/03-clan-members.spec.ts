import { test, expect } from "@playwright/test";
import { TRADER3, SPECTATOR } from "../helpers/seed-accounts";
import { createAgent, createStandaloneAgents, uniqueName, sleep } from "../helpers/test-utils";
import { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("03 — Clan Members & Roles", () => {
  let leader: TestAgent;
  let member: TestAgent;
  let clanId: string;

  test.beforeAll(async () => {
    // Create agents — trader3 as leader, spectator as member
    [leader, member] = await createStandaloneAgents([TRADER3, SPECTATOR], BASE);

    // Ensure both are free of clans
    await leader.leaveAllClans();
    await member.leaveAllClans();

    // Create fresh clan
    const { body } = await leader.createClan({
      name: uniqueName("Members"),
      isPublic: true,
    });
    clanId = body.id;
  });

  test.afterAll(async () => {
    if (clanId) {
      try { await leader.deleteClan(clanId); } catch { /* ignore */ }
    }
    await leader.dispose();
    await member.dispose();
  });

  test("leader appears in member list", async () => {
    const { res, body } = await leader.getClanMembers(clanId);
    expect(res.status()).toBe(200);
    const members = Array.isArray(body) ? body : body.members;
    const me = members.find((m: { userId: string }) => m.userId === leader.userId);
    expect(me).toBeTruthy();
    expect(me.role).toBe("LEADER");
  });

  test("add member via invite code", async () => {
    const { body: invite } = await leader.createInvite(clanId);
    expect(invite.code).toBeTruthy();

    // Member redeems invite via POST /api/invites/{code}
    const redeemRes = await member.post(`/api/invites/${invite.code}`, {});
    expect(redeemRes.status()).toBeLessThan(400);
  });

  test("get clan members list", async () => {
    const { res, body } = await leader.getClanMembers(clanId);
    expect(res.status()).toBe(200);
    const members = Array.isArray(body) ? body : body.members;
    expect(members.length).toBeGreaterThanOrEqual(2);
  });

  test("leader can promote member to co-leader", async () => {
    // Promote the member (SPECTATOR) who joined via invite
    const { res } = await leader.updateMemberRole(clanId, member.userId, "CO_LEADER");
    expect(res.status()).toBe(200);

    // Verify
    const { body: members } = await leader.getClanMembers(clanId);
    const list = Array.isArray(members) ? members : members.members;
    const promoted = list.find((m: { userId: string }) => m.userId === member.userId);
    expect(promoted?.role).toBe("CO_LEADER");
  });

  test("leader can demote co-leader to member", async () => {
    const { res } = await leader.updateMemberRole(clanId, member.userId, "MEMBER");
    expect(res.status()).toBe(200);

    // Verify
    const { body: members } = await leader.getClanMembers(clanId);
    const list = Array.isArray(members) ? members : members.members;
    const demoted = list.find((m: { userId: string }) => m.userId === member.userId);
    expect(demoted?.role).toBe("MEMBER");
  });

  test("member cannot change roles", async ({ request }) => {
    const other = await createAgent(request, SPECTATOR, BASE);
    const { res } = await other.updateMemberRole(clanId, leader.userId, "MEMBER");
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("leader can kick a member", async () => {
    const res = await leader.removeMember(clanId, member.userId);
    expect(res.status()).toBeLessThan(400);
  });

  test("member can leave clan voluntarily", async () => {
    // Re-add member via join request
    await leader.updateClanSettings(clanId, { joinRequestsEnabled: true });
    await member.requestToJoin(clanId, "Back again");
    const { body: reqs } = await leader.getJoinRequests(clanId);
    const p = (Array.isArray(reqs) ? reqs : reqs.requests || [])
      .find((r: { status: string; userId: string }) => r.status === "PENDING" && r.userId === member.userId);
    if (p) await leader.reviewJoinRequest(clanId, p.id, "APPROVED");
    await sleep(500);

    const res = await member.removeMember(clanId, member.userId);
    expect(res.status()).toBeLessThan(400);
  });
});
