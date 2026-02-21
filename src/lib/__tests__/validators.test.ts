import { describe, it, expect } from "vitest";
import { sendTradeCardSchema } from "../validators";

const validBase = {
  clanId: "test-clan",
  topicId: "test-topic",
  instrument: "XAUUSD",
  timeframe: "H1",
};

describe("sendTradeCardSchema — single target enforcement", () => {
  it("rejects 0 targets", () => {
    const result = sendTradeCardSchema.safeParse({
      ...validBase,
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      targets: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects 2 targets", () => {
    const result = sendTradeCardSchema.safeParse({
      ...validBase,
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      targets: [110, 120],
    });
    expect(result.success).toBe(false);
  });

  it("accepts 1 target", () => {
    const result = sendTradeCardSchema.safeParse({
      ...validBase,
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      targets: [110],
    });
    expect(result.success).toBe(true);
  });
});

describe("sendTradeCardSchema — price ordering", () => {
  it("LONG: rejects SL >= entry", () => {
    const result = sendTradeCardSchema.safeParse({
      ...validBase,
      direction: "LONG",
      entry: 100,
      stopLoss: 100,
      targets: [110],
    });
    expect(result.success).toBe(false);
  });

  it("LONG: rejects TP <= entry", () => {
    const result = sendTradeCardSchema.safeParse({
      ...validBase,
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      targets: [100],
    });
    expect(result.success).toBe(false);
  });

  it("SHORT: rejects SL <= entry", () => {
    const result = sendTradeCardSchema.safeParse({
      ...validBase,
      direction: "SHORT",
      entry: 100,
      stopLoss: 100,
      targets: [90],
    });
    expect(result.success).toBe(false);
  });

  it("SHORT: rejects TP >= entry", () => {
    const result = sendTradeCardSchema.safeParse({
      ...validBase,
      direction: "SHORT",
      entry: 100,
      stopLoss: 105,
      targets: [100],
    });
    expect(result.success).toBe(false);
  });

  it("valid LONG passes", () => {
    const result = sendTradeCardSchema.safeParse({
      ...validBase,
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      targets: [110],
    });
    expect(result.success).toBe(true);
  });

  it("valid SHORT passes", () => {
    const result = sendTradeCardSchema.safeParse({
      ...validBase,
      direction: "SHORT",
      entry: 100,
      stopLoss: 105,
      targets: [90],
    });
    expect(result.success).toBe(true);
  });
});
