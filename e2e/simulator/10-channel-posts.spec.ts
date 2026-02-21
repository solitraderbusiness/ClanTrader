import { test, expect } from "@playwright/test";
import { TRADER1, TRADER2, SPECTATOR } from "../helpers/seed-accounts";
import { createStandaloneAgents } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("10 — Channel Posts (REST)", () => {
  let ali: TestAgent;
  let sara: TestAgent;
  let clanId: string;
  let postId: string;

  test.beforeAll(async () => {
    [ali, sara] = await createStandaloneAgents([TRADER1, TRADER2], BASE);

    // Find Golden Eagles
    const { body } = await ali.discoverClans("Golden Eagles");
    const clans = Array.isArray(body) ? body : body.clans || [];
    const ge = clans.find((c: { name: string }) => c.name === "Golden Eagles");
    expect(ge).toBeTruthy();
    clanId = ge.id;
  });

  test.afterAll(async () => {
    await ali.dispose();
    await sara.dispose();
  });

  test("create a channel post", async () => {
    const { res, body } = await ali.createPost(clanId, {
      title: "Weekly Gold Analysis",
      content: "Gold is showing a bullish pattern on the weekly chart. Key levels: 2650 support, 2700 resistance.",
    });
    expect(res.status()).toBeLessThan(300);
    expect(body.title).toBe("Weekly Gold Analysis");
    expect(body.content).toContain("Gold is showing");
    postId = body.id;
  });

  test("get post by ID", async () => {
    const { res, body } = await ali.getPost(clanId, postId);
    expect(res.status()).toBe(200);
    expect(body.id).toBe(postId);
    expect(body.title).toBe("Weekly Gold Analysis");
  });

  test("list channel posts", async () => {
    const { res, body } = await ali.getPosts(clanId);
    expect(res.status()).toBe(200);
    const posts = Array.isArray(body) ? body : body.posts || [];
    expect(posts.length).toBeGreaterThan(0);
  });

  test("react to a post with emoji", async () => {
    const { res, body } = await sara.reactToPost(clanId, postId, "\u{1F525}");
    expect(res.status()).toBeLessThan(300);
  });

  test("toggle reaction off", async () => {
    // React again with same emoji = toggle off
    const { res } = await sara.reactToPost(clanId, postId, "\u{1F525}");
    expect(res.status()).toBeLessThan(300);
  });

  test("update own post", async () => {
    const { res, body } = await ali.updatePost(clanId, postId, {
      content: "Updated: Gold is now consolidating around 2660.",
    });
    expect(res.status()).toBe(200);
    expect(body.content).toContain("Updated");
  });

  test("non-author cannot update post", async () => {
    const { res } = await sara.updatePost(clanId, postId, { content: "Hacked!" });
    expect(res.status()).toBeGreaterThanOrEqual(403);
  });

  test("author can delete post", async () => {
    // Create a new post to delete
    const { body: newPost } = await ali.createPost(clanId, {
      content: "This will be deleted.",
    });
    const res = await ali.deletePost(clanId, newPost.id);
    expect(res.status()).toBeLessThan(300);

    // Verify it's gone
    const { res: checkRes } = await ali.getPost(clanId, newPost.id);
    expect(checkRes.status()).toBeGreaterThanOrEqual(400);
  });
});
