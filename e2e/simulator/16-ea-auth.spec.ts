import { test, expect } from "@playwright/test";
import { createAgent } from "../helpers/test-utils";
import { TRADER1 } from "../helpers/seed-accounts";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("16 — EA Registration & Login", () => {
  const unique = () => `ea_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  test("register EA user with valid data → 201", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const username = unique();
    const res = await agent.post("/api/ea/register", {
      username,
      password: "securePass1!",
      accountNumber: 100000 + Math.floor(Math.random() * 900000),
      broker: "TestBroker",
      platform: "MT4",
      serverName: "TestServer",
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.apiKey).toBeTruthy();
  });

  test("register with duplicate username → 409", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const username = unique();
    const payload = {
      username,
      password: "securePass1!",
      accountNumber: 200000 + Math.floor(Math.random() * 900000),
      broker: "TestBroker",
      platform: "MT4",
    };

    // First registration
    const first = await agent.post("/api/ea/register", payload);
    expect(first.status()).toBe(201);

    // Duplicate — either username taken or account already connected → 409
    const second = await agent.post("/api/ea/register", payload);
    expect(second.status()).toBe(409);
  });

  test("login EA user with valid credentials → 200", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const username = unique();
    const accountNumber = 300000 + Math.floor(Math.random() * 900000);
    const password = "securePass1!";

    // Register first
    const regRes = await agent.post("/api/ea/register", {
      username,
      password,
      accountNumber,
      broker: "TestBroker",
      platform: "MT5",
    });
    expect(regRes.status()).toBe(201);

    // Login
    const loginRes = await agent.post("/api/ea/login", {
      username,
      password,
      accountNumber,
      broker: "TestBroker",
      platform: "MT5",
    });
    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    expect(body.apiKey).toBeTruthy();
  });

  test("login with invalid credentials → 401", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const res = await agent.post("/api/ea/login", {
      username: "nonexistent_user",
      password: "wrongPassword1!",
      accountNumber: 999999,
      broker: "FakeBroker",
      platform: "MT4",
    });
    expect(res.status()).toBe(401);
  });

  test("register with invalid input (missing fields) → 400", async ({ request }) => {
    const agent = await createAgent(request, TRADER1, BASE);
    const res = await agent.post("/api/ea/register", {
      username: "ab", // too short (min 3)
    });
    expect(res.status()).toBe(400);
  });
});
