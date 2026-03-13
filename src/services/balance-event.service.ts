/**
 * balance-event.service.ts — Deposit/withdrawal detection & cash-flow-neutral performance
 *
 * Detects external cash flows (deposits, withdrawals, credits) by comparing
 * balance changes against realized closed-trade PnL. Provides TWR/NAV-based
 * performance math that is immune to deposit/withdrawal distortion.
 *
 * Architecture:
 * - Raw money truth (balance, equity) is NEVER modified — stays as broker reports
 * - Performance truth (NAV, TWR, adjusted series) strips out cash flows
 * - Every detected event is stored with full audit metadata
 *
 * Key formulas:
 * - externalFlow = balanceDelta - closedTradesPnL
 * - subperiodReturn = (V_after - V_before - cashFlow) / V_before
 * - TWR = product(1 + r_t) - 1
 * - adjustedEquity = rawEquity - cumulativeExternalFlow
 */

import { db } from "@/lib/db";
import type { BalanceEventType, BalanceEventSource } from "@prisma/client";

// ─── Pure Functions (no DB, fully testable) ────────────────────────────

/**
 * Compute the dynamic threshold for external flow detection.
 *
 * We need to catch real deposits/withdrawals (almost always > $50) while
 * ignoring broker noise:
 * - Floating point rounding: < $0.01
 * - Commission micro-adjustments after close: < $2
 * - Swap rounding: < $1
 *
 * Strategy: tiered by account size. Err on the side of recording
 * (false positives become UNKNOWN_EXTERNAL_FLOW, which is harmless).
 */
export function computeDynamicThreshold(balance: number): number {
  const abs = Math.abs(balance);
  if (abs < 500) return 1;         // Micro accounts
  if (abs < 5_000) return 2;       // Small accounts
  if (abs < 50_000) return 5;      // Medium accounts
  if (abs < 500_000) return 10;    // Large accounts
  return 25;                       // Very large accounts
}

/**
 * Detect external cash flow from a heartbeat balance change.
 *
 * Formula: externalFlow = (newBalance - prevBalance) - closedTradesPnL
 * If |externalFlow| exceeds the dynamic threshold → cash flow detected.
 *
 * Returns null if no external flow detected (normal trading activity only).
 */
export function computeExternalFlow(
  prevBalance: number,
  newBalance: number,
  closedTradesPnL: number,
): { signedAmount: number; absAmount: number } | null {
  const balanceDelta = newBalance - prevBalance;
  const externalFlow = balanceDelta - closedTradesPnL;

  const threshold = computeDynamicThreshold(prevBalance);
  if (Math.abs(externalFlow) <= threshold) return null;

  return {
    signedAmount: Math.round(externalFlow * 100) / 100,
    absAmount: Math.round(Math.abs(externalFlow) * 100) / 100,
  };
}

/**
 * Classify an external flow into a specific event type.
 * Conservative: if the amount is ambiguous (very small), mark as UNKNOWN.
 */
export function classifyExternalFlow(signedAmount: number): BalanceEventType {
  if (signedAmount > 0) return "DEPOSIT";
  if (signedAmount < 0) return "WITHDRAWAL";
  return "UNKNOWN_EXTERNAL_FLOW";
}

/**
 * Compute a sub-period return for TWR calculation.
 *
 * Formula: r = (V_end - V_start - CF) / V_start
 * Where CF = external cash flow during the interval.
 *
 * Returns 0 if V_start is zero or negative (prevents division by zero).
 */
export function computeSubperiodReturn(
  valueBefore: number,
  valueAfter: number,
  externalFlow: number,
): number {
  if (valueBefore <= 0) return 0;
  return (valueAfter - valueBefore - externalFlow) / valueBefore;
}

/**
 * Compute cumulative Time-Weighted Return (TWR) from sub-period returns.
 *
 * TWR = product(1 + r_t) - 1
 * This is the standard institutional method for measuring portfolio
 * performance independent of cash flows.
 */
export function computeTWR(returns: number[]): number {
  if (returns.length === 0) return 0;
  let product = 1;
  for (const r of returns) {
    product *= (1 + r);
  }
  return product - 1;
}

/**
 * Update NAV (Net Asset Value) after a heartbeat.
 *
 * NAV tracks cash-flow-neutral growth. It starts at 1.0 and grows/shrinks
 * based only on trading performance, ignoring deposits/withdrawals.
 *
 * Formula: newNAV = oldNAV × (1 + subperiodReturn)
 * Where subperiodReturn = (equityAfter - equityBefore - externalFlow) / equityBefore
 */
export function computeUpdatedNav(
  currentNav: number,
  equityBefore: number,
  equityAfter: number,
  externalFlow: number,
): number {
  if (equityBefore <= 0 || currentNav <= 0) return currentNav;
  const r = computeSubperiodReturn(equityBefore, equityAfter, externalFlow);
  // Clamp extreme returns to prevent NAV from going negative
  // (would require > 100% loss in a single interval, which shouldn't happen)
  const clampedR = Math.max(r, -0.99);
  const newNav = currentNav * (1 + clampedR);
  return Math.round(newNav * 1_000_000) / 1_000_000; // 6 decimal precision
}

