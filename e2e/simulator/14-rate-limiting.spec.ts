import { test, expect } from "@playwright/test";
import { TRADER1, TRADER2 } from "../helpers/seed-accounts";
import { createStandaloneAgents, sleep } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("14 — Rate Limiting", () => {
  let ali: TestAgent;
  let sara: TestAgent;
  let clanId: string;
  let topicId: string;

  test.beforeAll(async () => {
    [ali, sara] = await createStandaloneAgents([TRADER1, TRADER2], BASE);

    // Find Golden Eagles
    const { body } = await ali.discoverClans("Golden Eagles");
    const clans = Array.isArray(body) ? body : body.clans || [];
    const ge = clans.find((c: { name: string }) => c.name === "Golden Eagles");
    clanId = ge.id;

    const { body: topicsBody } = await ali.getTopics(clanId);
    const topics = Array.isArray(topicsBody) ? topicsBody : topicsBody.topics || [];
    topicId = topics[0].id;

    await ali.connectSocket();
    await sara.connectSocket();
    ali.joinClanChat(clanId, topicId);
    sara.joinClanChat(clanId, topicId);
    await sleep(1000);
  });

  test.afterAll(async () => {
    ali.disconnectSocket();
    sara.disconnectSocket();
    await ali.dispose();
    await sara.dispose();
  });

  test("rapid messages trigger rate limit (>5 in 10s)", async () => {
    ali.clearEventBuffer("error");

    // Send 6 messages rapidly — use emit() directly to bypass client-side rate limit tracking
    for (let i = 0; i < 6; i++) {
      ali.emit("send_message", { clanId, topicId, content: `Rate limit test ${i} ${Date.now()}` });
    }

    // The 6th message should trigger rate limit error
    const err = await ali.waitForError("send_message", 5000);
    expect(err.message).toContain("too fast");
  });

  test("rate limit resets after window", async () => {
    // Wait for the rate limit window to expire (10 seconds)
    await sleep(11000);

    // Should be able to send again
    const text = `After cooldown ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const msg = await sara.waitForEvent<{ content: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text, timeout: 5000 },
    );
    expect(msg.content).toBe(text);
  });

  test("DM rate limiting works", async () => {
    ali.joinDm(sara.userId);
    sara.joinDm(ali.userId);
    await sleep(300);

    ali.clearEventBuffer("error");

    // Send 6 DMs rapidly — use emit() directly to bypass client-side rate limit tracking
    for (let i = 0; i < 6; i++) {
      ali.emit("send_dm", { recipientId: sara.userId, content: `DM rate test ${i} ${Date.now()}` });
    }

    // Should trigger rate limit
    const err = await ali.waitForError("send_dm", 5000);
    expect(err.message).toContain("too fast");
  });
});
