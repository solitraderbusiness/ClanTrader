import type { RiskStatus, TradeDirection } from "@prisma/client";

/**
 * Derive risk status from current SL position relative to entry.
 * Uses a small epsilon (0.01%) to detect breakeven proximity.
 */
export function deriveRiskStatus(
  direction: TradeDirection,
  entry: number,
  currentSL: number
): RiskStatus {
  if (currentSL <= 0) return "UNPROTECTED";

  const diff = currentSL - entry;
  const epsilon = entry * 0.0001; // 0.01% tolerance for BE detection

  if (Math.abs(diff) <= epsilon) return "BREAKEVEN";

  if (direction === "LONG") {
    // LONG: SL above entry = locked profit, SL below entry = protected
    return diff > 0 ? "LOCKED_PROFIT" : "PROTECTED";
  } else {
    // SHORT: SL below entry = locked profit, SL above entry = protected
    return diff < 0 ? "LOCKED_PROFIT" : "PROTECTED";
  }
}

/**
 * Calculate live R:R using immutable initial risk distance.
 * Returns how many R the current price represents.
 */
export function calculateLiveRR(
  direction: TradeDirection,
  currentPrice: number,
  initialEntry: number,
  initialRiskAbs: number
): number {
  if (!initialRiskAbs || initialRiskAbs <= 0) return 0;
  const dir = direction === "LONG" ? 1 : -1;
  return (dir * (currentPrice - initialEntry)) / initialRiskAbs;
}

/**
 * Calculate target R:R using immutable initial risk distance.
 * Returns null if TP is missing.
 */
export function calculateTargetRR(
  currentTP: number | undefined | null,
  initialEntry: number,
  initialRiskAbs: number
): number | null {
  if (!currentTP || currentTP <= 0) return null;
  if (!initialRiskAbs || initialRiskAbs <= 0) return null;
  return Math.abs(currentTP - initialEntry) / initialRiskAbs;
}
