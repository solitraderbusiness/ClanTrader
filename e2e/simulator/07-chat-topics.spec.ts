import { test, expect } from "@playwright/test";
import { ADMIN, TRADER1, TRADER2 } from "../helpers/seed-accounts";
import { createStandaloneAgent, createStandaloneAgents, uniqueName, sleep } from "../helpers/test-utils";
import { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("07 — Chat Topics", () => {
  let ali: TestAgent;
  let sara: TestAgent;
  let clanId: string;
  let defaultTopicId: string;

  test.beforeAll(async () => {
    [ali, sara] = await createStandaloneAgents([TRADER1, TRADER2], BASE);

    // Find Golden Eagles
    const { body } = await ali.discoverClans("Golden Eagles");
    const clans = Array.isArray(body) ? body : body.clans || [];
    const ge = clans.find((c: { name: string }) => c.name === "Golden Eagles");
    expect(ge).toBeTruthy();
    clanId = ge.id;

    const { body: topicsBody } = await ali.getTopics(clanId);
    const topics = Array.isArray(topicsBody) ? topicsBody : topicsBody.topics || [];
    defaultTopicId = topics[0].id;
  });

  test.afterAll(async () => {
    await ali.dispose();
    await sara.dispose();
  });

  test("list existing topics", async () => {
    const { res, body } = await ali.getTopics(clanId);
    expect(res.status()).toBe(200);
    const topics = Array.isArray(body) ? body : body.topics || [];
    expect(topics.length).toBeGreaterThanOrEqual(2); // General + Gold Signals
  });

  test("leader can create a new topic", async () => {
    const name = uniqueName("Topic");
    // Trim to max 30 chars
    const topicName = name.substring(0, 30);
    const { res, body } = await ali.createTopic(clanId, {
      name: topicName,
      description: "Test topic",
    });
    expect(res.status()).toBeLessThan(300);
    const topic = body.topic || body;
    expect(topic.name).toBe(topicName);
  });

  test("regular member cannot create topic", async () => {
    // ADMIN is MEMBER (not LEADER/CO_LEADER) in Golden Eagles
    const member = await createStandaloneAgent(ADMIN, BASE);
    const { res } = await member.createTopic(clanId, { name: "Forbidden" });
    expect(res.status()).toBeGreaterThanOrEqual(403);
    await member.dispose();
  });

  test("messages in different topics are isolated", async () => {
    await ali.connectSocket();
    await sara.connectSocket();

    // Get topics
    const { body: topicsBody } = await ali.getTopics(clanId);
    const topics = Array.isArray(topicsBody) ? topicsBody : topicsBody.topics || [];
    expect(topics.length).toBeGreaterThanOrEqual(2);

    const topic1 = topics[0].id;
    const topic2 = topics[1].id;

    // Ali joins topic1, Sara joins topic2
    ali.joinClanChat(clanId, topic1);
    sara.joinClanChat(clanId, topic2);
    await sleep(1000);

    // Ali sends to topic1
    const text = `Topic isolation ${Date.now()}`;
    await ali.sendMessage(clanId, topic1, text);

    // Ali should receive his own message in topic1
    const msg = await ali.waitForEvent<{ content: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text, timeout: 5000 },
    );
    expect(msg.content).toBe(text);

    // Sara should NOT receive it (she's in topic2)
    // Give a short window — if she receives it, the test fails
    let saraReceived = false;
    try {
      await sara.waitForEvent("receive_message", {
        filter: (d) => (d as { content: string }).content === text,
        timeout: 2000,
      });
      saraReceived = true;
    } catch {
      // Expected — timeout means Sara did NOT receive it
    }
    expect(saraReceived).toBe(false);

    ali.disconnectSocket();
    sara.disconnectSocket();
  });

  test("switch topic via socket", async () => {
    await ali.connectSocket();
    await sara.connectSocket();

    const { body: topicsBody } = await ali.getTopics(clanId);
    const topics = Array.isArray(topicsBody) ? topicsBody : topicsBody.topics || [];
    const topic1 = topics[0].id;
    const topic2 = topics[1].id;

    // Both join topic1
    ali.joinClanChat(clanId, topic1);
    sara.joinClanChat(clanId, topic1);
    await sleep(500);

    // Sara switches to topic2
    sara.switchTopic(clanId, topic1, topic2);
    await sleep(500);

    // Ali sends to topic1 — Sara should NOT receive
    const text = `After switch ${Date.now()}`;
    await ali.sendMessage(clanId, topic1, text);

    let saraReceived = false;
    try {
      await sara.waitForEvent("receive_message", {
        filter: (d) => (d as { content: string }).content === text,
        timeout: 2000,
      });
      saraReceived = true;
    } catch { /* expected timeout */ }
    expect(saraReceived).toBe(false);

    ali.disconnectSocket();
    sara.disconnectSocket();
  });

  test("messages can be fetched via REST per topic", async () => {
    const { res, body } = await ali.getMessages(clanId, defaultTopicId);
    expect(res.status()).toBe(200);
    const messages = Array.isArray(body) ? body : body.messages || [];
    expect(Array.isArray(messages)).toBe(true);
  });
});