/**
 * Compute max drawdown from a NAV series.
 * Returns drawdown as a positive percentage (0-100+).
 */
export function computeNavDrawdown(
  currentNav: number,
  peakNav: number,
): { drawdownPct: number; newPeak: number } {
  const newPeak = Math.max(peakNav, currentNav);
  const drawdownPct = newPeak > 0
    ? ((newPeak - currentNav) / newPeak) * 100
    : 0;
  return {
    drawdownPct: Math.round(drawdownPct * 100) / 100,
    newPeak: Math.round(newPeak * 1_000_000) / 1_000_000,
  };
}

/**
 * Adjust an equity/balance series by subtracting cumulative external flows.
 *
 * This produces a chart series that shows trading performance only,
 * without deposit/withdrawal spikes. The adjusted values represent
 * "what the account would look like if all money was there from the start."
 *
 * Input: array of { balance, equity, externalFlowSigned }
 * Output: array of { adjustedBalance, adjustedEquity } with cumulative flows subtracted
 */
export function adjustEquitySeries(
  data: Array<{
    balance: number;
    equity: number;
    externalFlowSigned: number;
    timestamp: string;
    isEstimated?: boolean;
    isBalanceEventBoundary?: boolean;
  }>,
): Array<{
  balance: number;
  equity: number;
  timestamp: string;
  isEstimated?: boolean;
  isBalanceEventBoundary?: boolean;
}> {
  let cumulativeFlow = 0;
  return data.map((d) => {
    cumulativeFlow += d.externalFlowSigned;
    return {
      balance: d.balance - cumulativeFlow,
      equity: d.equity - cumulativeFlow,
      timestamp: d.timestamp,
      isEstimated: d.isEstimated,
      isBalanceEventBoundary: d.isBalanceEventBoundary,
    };
  });
}

// ─── DB Functions ──────────────────────────────────────────────────────

/**
 * Record a detected balance event to the database.
 * Updates the MtAccount's cumulativeExternalFlow.
 */
export async function recordBalanceEvent(
  accountId: string,
  signedAmount: number,
  balanceBefore: number,
  balanceAfter: number,
  closedTradesPnL: number,
  source: BalanceEventSource = "HEARTBEAT",
): Promise<string> {
  const type = classifyExternalFlow(signedAmount);
  const absAmount = Math.abs(signedAmount);

  const event = await db.balanceEvent.create({
    data: {
      mtAccountId: accountId,
      type,
      signedAmount,
      absAmount,
      balanceBefore,
      balanceAfter,
      inferredFrom: source,
      metadata: {
        closedTradesPnL: Math.round(closedTradesPnL * 100) / 100,
        balanceDelta: Math.round((balanceAfter - balanceBefore) * 100) / 100,
        residual: Math.round(signedAmount * 100) / 100,
        threshold: computeDynamicThreshold(balanceBefore),
        detectionFormula: "externalFlow = balanceDelta - closedTradesPnL",
      },
    },
  });

  // Update running total on MtAccount
  await db.mtAccount.update({
    where: { id: accountId },
    data: {
      cumulativeExternalFlow: { increment: signedAmount },
    },
  });

  return event.id;
}

/**
 * Update NAV-based drawdown tracking on an MtAccount after a heartbeat.
 * This is the cash-flow-neutral alternative to raw peakEquity drawdown.
 */
export async function updateNavDrawdown(
  accountId: string,
  equityBefore: number,
  equityAfter: number,
  externalFlow: number,
): Promise<void> {
  const account = await db.mtAccount.findUnique({
    where: { id: accountId },
    select: { navValue: true, peakNav: true, maxNavDrawdownPct: true },
  });
  if (!account) return;

  const newNav = computeUpdatedNav(
    account.navValue,
    equityBefore,
    equityAfter,
    externalFlow,
  );

  const { drawdownPct, newPeak } = computeNavDrawdown(newNav, account.peakNav);
  const maxNavDD = Math.max(account.maxNavDrawdownPct, drawdownPct);

  await db.mtAccount.update({
    where: { id: accountId },
    data: {
      navValue: newNav,
      peakNav: newPeak,
      maxNavDrawdownPct: Math.round(maxNavDD * 100) / 100,
    },
  });
}

/**
 * Get cumulative external flows for equity snapshots in a time range.
 * Used by digest to build adjusted equity series.
 */
export async function getBalanceEventsForPeriod(
  accountIds: string[],
  since: Date,
): Promise<Array<{ mtAccountId: string; detectedAt: Date; signedAmount: number }>> {
  return db.balanceEvent.findMany({
    where: {
      mtAccountId: { in: accountIds },
      detectedAt: { gte: since },
    },
    orderBy: { detectedAt: "asc" },
    select: { mtAccountId: true, detectedAt: true, signedAmount: true },
  });
}

/**
 * Get the cumulative external flow BEFORE a given date for an account.
 * Used to compute the baseline adjustment for chart period starts.
 */
export async function getCumulativeFlowBefore(
  accountId: string,
  before: Date,
): Promise<number> {
  const result = await db.balanceEvent.aggregate({
    where: {
      mtAccountId: accountId,
      detectedAt: { lt: before },
    },
    _sum: { signedAmount: true },
  });
  return result._sum.signedAmount ?? 0;
}
