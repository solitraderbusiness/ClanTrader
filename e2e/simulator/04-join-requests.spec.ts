import { test, expect } from "@playwright/test";
import { TRADER3, SPECTATOR } from "../helpers/seed-accounts";
import { createAgent, createStandaloneAgent, uniqueName, sleep } from "../helpers/test-utils";
import { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("04 — Join Requests", () => {
  let leader: TestAgent;
  let applicant: TestAgent;
  let clanId: string;

  test.beforeAll(async () => {
    leader = await createStandaloneAgent(TRADER3, BASE);
    applicant = await createStandaloneAgent(SPECTATOR, BASE);

    // Ensure both are free of clans
    await leader.leaveAllClans();
    await applicant.leaveAllClans();

    // Create clan with join requests enabled
    const { body } = await leader.createClan({
      name: uniqueName("JoinReq"),
      isPublic: true,
    });
    clanId = body.id;
    await leader.updateClanSettings(clanId, { joinRequestsEnabled: true });
  });

  test.afterAll(async () => {
    if (clanId) {
      try { await leader.deleteClan(clanId); } catch { /* ignore */ }
    }
    await leader.dispose();
    await applicant.dispose();
  });

  test("applicant submits join request with message", async () => {
    const { res, body } = await applicant.requestToJoin(clanId, "I want to join!");
    expect(res.status()).toBeLessThan(300);
    expect(body.status).toBe("PENDING");
    expect(body.message).toBe("I want to join!");
  });

  test("duplicate join request is rejected", async () => {
    const { res } = await applicant.requestToJoin(clanId, "Again!");
    expect(res.status()).toBe(409);
  });

  test("leader can view pending requests", async () => {
    const { res, body } = await leader.getJoinRequests(clanId);
    expect(res.status()).toBe(200);
    const list = Array.isArray(body) ? body : body.requests || [];
    const found = list.find(
      (r: { userId: string; status: string }) => r.userId === applicant.userId && r.status === "PENDING",
    );
    expect(found).toBeTruthy();
    expect(found.message).toBe("I want to join!");
  });

  test("leader rejects the request with reason", async () => {
    const { body: reqs } = await leader.getJoinRequests(clanId);
    const list = Array.isArray(reqs) ? reqs : reqs.requests || [];
    const pending = list.find(
      (r: { userId: string; status: string }) => r.userId === applicant.userId && r.status === "PENDING",
    );
    expect(pending).toBeTruthy();

    const { res, body } = await leader.reviewJoinRequest(clanId, pending.id, "REJECTED", "Not qualified");
    expect(res.status()).toBe(200);
    expect(body.status).toBe("REJECTED");
  });

  test("applicant re-requests after rejection", async () => {
    const { res, body } = await applicant.requestToJoin(clanId, "Please reconsider!");
    expect(res.status()).toBeLessThan(300);
    expect(body.status).toBe("PENDING");
  });

  test("leader approves the re-request", async () => {
    const { body: reqs } = await leader.getJoinRequests(clanId);
    const list = Array.isArray(reqs) ? reqs : reqs.requests || [];
    const pending = list.find(
      (r: { userId: string; status: string }) => r.userId === applicant.userId && r.status === "PENDING",
    );
    expect(pending).toBeTruthy();

    const { res, body } = await leader.reviewJoinRequest(clanId, pending.id, "APPROVED");
    expect(res.status()).toBe(200);
    expect(body.status).toBe("APPROVED");
  });

  test("approved applicant is now a member", async () => {
    await sleep(500);
    const { body } = await leader.getClanMembers(clanId);
    const members = Array.isArray(body) ? body : body.members;
    const found = members.find((m: { userId: string }) => m.userId === applicant.userId);
    expect(found).toBeTruthy();
    expect(found.role).toBe("MEMBER");
  });

  test("non-leader cannot view join requests", async ({ request }) => {
    const other = await createAgent(request, SPECTATOR, BASE);
    // spectator is now a member, but not leader
    const { res } = await other.getJoinRequests(clanId);
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("user already in a clan cannot join another", async () => {
    // applicant is now in the clan — try creating a new clan (same ALREADY_IN_CLAN check)
    const { res } = await applicant.createClan({
      name: uniqueName("NoClan"),
      isPublic: true,
    });
    // Should fail because applicant is already in a clan
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });
});
