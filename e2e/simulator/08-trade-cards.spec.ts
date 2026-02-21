import { test, expect } from "@playwright/test";
import { TRADER1, TRADER2 } from "../helpers/seed-accounts";
import { createStandaloneAgents, sleep } from "../helpers/test-utils";
import type { TestAgent } from "../helpers/test-agent";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

test.describe("08 — Trade Cards (Socket.io)", () => {
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
    expect(ge).toBeTruthy();
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

  test("post LONG trade card with all fields", async () => {
    await ali.sendTradeCard({
      clanId,
      topicId,
      instrument: "XAUUSD",
      direction: "LONG",
      entry: 2650.50,
      stopLoss: 2640.00,
      targets: [2660.00, 2670.00, 2680.00],
      timeframe: "H4",
      riskPct: 2,
      note: "Gold looking bullish on H4",
      tags: ["gold", "swing"],
    });

    const msg = await sara.waitForEvent<{
      content: string;
      type: string;
      tradeCard: { instrument: string; direction: string; entry: number };
    }>(
      "receive_message",
      { filter: (d) => (d as { tradeCard?: unknown }).tradeCard != null, timeout: 10000 },
    );
    expect(msg.tradeCard).toBeTruthy();
    expect(msg.tradeCard.instrument).toBe("XAUUSD");
    expect(msg.tradeCard.direction).toBe("LONG");
    expect(msg.tradeCard.entry).toBe(2650.50);
  });

  test("post SHORT trade card", async () => {
    await sara.sendTradeCard({
      clanId,
      topicId,
      instrument: "EURUSD",
      direction: "SHORT",
      entry: 1.0850,
      stopLoss: 1.0900,
      targets: [1.0800, 1.0750],
      timeframe: "H1",
    });

    const msg = await ali.waitForEvent<{
      tradeCard: { instrument: string; direction: string };
    }>(
      "receive_message",
      { filter: (d) => {
        const tc = (d as { tradeCard?: { instrument: string } }).tradeCard;
        return tc?.instrument === "EURUSD";
      }},
    );
    expect(msg.tradeCard.direction).toBe("SHORT");
  });

  test("edit trade card — update targets", async () => {
    // Ali sends a trade card
    await ali.sendTradeCard({
      clanId,
      topicId,
      instrument: "GBPUSD",
      direction: "LONG",
      entry: 1.2700,
      stopLoss: 1.2650,
      targets: [1.2750],
      timeframe: "M15",
    });

    const msg = await ali.waitForEvent<{
      id: string;
      tradeCard: { instrument: string };
    }>(
      "receive_message",
      { filter: (d) => {
        const tc = (d as { tradeCard?: { instrument: string } }).tradeCard;
        return tc?.instrument === "GBPUSD";
      }},
    );

    // Edit — add more targets
    ali.editTradeCard({
      messageId: msg.id,
      clanId,
      instrument: "GBPUSD",
      direction: "LONG",
      entry: 1.2700,
      stopLoss: 1.2650,
      targets: [1.2750, 1.2800],
      timeframe: "M15",
    });

    const edited = await sara.waitForEvent<{
      id: string;
      tradeCard: { targets: number[] };
    }>(
      "message_edited",
      { filter: (d) => (d as { id: string }).id === msg.id, timeout: 10000 },
    );
    expect(edited.tradeCard.targets).toHaveLength(2);
  });

  test("track trade — status becomes OPEN", async () => {
    // Ali posts trade card
    await ali.sendTradeCard({
      clanId,
      topicId,
      instrument: "USDJPY",
      direction: "LONG",
      entry: 150.50,
      stopLoss: 150.00,
      targets: [151.00],
      timeframe: "H1",
    });

    const msg = await ali.waitForEvent<{
      id: string;
      tradeCard: { instrument: string };
    }>(
      "receive_message",
      { filter: (d) => {
        const tc = (d as { tradeCard?: { instrument: string } }).tradeCard;
        return tc?.instrument === "USDJPY";
      }},
    );

    // Track it
    ali.trackTrade(msg.id, clanId);

    const update = await ali.waitForEvent<{
      tradeId: string;
      status: string;
      trade: { id: string; status: string };
    }>(
      "trade_status_updated",
      { timeout: 10000 },
    );
    expect(update.status).toBe("OPEN");
    expect(update.trade.id).toBeTruthy();
  });

  test("update trade status to TP1_HIT", async () => {
    // Post + track first
    await ali.sendTradeCard({
      clanId,
      topicId,
      instrument: "NZDUSD",
      direction: "SHORT",
      entry: 0.6100,
      stopLoss: 0.6150,
      targets: [0.6050, 0.6000],
      timeframe: "D1",
    });

    const msg = await ali.waitForEvent<{
      id: string;
      tradeCard: { instrument: string };
    }>(
      "receive_message",
      { filter: (d) => {
        const tc = (d as { tradeCard?: { instrument: string } }).tradeCard;
        return tc?.instrument === "NZDUSD";
      }},
    );

    ali.trackTrade(msg.id, clanId);
    const tracked = await ali.waitForEvent<{ tradeId: string; status: string }>(
      "trade_status_updated",
      { timeout: 10000 },
    );

    // Update to TP1_HIT
    ali.updateTradeStatus(tracked.tradeId, clanId, "TP1_HIT", "First target hit!");

    const updated = await sara.waitForEvent<{ tradeId: string; status: string }>(
      "trade_status_updated",
      { filter: (d) => (d as { status: string }).status === "TP1_HIT", timeout: 10000 },
    );
    expect(updated.status).toBe("TP1_HIT");
  });

  test("update trade status to SL_HIT", async () => {
    await ali.sendTradeCard({
      clanId,
      topicId,
      instrument: "USDCAD",
      direction: "LONG",
      entry: 1.3600,
      stopLoss: 1.3550,
      targets: [1.3650],
      timeframe: "M30",
    });

    const msg = await ali.waitForEvent<{
      id: string;
      tradeCard: { instrument: string };
    }>(
      "receive_message",
      { filter: (d) => {
        const tc = (d as { tradeCard?: { instrument: string } }).tradeCard;
        return tc?.instrument === "USDCAD";
      }},
    );

    ali.trackTrade(msg.id, clanId);
    const tracked = await ali.waitForEvent<{ tradeId: string }>(
      "trade_status_updated",
      { timeout: 10000 },
    );

    ali.updateTradeStatus(tracked.tradeId, clanId, "SL_HIT", "Stopped out");

    const updated = await ali.waitForEvent<{ status: string }>(
      "trade_status_updated",
      { filter: (d) => (d as { status: string }).status === "SL_HIT", timeout: 10000 },
    );
    expect(updated.status).toBe("SL_HIT");
  });

  test("execute SET_BE action", async () => {
    await ali.sendTradeCard({
      clanId,
      topicId,
      instrument: "EURGBP",
      direction: "LONG",
      entry: 0.8550,
      stopLoss: 0.8500,
      targets: [0.8600],
      timeframe: "H4",
    });

    const msg = await ali.waitForEvent<{
      id: string;
      tradeCard: { instrument: string };
    }>(
      "receive_message",
      { filter: (d) => {
        const tc = (d as { tradeCard?: { instrument: string } }).tradeCard;
        return tc?.instrument === "EURGBP";
      }},
    );

    ali.trackTrade(msg.id, clanId);
    const tracked = await ali.waitForEvent<{ tradeId: string }>(
      "trade_status_updated",
      { timeout: 10000 },
    );

    ali.executeTradeAction({
      tradeId: tracked.tradeId,
      clanId,
      actionType: "SET_BE",
      note: "Moving to breakeven",
    });

    const action = await ali.waitForEvent<{ tradeId: string; actionType: string }>(
      "trade_action_executed",
      { timeout: 10000 },
    );
    expect(action.actionType).toBe("SET_BE");
  });

  test("execute CLOSE action", async () => {
    await ali.sendTradeCard({
      clanId,
      topicId,
      instrument: "AUDUSD",
      direction: "SHORT",
      entry: 0.6700,
      stopLoss: 0.6750,
      targets: [0.6650],
      timeframe: "H1",
    });

    const msg = await ali.waitForEvent<{
      id: string;
      tradeCard: { instrument: string };
    }>(
      "receive_message",
      { filter: (d) => {
        const tc = (d as { tradeCard?: { instrument: string } }).tradeCard;
        return tc?.instrument === "AUDUSD";
      }},
    );

    ali.trackTrade(msg.id, clanId);
    const tracked = await ali.waitForEvent<{ tradeId: string }>(
      "trade_status_updated",
      { timeout: 10000 },
    );

    ali.executeTradeAction({
      tradeId: tracked.tradeId,
      clanId,
      actionType: "CLOSE",
      note: "Taking profit early",
    });

    const action = await ali.waitForEvent<{ tradeId: string; actionType: string }>(
      "trade_action_executed",
      { timeout: 10000 },
    );
    expect(action.actionType).toBe("CLOSE");
  });

  test("validation rejects missing required fields", async () => {
    ali.clearEventBuffer("error");
    ali.emit("send_trade_card", {
      clanId,
      topicId,
      // Missing instrument, entry, stopLoss, targets etc.
      direction: "LONG",
    });

    const err = await ali.waitForError("send_trade_card", 5000);
    expect(err.message).toBeTruthy();
  });
});
