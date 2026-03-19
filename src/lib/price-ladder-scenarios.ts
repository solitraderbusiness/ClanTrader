// ────────────────────────────────────────────
// Price Ladder — Scenario Math
// ────────────────────────────────────────────
// Pure computation. No DB, no Redis, no side effects.
// All functions take data in, return numbers out.

// ─── Types ───

export interface ScenarioInput {
  symbol: string;
  direction: "LONG" | "SHORT";
  tradeCount: number;
  totalLots: number;
  currentPrice: number;
  avgEntry: number;
  worstEntry?: number;
  breakeven: number; // same as avgEntry for single trades
  currentSL: number | null; // null = no SL
  firstTP: number | null;
  balance: number | null;
  equity: number | null;
  currentFloatingPnl: number;
  currentFloatingR: number | null;
  rComputable: boolean;
  riskPerR: number | null; // $ per 1R (officialInitialRiskMoney or derived)
  dollarsPerPoint: number;
  unknownRiskTradeCount: number;
  unprotectedTradeCount: number;
  // Per-trade SL data for aggregate risk
  trades: Array<{
    lots: number;
    openPrice: number;
    currentSL: number | null;
    currentTP: number | null;
    floatingPnl: number;
    rComputable: boolean;
    riskPerR: number | null;
  }>;
}

export interface ScenarioOutput {
  scenarioPrice: number;
  projectedPnl: number;
  projectedBalancePct: number | null; // null if no balance
  projectedEquityPct: number | null; // null if no equity
  projectedR: number | null; // null if R not computable
  additionalPnlFromCurrent: number;
  deltaFromCurrentPrice: number;
  deltaFromCurrentPricePct: number;
  distanceToBreakeven: number;
  distanceToTP1: number | null;
  distanceToSL: number | null;
  riskToCurrentSL: number | null; // P/L if price goes to current SL
  scenarioStatus: ScenarioStatus;
  suggestedActionKey: string;
}

export type ScenarioStatus =
  | "deep_profit"
  | "profit"
  | "near_breakeven"
  | "small_loss"
  | "moderate_loss"
  | "significant_loss"
  | "severe_loss";

export interface PainLevel {
  percent: number; // e.g. -1, -2, -5, -10, +1, +2, +5
  price: number;
  pnlAtLevel: number;
  isRealistic: boolean; // within 0.2x-2.0x current price
}

export interface CurrentOpenRisk {
  knownRiskPnl: number; // P/L if all SLs hit from current price
  knownRiskBalancePct: number | null;
  knownRiskEquityPct: number | null;
  knownRiskR: number | null;
  unknownRiskTradeCount: number;
  unprotectedTradeCount: number;
  isComplete: boolean; // true if all trades have SL
}

export interface DefineMyRiskResult {
  targetRiskPct: number;
  suggestedSLPrice: number;
  projectedPnlAtSL: number;
  projectedBalancePctAtSL: number | null;
  projectedRAtSL: number | null;
  isRealistic: boolean;
}

// ─── Scenario Computation ───

/**
 * Compute projected P/L at a given scenario price.
 * For a group of trades on the same symbol+direction.
 */
export function computeScenarioPnl(
  scenarioPrice: number,
  avgEntry: number,
  totalLots: number,
  dollarsPerPoint: number,
  direction: "LONG" | "SHORT",
): number {
  const priceDiff = direction === "LONG"
    ? scenarioPrice - avgEntry
    : avgEntry - scenarioPrice;
  return priceDiff * totalLots * (dollarsPerPoint / totalLots);
  // dollarsPerPoint is already totalLots * pointValue, so:
  // priceDiff * dollarsPerPoint
}

/**
 * Full scenario computation for a given price.
 */
