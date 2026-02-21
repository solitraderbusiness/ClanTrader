import { test, expect } from "@playwright/test";
import { TRADER1, TRADER2 } from "../helpers/seed-accounts";
import { createStandaloneAgents, sleep } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("09 — Direct Messages (Socket.io + REST)", () => {
  let ali: TestAgent;
  let sara: TestAgent;

  test.beforeAll(async () => {
    [ali, sara] = await createStandaloneAgents([TRADER1, TRADER2], BASE);

    await ali.connectSocket();
    await sara.connectSocket();

    // Both join DM channel with each other
    ali.joinDm(sara.userId);
    sara.joinDm(ali.userId);
    await sleep(500);
  });

  test.afterAll(async () => {
    ali.disconnectSocket();
    sara.disconnectSocket();
    await ali.dispose();
    await sara.dispose();
  });

  test("send DM — recipient receives it", async () => {
    const text = `Hey Sara ${Date.now()}`;
    await ali.sendDm(sara.userId, text);

    const msg = await sara.waitForEvent<{
      id: string;
      content: string;
      senderId: string;
    }>("receive_dm", {
      filter: (d) => (d as { content: string }).content === text,
    });
    expect(msg.content).toBe(text);
    expect(msg.senderId).toBe(ali.userId);
  });

  test("reply to a DM", async () => {
    const text = `DM original ${Date.now()}`;
    await ali.sendDm(sara.userId, text);

    const original = await sara.waitForEvent<{ id: string; content: string }>(
      "receive_dm",
      { filter: (d) => (d as { content: string }).content === text },
    );

    const replyText = "DM reply!";
    await sara.sendDm(ali.userId, replyText, original.id);

    const reply = await ali.waitForEvent<{
      content: string;
      replyTo: { id: string } | null;
    }>("receive_dm", {
      filter: (d) => (d as { content: string }).content === replyText,
    });
    expect(reply.replyTo).toBeTruthy();
    expect(reply.replyTo!.id).toBe(original.id);
  });

  test("edit own DM", async () => {
    const text = `DM editable ${Date.now()}`;
    await ali.sendDm(sara.userId, text);

    const msg = await ali.waitForEvent<{ id: string; content: string }>(
      "receive_dm",
      { filter: (d) => (d as { content: string }).content === text },
    );

    ali.editDm(msg.id, sara.userId, "DM Edited!");

    const edited = await sara.waitForEvent<{
      id: string;
      content: string;
      isEdited: boolean;
    }>("dm_edited", {
      filter: (d) => (d as { id: string }).id === msg.id,
    });
    expect(edited.content).toBe("DM Edited!");
    expect(edited.isEdited).toBe(true);
  });

  test("delete own DM", async () => {
    const text = `DM deletable ${Date.now()}`;
    await ali.sendDm(sara.userId, text);

    const msg = await ali.waitForEvent<{ id: string }>(
      "receive_dm",
      { filter: (d) => (d as { content: string }).content === text },
    );

    ali.deleteDm(msg.id, sara.userId);

    const deleted = await sara.waitForEvent<{ id: string }>(
      "dm_deleted",
      { filter: (d) => (d as { id: string }).id === msg.id },
    );
    expect(deleted.id).toBe(msg.id);
  });

  test("mark DM as read", async () => {
    const text = `Read me ${Date.now()}`;
    await ali.sendDm(sara.userId, text);

    await sara.waitForEvent("receive_dm", {
      filter: (d) => (d as { content: string }).content === text,
    });

    sara.markDmRead(ali.userId);

    const readEvt = await ali.waitForEvent<{
      userId: string;
      conversationId: string;
    }>("dm_marked_read", { timeout: 5000 });
    expect(readEvt.userId).toBe(sara.userId);
  });

  test("typing indicator in DM", async () => {
    ali.emitDmTyping(sara.userId);

    const typing = await sara.waitForEvent<{ userId: string; name: string }>(
      "dm_user_typing",
      { timeout: 5000 },
    );
    expect(typing.userId).toBe(ali.userId);
  });

  test("list conversations via REST", async () => {
    const { res, body } = await ali.getConversations();
    expect(res.status()).toBe(200);
    const convos = Array.isArray(body) ? body : body.conversations || [];
    expect(convos.length).toBeGreaterThan(0);
  });

  test("get message history via REST", async () => {
    const { res, body } = await ali.getDmMessages(sara.userId);
    expect(res.status()).toBe(200);
    const messages = Array.isArray(body) ? body : body.messages || [];
    expect(messages.length).toBeGreaterThan(0);
  });

  test("search users to DM", async () => {
    const { res, body } = await ali.searchUsers("Sara");
    expect(res.status()).toBe(200);
    const users = body.users ?? body;
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    expect(users.some((u: { name: string }) => u.name.includes("Sara"))).toBe(true);
  });

  test("cannot edit another user's DM — error", async () => {
    const text = `Sara's DM ${Date.now()}`;
    await sara.sendDm(ali.userId, text);

    const msg = await ali.waitForEvent<{ id: string }>(
      "receive_dm",
      { filter: (d) => (d as { content: string }).content === text },
    );

    ali.clearEventBuffer("error");
    ali.editDm(msg.id, sara.userId, "Trying to edit Sara's DM");

    const err = await ali.waitForError("edit_dm", 5000);
    expect(err.message).toBeTruthy();
  });
});
