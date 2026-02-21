import { describe, it, expect } from "vitest";
import { evaluateTradeOnCandle } from "../trade-evaluator";
import type { CandleData } from "@/types/trade-integrity";

function candle(low: number, high: number, open?: number, close?: number): CandleData {
  return {
    timestamp: new Date("2026-02-21T12:00:00Z"),
    open: open ?? low,
    high,
    low,
    close: close ?? high,
  };
}

describe("evaluateTradeOnCandle", () => {
  // LONG trade: entry=100, SL=95, TP=110
  const entry = 100;
  const sl = 95;
  const tp = 110;

  // --- PENDING ---
  describe("PENDING status", () => {
    it("returns NOOP when nothing is touched", () => {
      const result = evaluateTradeOnCandle("PENDING", entry, sl, tp, candle(101, 105));
      expect(result).toEqual({ action: "NOOP" });
    });

    it("returns ENTER when only entry is touched", () => {
      const result = evaluateTradeOnCandle("PENDING", entry, sl, tp, candle(98, 102));
      expect(result.action).toBe("ENTER");
    });

    it("returns MARK_UNVERIFIED(ENTRY_CONFLICT) when entry + SL touched", () => {
      const result = evaluateTradeOnCandle("PENDING", entry, sl, tp, candle(94, 102));
      expect(result.action).toBe("MARK_UNVERIFIED");
      if (result.action === "MARK_UNVERIFIED") {
        expect(result.reason).toBe("ENTRY_CONFLICT");
        expect(result.details.touchedLevels).toContain("entry");
        expect(result.details.touchedLevels).toContain("stopLoss");
      }
    });

    it("returns MARK_UNVERIFIED(ENTRY_CONFLICT) when entry + TP touched", () => {
      const result = evaluateTradeOnCandle("PENDING", entry, sl, tp, candle(99, 111));
      expect(result.action).toBe("MARK_UNVERIFIED");
      if (result.action === "MARK_UNVERIFIED") {
        expect(result.reason).toBe("ENTRY_CONFLICT");
        expect(result.details.touchedLevels).toContain("entry");
        expect(result.details.touchedLevels).toContain("takeProfit");
      }
    });

    it("returns MARK_UNVERIFIED(ENTRY_CONFLICT) when entry + SL + TP all touched", () => {
      const result = evaluateTradeOnCandle("PENDING", entry, sl, tp, candle(90, 115));
      expect(result.action).toBe("MARK_UNVERIFIED");
      if (result.action === "MARK_UNVERIFIED") {
        expect(result.reason).toBe("ENTRY_CONFLICT");
        expect(result.details.touchedLevels).toContain("entry");
        expect(result.details.touchedLevels).toContain("stopLoss");
        expect(result.details.touchedLevels).toContain("takeProfit");
      }
    });

    it("returns NOOP when SL touched but not entry", () => {
      // SL=95 touched, but entry=100 not touched
      const result = evaluateTradeOnCandle("PENDING", entry, sl, tp, candle(93, 97));
      expect(result).toEqual({ action: "NOOP" });
    });
  });

  // --- OPEN ---
  describe("OPEN status", () => {
    it("returns NOOP when nothing is touched", () => {
      const result = evaluateTradeOnCandle("OPEN", entry, sl, tp, candle(101, 105));
      expect(result).toEqual({ action: "NOOP" });
    });

    it("returns RESOLVE_TP when only TP is touched", () => {
      const result = evaluateTradeOnCandle("OPEN", entry, sl, tp, candle(108, 112));
      expect(result.action).toBe("RESOLVE_TP");
    });

    it("returns RESOLVE_SL when only SL is touched", () => {
      const result = evaluateTradeOnCandle("OPEN", entry, sl, tp, candle(93, 97));
      expect(result.action).toBe("RESOLVE_SL");
    });

    it("returns MARK_UNVERIFIED(EXIT_CONFLICT) when SL + TP both touched", () => {
      const result = evaluateTradeOnCandle("OPEN", entry, sl, tp, candle(90, 115));
      expect(result.action).toBe("MARK_UNVERIFIED");
      if (result.action === "MARK_UNVERIFIED") {
        expect(result.reason).toBe("EXIT_CONFLICT");
        expect(result.details.touchedLevels).toContain("stopLoss");
        expect(result.details.touchedLevels).toContain("takeProfit");
      }
    });
  });

  // --- SHORT trade: entry=100, SL=105, TP=90 ---
  describe("SHORT trade", () => {
    const shortEntry = 100;
    const shortSL = 105;
    const shortTP = 90;

    it("PENDING: returns ENTER when entry touched only", () => {
      const result = evaluateTradeOnCandle("PENDING", shortEntry, shortSL, shortTP, candle(99, 101));
      expect(result.action).toBe("ENTER");
    });

    it("OPEN: returns RESOLVE_TP when TP touched", () => {
      const result = evaluateTradeOnCandle("OPEN", shortEntry, shortSL, shortTP, candle(88, 92));
      expect(result.action).toBe("RESOLVE_TP");
    });

    it("OPEN: returns RESOLVE_SL when SL touched", () => {
      const result = evaluateTradeOnCandle("OPEN", shortEntry, shortSL, shortTP, candle(103, 107));
      expect(result.action).toBe("RESOLVE_SL");
    });
  });

  // --- Edge cases ---
  describe("edge cases", () => {
    it("level exactly equals candle high → touched", () => {
      // TP=110, candle high=110 → touched
      const result = evaluateTradeOnCandle("OPEN", entry, sl, tp, candle(108, 110));
      expect(result.action).toBe("RESOLVE_TP");
    });

    it("level exactly equals candle low → touched", () => {
      // SL=95, candle low=95 → touched
      const result = evaluateTradeOnCandle("OPEN", entry, sl, tp, candle(95, 97));
      expect(result.action).toBe("RESOLVE_SL");
    });

    it("MARK_UNVERIFIED details include candle and trade snapshot", () => {
      const c = candle(90, 115, 100, 105);
      const result = evaluateTradeOnCandle("OPEN", entry, sl, tp, c);
      expect(result.action).toBe("MARK_UNVERIFIED");
      if (result.action === "MARK_UNVERIFIED") {
        expect(result.details.candleOHLC).toEqual({ open: 100, high: 115, low: 90, close: 105 });
        expect(result.details.tradeSnapshot).toEqual({ entry, stopLoss: sl, takeProfit: tp });
      }
    });
  });
});
