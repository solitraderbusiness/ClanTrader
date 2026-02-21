import type { CandleData, EvalResult } from "@/types/trade-integrity";

/**
 * Touch test: returns true if the price level was touched within the candle range.
 * No direction logic needed — validation ensures correct price ordering.
 */
function touched(level: number, low: number, high: number): boolean {
  return low <= level && level <= high;
}

/**
 * Pure function: evaluates a single trade against a single 1-minute candle.
 * Zero side effects, zero database access.
 *
 * Rules:
 * - PENDING: if entry touched AND (SL or TP touched) → ENTRY_CONFLICT
 *            if entry touched only → ENTER
 *            otherwise → NOOP
 * - OPEN:    if SL AND TP touched → EXIT_CONFLICT
 *            if SL only → RESOLVE_SL
 *            if TP only → RESOLVE_TP
 *            otherwise → NOOP
 * - Terminal status → NOOP
 */
export function evaluateTradeOnCandle(
  tradeStatus: "PENDING" | "OPEN",
  entry: number,
  stopLoss: number,
  takeProfit: number,
  candle: CandleData
): EvalResult {
  const { low, high, open, close, timestamp } = candle;

  const entryTouched = touched(entry, low, high);
  const slTouched = touched(stopLoss, low, high);
  const tpTouched = touched(takeProfit, low, high);

  if (tradeStatus === "PENDING") {
    if (entryTouched && (slTouched || tpTouched)) {
      const touchedLevels = ["entry"];
      if (slTouched) touchedLevels.push("stopLoss");
      if (tpTouched) touchedLevels.push("takeProfit");

      return {
        action: "MARK_UNVERIFIED",
        reason: "ENTRY_CONFLICT",
        details: {
          candleTimestamp: timestamp,
          candleOHLC: { open, high, low, close },
          touchedLevels,
          tradeSnapshot: { entry, stopLoss, takeProfit },
        },
      };
    }

    if (entryTouched) {
      return { action: "ENTER", timestamp };
    }

    return { action: "NOOP" };
  }

  // tradeStatus === "OPEN"
  if (slTouched && tpTouched) {
    return {
      action: "MARK_UNVERIFIED",
      reason: "EXIT_CONFLICT",
      details: {
        candleTimestamp: timestamp,
        candleOHLC: { open, high, low, close },
        touchedLevels: ["stopLoss", "takeProfit"],
        tradeSnapshot: { entry, stopLoss, takeProfit },
      },
    };
  }

  if (slTouched) {
    return { action: "RESOLVE_SL", timestamp };
  }

  if (tpTouched) {
    return { action: "RESOLVE_TP", timestamp };
  }

  return { action: "NOOP" };
}