export function computeScenario(
  input: ScenarioInput,
  scenarioPrice: number,
): ScenarioOutput {
  const {
    direction, currentPrice, avgEntry, breakeven,
    currentSL, firstTP, balance, equity,
    currentFloatingPnl, rComputable, riskPerR,
    dollarsPerPoint,
  } = input;

  const isLong = direction === "LONG";

  // Projected P/L at scenario price
  const priceDiff = isLong
    ? scenarioPrice - avgEntry
    : avgEntry - scenarioPrice;
  const projectedPnl = priceDiff * dollarsPerPoint;

  // Additional P/L from current
  const additionalPnlFromCurrent = projectedPnl - currentFloatingPnl;

  // Balance/equity impact
  const projectedBalancePct = balance && balance > 0
    ? (additionalPnlFromCurrent / balance) * 100
    : null;
  const projectedEquityPct = equity && equity > 0
    ? (additionalPnlFromCurrent / equity) * 100
    : null;

  // Projected R
  const projectedR = rComputable && riskPerR && riskPerR > 0
    ? projectedPnl / riskPerR
    : null;

  // Delta from current price
  const deltaFromCurrentPrice = scenarioPrice - currentPrice;
  const deltaFromCurrentPricePct = currentPrice > 0
    ? (deltaFromCurrentPrice / currentPrice) * 100
    : 0;

  // Distance to breakeven
  const distanceToBreakeven = scenarioPrice - breakeven;

  // Distance to TP1
  const distanceToTP1 = firstTP !== null ? scenarioPrice - firstTP : null;

  // Distance to SL
  const distanceToSL = currentSL !== null && currentSL > 0
    ? scenarioPrice - currentSL
    : null;

  // Risk to current SL (P/L if price goes to SL)
  let riskToCurrentSL: number | null = null;
  if (currentSL !== null && currentSL > 0) {
    const slDiff = isLong
      ? currentSL - avgEntry
      : avgEntry - currentSL;
    riskToCurrentSL = slDiff * dollarsPerPoint;
  }

  // Scenario status
  const scenarioStatus = getScenarioStatus(projectedPnl, balance, equity);

  // Suggested action
  const suggestedActionKey = getSuggestedAction(
    scenarioStatus, projectedPnl, projectedBalancePct,
    currentSL, input.unprotectedTradeCount,
  );

  return {
    scenarioPrice,
    projectedPnl,
    projectedBalancePct,
    projectedEquityPct,
    projectedR,
    additionalPnlFromCurrent,
    deltaFromCurrentPrice,
    deltaFromCurrentPricePct,
    distanceToBreakeven,
    distanceToTP1,
    distanceToSL,
    riskToCurrentSL,
    scenarioStatus,
    suggestedActionKey,
  };
}

function getScenarioStatus(
  projectedPnl: number,
  balance: number | null,
  equity: number | null,
): ScenarioStatus {
  const ref = balance || equity || 0;
  if (ref <= 0) {
    // No reference — use absolute P/L
    if (projectedPnl > 0) return "profit";
    if (projectedPnl > -100) return "near_breakeven";
    return "moderate_loss";
  }
  const pct = (projectedPnl / ref) * 100;
  if (pct > 5) return "deep_profit";
  if (pct > 0.5) return "profit";
  if (pct > -0.5) return "near_breakeven";
  if (pct > -2) return "small_loss";
  if (pct > -5) return "moderate_loss";
  if (pct > -10) return "significant_loss";
  return "severe_loss";
}

function getSuggestedAction(
  status: ScenarioStatus,
  projectedPnl: number,
  balancePct: number | null,
  currentSL: number | null,
  unprotectedCount: number,
): string {
  if (unprotectedCount > 0 && (status === "moderate_loss" || status === "significant_loss" || status === "severe_loss")) {
    return "scenario.action.defineProtection";
  }
  if (currentSL === null || currentSL <= 0) {
    return "scenario.action.setSL";
  }
  switch (status) {
    case "deep_profit": return "scenario.action.considerTakingProfit";
    case "profit": return "scenario.action.monitorPosition";
    case "near_breakeven": return "scenario.action.watchBreakeven";
    case "small_loss": return "scenario.action.holdPlan";
    case "moderate_loss": return "scenario.action.reviewRisk";
    case "significant_loss": return "scenario.action.nearDrawdownLimit";
    case "severe_loss": return "scenario.action.criticalDrawdown";
    default: return "scenario.action.monitorPosition";
  }
}

