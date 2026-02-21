import { test, expect } from "@playwright/test";
import { ADMIN, TRADER1, TRADER2, SPECTATOR } from "../helpers/seed-accounts";
import { createAgent, createStandaloneAgents, sleep, uniqueName } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("13 — Permissions (Negative Tests)", () => {
  let admin: TestAgent;
  let ali: TestAgent;
  let spectator: TestAgent;
  let clanId: string;
  let topicId: string;

  test.beforeAll(async () => {
    [admin, ali, spectator] = await createStandaloneAgents(
      [ADMIN, TRADER1, SPECTATOR],
      BASE,
    );

    // Find Golden Eagles
    const { body } = await ali.discoverClans("Golden Eagles");
    const clans = Array.isArray(body) ? body : body.clans || [];
    const ge = clans.find((c: { name: string }) => c.name === "Golden Eagles");
    clanId = ge.id;

    const { body: topicsBody } = await ali.getTopics(clanId);
    const topics = Array.isArray(topicsBody) ? topicsBody : topicsBody.topics || [];
    topicId = topics[0].id;
  });

  test.afterAll(async () => {
    await admin.dispose();
    await ali.dispose();
    await spectator.dispose();
  });

  test("spectator cannot access admin API", async () => {
    const res = await spectator.get("/api/admin/test-runs");
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("admin can access admin API", async () => {
    const res = await admin.get("/api/admin/test-runs");
    expect(res.status()).toBe(200);
  });

  test("non-member cannot read clan messages via REST", async () => {
    const { res } = await spectator.getMessages(clanId, topicId);
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("non-member cannot join clan socket room", async () => {
    await spectator.connectSocket();
    spectator.clearEventBuffer("error");
    spectator.joinClanChat(clanId);

    const err = await spectator.waitForError("join_clan", 5000);
    expect(err.message).toBeTruthy();

    spectator.disconnectSocket();
  });

  test("member cannot edit another's message via socket", async ({ request }) => {
    await ali.connectSocket();
    const sara = await createAgent(request, TRADER2, BASE);
    await sara.connectSocket();

    ali.joinClanChat(clanId, topicId);
    sara.joinClanChat(clanId, topicId);
    await sleep(500);

    // Sara sends a message
    const text = `Perms test ${Date.now()}`;
    await sara.sendMessage(clanId, topicId, text);

    const msg = await ali.waitForEvent<{ id: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    // Ali (not author) tries to edit Sara's message — should fail
    ali.clearEventBuffer("error");
    ali.editMessage(msg.id, clanId, "Edited by Ali");

    const err = await ali.waitForError("edit_message", 5000);
    expect(err.message).toBeTruthy();

    ali.disconnectSocket();
    sara.disconnectSocket();
  });

  test("regular member cannot delete another's message", async () => {
    // ADMIN is MEMBER (not LEADER/CO_LEADER) in Golden Eagles
    await ali.connectSocket();
    await admin.connectSocket();

    ali.joinClanChat(clanId, topicId);
    admin.joinClanChat(clanId, topicId);
    await sleep(500);

    const text = `Leader msg ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const msg = await admin.waitForEvent<{ id: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    admin.clearEventBuffer("error");
    admin.deleteMessage(msg.id, clanId);

    const err = await admin.waitForError("delete_message", 5000);
    expect(err.message).toBeTruthy();

    ali.disconnectSocket();
    admin.disconnectSocket();
  });

  test("non-leader cannot approve join requests", async ({ request }) => {
    const sara = await createAgent(request, TRADER2, BASE);
    const { res } = await sara.reviewJoinRequest(clanId, "fake-id", "APPROVED");
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("cannot edit another user's DM", async ({ request }) => {
    await ali.connectSocket();
    const sara = await createAgent(request, TRADER2, BASE);
    await sara.connectSocket();

    ali.joinDm(sara.userId);
    sara.joinDm(ali.userId);
    await sleep(300);

    const text = `Sara DM ${Date.now()}`;
    await sara.sendDm(ali.userId, text);

    const msg = await ali.waitForEvent<{ id: string }>(
      "receive_dm",
      { filter: (d) => (d as { content: string }).content === text },
    );

    ali.clearEventBuffer("error");
    ali.editDm(msg.id, sara.userId, "Hacked DM");

    const err = await ali.waitForError("edit_dm", 5000);
    expect(err.message).toBeTruthy();

    ali.disconnectSocket();
    sara.disconnectSocket();
  });

  test("unauthenticated request returns 401", async ({ request }) => {
    const res = await request.get(`${BASE}/api/me/chats`);
    expect(res.status()).toBe(401);
  });
});
