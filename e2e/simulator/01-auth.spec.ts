import { test, expect } from "@playwright/test";
import { ADMIN, TRADER1, TRADER2, SPECTATOR } from "../helpers/seed-accounts";
import { createAgent } from "../helpers/test-utils";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("01 — Authentication & Session", () => {
  test("admin can log in and get session", async ({ request }) => {
    const agent = await createAgent(request, ADMIN, BASE);
    expect(agent.session.email).toBe(ADMIN.email);
    expect(agent.session.role).toBe("ADMIN");
    expect(agent.session.userId).toBeTruthy();
  });

  test("trader can log in and get session", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    expect(agent.session.email).toBe(TRADER1.email);
    expect(agent.session.role).toBe("TRADER");
  });

  test("spectator can log in and get session", async ({ request }) => {
    const agent = await createAgent(request, SPECTATOR, BASE);
    expect(agent.session.email).toBe(SPECTATOR.email);
    expect(agent.session.role).toBe("SPECTATOR");
  });

  test("login with invalid credentials fails gracefully", async ({ request }) => {
    const { TestAgent } = await import("../helpers/test-agent");
    const agent = new TestAgent(
      request,
      { email: "nobody@example.com", password: "wrong", name: "Bad", role: "SPECTATOR" },
      BASE,
    );
    await expect(agent.login()).rejects.toThrow(/Login failed/);
  });

  test("authenticated user can read own profile", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const { res, body } = await agent.getUser(agent.userId);
    expect(res.status()).toBe(200);
    expect(body.name).toBe(TRADER1.name);
  });

  test("authenticated user can update profile", async ({ request }) => {
    const agent = await createAgent(request, TRADER2, BASE);
    const newBio = `Test bio ${Date.now()}`;
    const { res, body } = await agent.updateProfile({ bio: newBio });
    expect(res.status()).toBe(200);
    expect(body.bio).toBe(newBio);
  });

  test("authenticated user can search users", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const { res, body } = await agent.searchUsers("Sara");
    expect(res.status()).toBe(200);
    const users = body.users ?? body;
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
  });

  test("session persists across requests", async ({ request }) => {
    const agent = await createAgent(request, ADMIN, BASE);
    const r1 = await agent.get("/api/auth/session");
    const s1 = await r1.json();
    const r2 = await agent.get("/api/auth/session");
    const s2 = await r2.json();
    expect(s1.user.id).toBe(s2.user.id);
  });
});