// ─── Pain Levels ───

/**
 * Compute the price at which the account would lose a given % from CURRENT equity.
 * Accounts for existing floating P/L.
 */
export function computePainLevels(
  input: Pick<ScenarioInput,
    "direction" | "dollarsPerPoint" | "currentPrice" | "balance" | "equity" | "currentFloatingPnl"
  >,
  percentages: number[] = [-1, -2, -5, -10, 1, 2, 5],
): PainLevel[] {
  const { direction, dollarsPerPoint, currentPrice, balance, currentFloatingPnl } = input;

  if (!balance || balance <= 0 || dollarsPerPoint <= 0 || currentPrice <= 0) {
    return [];
  }

  const isLong = direction === "LONG";
  const maxReasonable = currentPrice * 2.0;
  const minReasonable = currentPrice * 0.2;

  return percentages.map((pct) => {
    // Target P/L change from current: balance * (pct/100) = additionalPnl from current price
    const targetAdditionalPnl = balance * (pct / 100);
    // Additional PnL = (scenarioPrice - currentPrice) * dollarsPerPoint  (for LONG)
    const priceChange = targetAdditionalPnl / dollarsPerPoint;
    const price = isLong ? currentPrice + priceChange : currentPrice - priceChange;

    // Total PnL at this level
    const totalPnlAtLevel = currentFloatingPnl + targetAdditionalPnl;

    return {
      percent: pct,
      price,
      pnlAtLevel: totalPnlAtLevel,
      isRealistic: price > minReasonable && price < maxReasonable && price > 0,
    };
  });
}

// ─── Current Open Risk ───

/**
 * Compute aggregate open risk (loss if all SLs hit from current price).
 */
export function computeCurrentOpenRisk(input: ScenarioInput): CurrentOpenRisk {
  const { trades, balance, equity, direction, dollarsPerPoint, totalLots } = input;

  let knownRiskPnl = 0;
  let knownRiskR = 0;
  let unknownRiskTradeCount = 0;
  let unprotectedTradeCount = 0;
  let rHonest = true;

  const isLong = direction === "LONG";
  // Per-trade point value: dollarsPerPoint / totalLots
  const pointValue = totalLots > 0 ? dollarsPerPoint / totalLots : 0;

  for (const trade of trades) {
    if (trade.currentSL === null || trade.currentSL <= 0) {
      unprotectedTradeCount++;
      unknownRiskTradeCount++;
      continue;
    }

    // Loss from current price to SL
    const slDiff = isLong
      ? trade.currentSL - trade.openPrice // negative if SL below entry
      : trade.openPrice - trade.currentSL;
    const tradeLossAtSL = slDiff * trade.lots * pointValue;
    knownRiskPnl += tradeLossAtSL;

    if (trade.rComputable && trade.riskPerR && trade.riskPerR > 0) {
      knownRiskR += tradeLossAtSL / trade.riskPerR;
    } else {
      rHonest = false;
    }
  }

  return {
    knownRiskPnl,
    knownRiskBalancePct: balance && balance > 0 ? (knownRiskPnl / balance) * 100 : null,
    knownRiskEquityPct: equity && equity > 0 ? (knownRiskPnl / equity) * 100 : null,
    knownRiskR: rHonest ? knownRiskR : null,
    unknownRiskTradeCount,
    unprotectedTradeCount,
    isComplete: unknownRiskTradeCount === 0 && unprotectedTradeCount === 0,
  };
}

// ─── Define My Risk ───

/**
 * Compute suggested SL price to cap risk at a given % of balance.
 */
