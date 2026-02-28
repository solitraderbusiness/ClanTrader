import { test, expect } from "@playwright/test";
import { createAgent, createStandaloneAgent } from "../helpers/test-utils";
import { TRADER1 } from "../helpers/seed-accounts";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("17 — EA Heartbeat & Trade Sync", () => {
  let agent: TestAgent;
  let apiKey: string;

  test.beforeAll(async () => {
    agent = await createStandaloneAgent(TRADER1, BASE);

    // Register a fresh EA account to get an apiKey
    const username = `hb_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const res = await agent.post("/api/ea/register", {
      username,
      password: "securePass1!",
      accountNumber: 400000 + Math.floor(Math.random() * 500000),
      broker: "HeartbeatBroker",
      platform: "MT4",
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    apiKey = body.apiKey;
    expect(apiKey).toBeTruthy();
  });

  test.afterAll(async () => {
    await agent?.dispose();
  });

  test("heartbeat updates balance/equity → 200", async ({ request }) => {
    const tmpAgent = await createAgent(request, TRADER1, BASE);
    const res = await tmpAgent.postWithBearer("/api/ea/heartbeat", apiKey, {
      balance: 10500.0,
      equity: 10650.25,
      margin: 200.0,
      freeMargin: 10450.25,
      openTrades: [],
    });
    expect(res.status()).toBe(200);
  });

  test("heartbeat with invalid API key → 401", async ({ request }) => {
    const tmpAgent = await createAgent(request, TRADER1, BASE);
    const res = await tmpAgent.postWithBearer("/api/ea/heartbeat", "invalid-key-12345", {
      balance: 10000,
      equity: 10000,
      openTrades: [],
    });
    expect(res.status()).toBe(401);
  });

  test("trade event (open) → 200", async ({ request }) => {
    const tmpAgent = await createAgent(request, TRADER1, BASE);
    const res = await tmpAgent.postWithBearer("/api/ea/trade-event", apiKey, {
      event: "open",
      trade: {
        ticket: 100001,
        symbol: "EURUSD",
        direction: "BUY",
        lots: 0.1,
        openPrice: 1.085,
        openTime: new Date().toISOString(),
        isOpen: true,
      },
    });
    expect(res.status()).toBe(200);
  });

  test("trade event (close) → 200", async ({ request }) => {
    const tmpAgent = await createAgent(request, TRADER1, BASE);
    const res = await tmpAgent.postWithBearer("/api/ea/trade-event", apiKey, {
      event: "close",
      trade: {
        ticket: 100001,
        symbol: "EURUSD",
        direction: "BUY",
        lots: 0.1,
        openPrice: 1.085,
        closePrice: 1.091,
        openTime: new Date(Date.now() - 3600000).toISOString(),
        closeTime: new Date().toISOString(),
        profit: 60.0,
        isOpen: false,
      },
    });
    expect(res.status()).toBe(200);
  });

  test("sync trade history (bulk) → 200", async ({ request }) => {
    const tmpAgent = await createAgent(request, TRADER1, BASE);
    const res = await tmpAgent.postWithBearer("/api/ea/trades/sync", apiKey, {
      trades: [
        {
          ticket: 200001,
          symbol: "XAUUSD",
          direction: "SELL",
          lots: 0.05,
          openPrice: 2020.5,
          closePrice: 2015.0,
          openTime: new Date(Date.now() - 7200000).toISOString(),
          closeTime: new Date(Date.now() - 3600000).toISOString(),
          profit: 27.5,
          isOpen: false,
        },
        {
          ticket: 200002,
          symbol: "GBPUSD",
          direction: "BUY",
          lots: 0.1,
          openPrice: 1.265,
          openTime: new Date().toISOString(),
          isOpen: true,
        },
      ],
    });
    expect(res.status()).toBe(200);
  });

  test("poll pending actions → 200", async ({ request }) => {
    const tmpAgent = await createAgent(request, TRADER1, BASE);
    const res = await tmpAgent.getWithBearer("/api/ea/poll-actions", apiKey);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.pendingActions).toBeDefined();
    expect(Array.isArray(body.pendingActions)).toBe(true);
  });

  test("report action result → 200 or 400 (no pending action)", async ({ request }) => {
    const tmpAgent = await createAgent(request, TRADER1, BASE);
    // Use a fake action ID — should return 400/404 since no pending action exists
    const res = await tmpAgent.postWithBearer(
      "/api/ea/actions/nonexistent-action-id/result",
      apiKey,
      { success: true },
    );
    // Either 400 (bad action id) or 404 (not found) is acceptable
    expect([400, 404]).toContain(res.status());
  });
});
