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
 * Calculate raw price P&L (direction-aware price difference).
 * Used for trades without a stop loss where R:R is undefined.
 */
export function calculatePricePnl(
  direction: TradeDirection,
  currentPrice: number,
  entry: number
): number {
  const dir = direction === "LONG" ? 1 : -1;
  return dir * (currentPrice - entry);
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

// ── Frozen Snapshot Resolution ──────────────────────────────────────────
//
// Trade cards display a "planned/original setup R:R" that must stay fixed
// after the 20-second qualification window.  These helpers resolve the
// authoritative frozen values using a strict priority chain:
//
//   official (from qualification snapshot)
//     → initial (captured at trade creation)
//       → card (mutable last-resort for untracked/analysis trades)

/** Minimal fields needed to resolve the frozen snapshot. */
export interface FrozenSnapshotFields {
  officialEntryPrice?: number | null;
  officialInitialRiskAbs?: number | null;
  officialInitialTargets?: number[] | null;
  initialEntry?: number | null;
  initialRiskAbs?: number | null;
}

/** Resolve the frozen entry price from the snapshot hierarchy. */
export function getFrozenEntry(
  trade: FrozenSnapshotFields | null | undefined,
  cardEntry: number
): number {
  return trade?.officialEntryPrice ?? trade?.initialEntry ?? cardEntry;
}

/** Resolve the frozen risk distance from the snapshot hierarchy. */
export function getFrozenRiskAbs(
  trade: FrozenSnapshotFields | null | undefined,
  cardEntry: number,
  cardSL: number
): number {
  if (trade?.officialInitialRiskAbs && trade.officialInitialRiskAbs > 0)
    return trade.officialInitialRiskAbs;
  if (trade?.initialRiskAbs && trade.initialRiskAbs > 0)
    return trade.initialRiskAbs;
  const entry = getFrozenEntry(trade, cardEntry);
  return cardSL > 0 ? Math.abs(entry - cardSL) : 0;
}

/** Resolve the frozen take-profit from the snapshot hierarchy. */
export function getFrozenTP(
  trade: FrozenSnapshotFields | null | undefined,
  cardTargets: number[]
): number {
  const officialTP = trade?.officialInitialTargets?.[0];
  if (officialTP && officialTP > 0) return officialTP;
  return cardTargets[0] ?? 0;
}

/**
 * Calculate the planned/original setup R:R ratio as a number.
 * Uses the frozen snapshot so the value never changes when SL/TP
 * are modified after the qualification window.
 */
export function getPlannedRRRatio(
  trade: FrozenSnapshotFields | null | undefined,
  card: { entry: number; stopLoss: number; targets: number[]; direction: string }
): number | null {
  const entry = getFrozenEntry(trade, card.entry);
  const riskAbs = getFrozenRiskAbs(trade, card.entry, card.stopLoss);
  const tp = getFrozenTP(trade, card.targets);

  if (!tp || !entry || riskAbs <= 0) return null;

  const reward = card.direction === "LONG" ? tp - entry : entry - tp;
  const rr = reward / riskAbs;
  return rr > 0 ? rr : null;
}

/**
 * Format the planned/original setup R:R as "1:X.X".
 * Convenience wrapper around getPlannedRRRatio.
 */
export function formatPlannedRR(
  trade: FrozenSnapshotFields | null | undefined,
  card: { entry: number; stopLoss: number; targets: number[]; direction: string }
): string | null {
  const rr = getPlannedRRRatio(trade, card);
  if (rr == null) return null;
  return `1:${rr.toFixed(1)}`;
}