export function computeSuggestedSL(
  input: Pick<ScenarioInput,
    "direction" | "dollarsPerPoint" | "currentPrice" | "balance" | "rComputable" | "riskPerR"
  >,
  targetRiskPct: number, // e.g. 1 for 1%, 2 for 2%
): DefineMyRiskResult | null {
  const { direction, dollarsPerPoint, currentPrice, balance, rComputable, riskPerR } = input;

  if (!balance || balance <= 0 || dollarsPerPoint <= 0 || currentPrice <= 0) {
    return null;
  }

  const isLong = direction === "LONG";
  const maxLoss = balance * (targetRiskPct / 100);
  const priceMove = maxLoss / dollarsPerPoint;

  const suggestedSL = isLong
    ? currentPrice - priceMove
    : currentPrice + priceMove;

  if (suggestedSL <= 0) return null;

  // P/L at that SL (from entry, not from current)
  const projectedPnlAtSL = -maxLoss; // By definition: loss = targetRiskPct% of balance

  return {
    targetRiskPct,
    suggestedSLPrice: suggestedSL,
    projectedPnlAtSL,
    projectedBalancePctAtSL: -targetRiskPct,
    projectedRAtSL: rComputable && riskPerR && riskPerR > 0
      ? projectedPnlAtSL / riskPerR
      : null,
    isRealistic: suggestedSL > 0 && suggestedSL < currentPrice * 2,
  };
}

// ─── Snap Points ───

export interface SnapPoint {
  price: number;
  label: string;
  labelKey: string;
}

/**
 * Build snap points for the scenario ladder.
 */
export function buildSnapPoints(
  input: ScenarioInput,
  painLevels: PainLevel[],
): SnapPoint[] {
  const points: SnapPoint[] = [];

  // Current price
  points.push({ price: input.currentPrice, label: "Current", labelKey: "scenario.snap.current" });

  // Breakeven
  if (Math.abs(input.breakeven - input.currentPrice) > input.currentPrice * 0.001) {
    points.push({ price: input.breakeven, label: "Breakeven", labelKey: "scenario.snap.breakeven" });
  }

  // TP1
  if (input.firstTP !== null && input.firstTP > 0) {
    points.push({ price: input.firstTP, label: "TP1", labelKey: "scenario.snap.tp1" });
  }

  // Current SL
  if (input.currentSL !== null && input.currentSL > 0) {
    points.push({ price: input.currentSL, label: "SL", labelKey: "scenario.snap.sl" });
  }

  // Pain levels (only realistic)
  for (const pl of painLevels) {
    if (pl.isRealistic) {
      const sign = pl.percent > 0 ? "+" : "";
      points.push({
        price: pl.price,
        label: `${sign}${pl.percent}%`,
        labelKey: `scenario.snap.pain_${pl.percent}`,
      });
    }
  }

  return points;
}

// ─── Interpretation ───

/**
 * Generate a one-line interpretation of the scenario.
 */
export function getScenarioInterpretation(
  scenario: ScenarioOutput,
  unprotectedCount: number,
): string {
  const { projectedPnl, scenarioStatus, distanceToBreakeven } = scenario;

  if (unprotectedCount > 0 && projectedPnl < 0) {
    return "scenario.interpret.noSLDefineProtection";
  }

  switch (scenarioStatus) {
    case "severe_loss":
      return "scenario.interpret.severeLoss";
    case "significant_loss":
      return "scenario.interpret.significantLoss";
    case "moderate_loss":
      return "scenario.interpret.moderateLoss";
    case "small_loss":
      return "scenario.interpret.smallLoss";
    case "near_breakeven":
      return Math.abs(distanceToBreakeven) < 0.001
        ? "scenario.interpret.atBreakeven"
        : "scenario.interpret.nearBreakeven";
    case "profit":
      return "scenario.interpret.inProfit";
    case "deep_profit":
      return "scenario.interpret.deepProfit";
    default:
      return "scenario.interpret.monitorPosition";
  }
}
