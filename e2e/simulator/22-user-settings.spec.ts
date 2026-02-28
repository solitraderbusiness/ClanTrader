import { test, expect } from "@playwright/test";
import { TRADER1 } from "../helpers/seed-accounts";
import { createAgent } from "../helpers/test-utils";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("22 — User Settings: Missions, Onboarding, Profile, MT Status", () => {
  // -----------------------------------------------------------------------
  // Missions
  // -----------------------------------------------------------------------
  test.describe("Missions", () => {
    test("get missions → 200 with array of missions", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.get("/api/users/me/missions");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.missions).toBeDefined();
      expect(Array.isArray(body.missions)).toBe(true);
      // Each mission has id, label, completed
      if (body.missions.length > 0) {
        const m = body.missions[0];
        expect(m).toHaveProperty("id");
        expect(m).toHaveProperty("label");
        expect(typeof m.completed).toBe("boolean");
      }
    });
  });

  // -----------------------------------------------------------------------
  // Onboarding Intent
  // -----------------------------------------------------------------------
  test.describe("Onboarding Intent", () => {
    test("set onboarding intent (LEARN) → 200", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.put("/api/users/me/onboarding-intent", {
        intent: "LEARN",
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test("set onboarding intent (null) → 200", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.put("/api/users/me/onboarding-intent", {
        intent: null,
      });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // MT Status
  // -----------------------------------------------------------------------
  test.describe("MT Status", () => {
    test("get MT status → 200", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const res = await agent.get("/api/users/me/mt-status");
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(typeof body.hasAccounts).toBe("boolean");
    });
  });

  // -----------------------------------------------------------------------
  // Profile
  // -----------------------------------------------------------------------
  test.describe("Profile", () => {
    test("update profile fields → 200", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const newBio = `Sim test bio ${Date.now()}`;
      const { res, body } = await agent.updateProfile({ bio: newBio });
      expect(res.status()).toBe(200);
      expect(body.bio).toBe(newBio);
    });

    test("get own profile → 200", async ({ request }) => {
      const agent = await createAgent(request, TRADER1, BASE);
      const { res, body } = await agent.getUser(agent.userId);
      expect(res.status()).toBe(200);
      expect(body.name).toBeTruthy();
    });
  });
});
