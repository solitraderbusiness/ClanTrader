import { test, expect } from "@playwright/test";
import { TRADER1, TRADER2 } from "../helpers/seed-accounts";
import { createStandaloneAgents, sleep } from "../helpers/test-utils";
import { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

/**
 * Uses the pre-seeded Golden Eagles clan (TRADER1=Ali is leader, TRADER2=Sara is member).
 * Both agents connect via Socket.io to the default topic.
 */
test.describe("06 — Chat Messages (Socket.io)", () => {
  let ali: TestAgent;
  let sara: TestAgent;
  let clanId: string;
  let topicId: string;

  test.beforeAll(async () => {
    [ali, sara] = await createStandaloneAgents([TRADER1, TRADER2], BASE);

    // Look up the Golden Eagles clan
    const { body: clansBody } = await ali.discoverClans("Golden Eagles");
    const clans = Array.isArray(clansBody) ? clansBody : clansBody.clans || [];
    const ge = clans.find((c: { name: string }) => c.name === "Golden Eagles");
    expect(ge).toBeTruthy();
    clanId = ge.id;

    // Get default topic
    const { body: topicsBody } = await ali.getTopics(clanId);
    const topics = Array.isArray(topicsBody) ? topicsBody : topicsBody.topics || [];
    expect(topics.length).toBeGreaterThan(0);
    topicId = topics[0].id;

    // Connect sockets and join chat
    await ali.connectSocket();
    await sara.connectSocket();
    ali.joinClanChat(clanId, topicId);
    sara.joinClanChat(clanId, topicId);
    await sleep(1000); // Wait for room joins + presence
  });

  test.afterAll(async () => {
    ali.disconnectSocket();
    sara.disconnectSocket();
    await ali.dispose();
    await sara.dispose();
  });

  test("send plain text message — other user receives it", async () => {
    const text = `Hello from Ali ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const msg = await sara.waitForEvent<{ content: string; user: { id: string } }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );
    expect(msg.content).toBe(text);
    expect(msg.user.id).toBe(ali.userId);
  });

  test("send message with emoji and special chars", async () => {
    const text = "🚀 XAUUSD is pumping! <>&\"' $$$";
    await ali.sendMessage(clanId, topicId, text);

    const msg = await sara.waitForEvent<{ content: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );
    expect(msg.content).toBe(text);
  });

  test("send max-length message (2000 chars)", async () => {
    const text = "A".repeat(2000);
    await ali.sendMessage(clanId, topicId, text);

    const msg = await sara.waitForEvent<{ content: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content.length === 2000 },
    );
    expect(msg.content.length).toBe(2000);
  });

  test("send over-limit message (2001 chars) — error", async () => {
    const text = "A".repeat(2001);
    ali.clearEventBuffer("error");
    await ali.sendMessage(clanId, topicId, text);

    const err = await ali.waitForError("send_message", 5000);
    expect(err.message).toBeTruthy();
  });

  test("reply to a message", async () => {
    const text = `Original ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const original = await sara.waitForEvent<{ id: string; content: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    const replyText = "This is a reply!";
    await sara.sendMessage(clanId, topicId, replyText, original.id);

    const reply = await ali.waitForEvent<{ content: string; replyTo: { id: string } | null }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === replyText },
    );
    expect(reply.replyTo).toBeTruthy();
    expect(reply.replyTo!.id).toBe(original.id);
  });

  test("edit own message", async () => {
    const text = `Editable ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const msg = await ali.waitForEvent<{ id: string; content: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    ali.editMessage(msg.id, clanId, "Edited content!");

    const edited = await sara.waitForEvent<{ id: string; content: string; isEdited: boolean }>(
      "message_edited",
      { filter: (d) => (d as { id: string }).id === msg.id },
    );
    expect(edited.content).toBe("Edited content!");
    expect(edited.isEdited).toBe(true);
  });

  test("delete own message", async () => {
    const text = `Deleteable ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const msg = await ali.waitForEvent<{ id: string; content: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    ali.deleteMessage(msg.id, clanId);

    const deleted = await sara.waitForEvent<{ id: string }>(
      "message_deleted",
      { filter: (d) => (d as { id: string }).id === msg.id },
    );
    expect(deleted.id).toBe(msg.id);
  });

  test("cannot edit another user's message — error", async () => {
    const text = `Saras msg ${Date.now()}`;
    await sara.sendMessage(clanId, topicId, text);

    const msg = await ali.waitForEvent<{ id: string; content: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    ali.clearEventBuffer("error");
    ali.editMessage(msg.id, clanId, "Trying to edit Sara's msg");

    const err = await ali.waitForError("edit_message", 5000);
    expect(err.message).toBeTruthy();
  });

  test("leader can delete another user's message", async () => {
    const text = `Saras deletable ${Date.now()}`;
    await sara.sendMessage(clanId, topicId, text);

    const msg = await ali.waitForEvent<{ id: string; content: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    // Ali is the leader — can delete Sara's message
    ali.deleteMessage(msg.id, clanId);

    const deleted = await sara.waitForEvent<{ id: string }>(
      "message_deleted",
      { filter: (d) => (d as { id: string }).id === msg.id },
    );
    expect(deleted.id).toBe(msg.id);
  });

  test("react to message with emoji", async () => {
    const text = `Reactable ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const msg = await sara.waitForEvent<{ id: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    sara.reactToMessage(msg.id, clanId, "👍");

    const reacted = await ali.waitForEvent<{ id: string; reactions: Record<string, string[]> }>(
      "message_reacted",
      { filter: (d) => (d as { id: string }).id === msg.id },
    );
    expect(reacted.reactions).toBeTruthy();
    expect(reacted.reactions["👍"]).toContain(sara.userId);
  });

  test("toggle reaction off", async () => {
    const text = `Toggle react ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const msg = await sara.waitForEvent<{ id: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    // React
    sara.reactToMessage(msg.id, clanId, "🔥");
    await ali.waitForEvent("message_reacted", {
      filter: (d) => (d as { id: string }).id === msg.id,
    });

    // Toggle off
    sara.reactToMessage(msg.id, clanId, "🔥");
    const toggled = await ali.waitForEvent<{ id: string; reactions: Record<string, string[]> | null }>(
      "message_reacted",
      { filter: (d) => (d as { id: string }).id === msg.id },
    );
    // 🔥 should be removed or empty array
    const fireReactions = toggled.reactions?.["🔥"] || [];
    expect(fireReactions).not.toContain(sara.userId);
  });

  test("pin a message", async () => {
    const text = `Pinnable ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const msg = await ali.waitForEvent<{ id: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    ali.pinMessage(msg.id, clanId);

    const pinned = await sara.waitForEvent<{ id: string; isPinned: boolean }>(
      "message_pinned",
      { filter: (d) => (d as { id: string }).id === msg.id },
    );
    expect(pinned.id).toBe(msg.id);
    expect(pinned.isPinned).toBe(true);
  });

  test("unpin a message", async () => {
    const text = `Unpin me ${Date.now()}`;
    await ali.sendMessage(clanId, topicId, text);

    const msg = await ali.waitForEvent<{ id: string }>(
      "receive_message",
      { filter: (d) => (d as { content: string }).content === text },
    );

    ali.pinMessage(msg.id, clanId);
    await sara.waitForEvent("message_pinned", {
      filter: (d) => (d as { id: string }).id === msg.id,
    });

    ali.unpinMessage(msg.id, clanId);
    const unpinned = await sara.waitForEvent<{ id: string }>(
      "message_unpinned",
      { filter: (d) => (d as { id: string }).id === msg.id },
    );
    expect(unpinned.id).toBe(msg.id);
  });

  test("typing indicator", async () => {
    ali.emitTyping(clanId);

    const typing = await sara.waitForEvent<{ userId: string; name: string }>(
      "user_typing",
      { timeout: 5000 },
    );
    expect(typing.userId).toBe(ali.userId);
    expect(typing.name).toBeTruthy();
  });
});
