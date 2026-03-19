// ────────────────────────────────────────────
// Open Trade Health — Pure Computation Helpers
// ────────────────────────────────────────────
// No DB access. No side effects. Unit-testable.

import {
  ENTRY_QUALITY_PRECISE,
  ENTRY_QUALITY_GOOD,
  ENTRY_QUALITY_LATE,
  SL_WIDENED_BROKEN_THRESHOLD,
  TP_CHANGED_DRIFTED_THRESHOLD,
  APPROACHING_SL_THRESHOLD,
  ATTENTION_QUEUE_MAX,
  ATTENTION_PER_MEMBER_MAX,
} from "./digest-constants";

// ─── Types ───

export type OverallHealth =
  | "HEALTHY"
  | "NEEDS_REVIEW"
  | "AT_RISK"
  | "BROKEN_PLAN"
  | "LOW_CONFIDENCE";

export type DataConfidence = "HIGH" | "PARTIAL" | "LOW";

export type EntryQuality =
  | "PRECISE"
  | "GOOD"
  | "LATE"
  | "CHASED"
  | "UNKNOWN";

export type ProtectionStatus =
  | "PROTECTED"
  | "BREAKEVEN_LOCKED"
  | "PARTIALLY_PROTECTED"
  | "UNPROTECTED"
  | "UNKNOWN_RISK";

export type SetupStatus =
  | "VALID"
  | "NEAR_INVALIDATION"
  | "INVALIDATED"
  | "UNKNOWN";

export type ManagementStatus =
  | "ON_PLAN"
  | "DRIFTED"
  | "BROKEN"
  | "UNKNOWN";

export type ProfitProtection =
  | "SECURED"
  | "OPEN_WINNER"
  | "FRAGILE_WINNER"
  | "N_A";

export type OpenTradeHealthReason =
  | "TRACKING_LOST"
  | "TRACKING_STALE"
  | "NO_VALID_SL"
  | "UNPROTECTED"
  | "NEAR_INVALIDATION"
  | "INVALIDATED"
  | "ENTRY_LATE"
  | "ENTRY_CHASED"
  | "SL_WIDENED"
  | "TP_CHANGED"
  | "WINNER_NOT_PROTECTED"
  | "R_NOT_COMPUTABLE";

export interface OpenTradeHealth {
  overall: OverallHealth;
  dataConfidence: DataConfidence;
  entryQuality: EntryQuality;
  protectionStatus: ProtectionStatus;
  setupStatus: SetupStatus;
  managementStatus: ManagementStatus;
  profitProtection: ProfitProtection;
  reasons: OpenTradeHealthReason[];
}

export type AttentionKind =
  | "UNPROTECTED_LOSER"
  | "INVALIDATED_OR_BROKEN"
  | "TRACKING_LOST_OPEN_RISK"
  | "NEAR_INVALIDATION"
  | "FRAGILE_WINNER"
  | "UNKNOWN_RISK"
  | "HIGH_EXPOSURE_MEMBER";

export type AttentionSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface AttentionItem {
  kind: AttentionKind;
  severity: AttentionSeverity;
  userId: string;
  username: string;
  tradeId?: string;
  instrument?: string;
  messageKey: string;
  messageParams: Record<string, string | number>;
}

export interface LiveHealthSummary {
  healthyPositions: number;
  needsReviewPositions: number;
  atRiskPositions: number;
  brokenPlanPositions: number;
  lowConfidencePositions: number;
  unknownRiskPositions: number;
  unprotectedPositions: number;
  fragileWinnerPositions: number;
}

/** Input data for a single open trade health computation */
export interface OpenTradeInput {
  tradeId: string;
  userId: string;
  username: string;
  instrument: string;
  direction: "LONG" | "SHORT";

  // Current live state from MT
  currentPrice: number | null;
  currentSL: number | null;
  currentTP: number | null;
  floatingPnl: number | null;
  floatingR: number | null;

  // Original card/initial values
  cardEntry: number;
  cardSL: number;
  cardTargets: number[];

  // Frozen official snapshot (null if not qualified)
  officialEntry: number | null;
  officialSL: number | null;
  officialTargets: number[];
  officialRiskAbs: number | null;
  officialRiskMoney: number | null;

  // MT actual values
  mtOpenPrice: number | null;

  // Tracking state
  trackingStatus: string; // "ACTIVE" | "STALE" | "TRACKING_LOST"
  priceAvailable: boolean;

  // Existing risk status from schema
  riskStatus: string; // "PROTECTED" | "BREAKEVEN" | "LOCKED_PROFIT" | "UNPROTECTED"
}

// ─── Core Computations ───

export function computeDataConfidence(input: OpenTradeInput): DataConfidence {
  if (
    input.trackingStatus === "TRACKING_LOST" ||
    (!input.priceAvailable && input.currentPrice === null)
  ) {
    return "LOW";
  }
  if (
    input.trackingStatus === "STALE" ||
    (!input.officialEntry && !input.officialSL)
  ) {
    return "PARTIAL";
  }
  // Need a valid risk baseline for HIGH
  const entry = input.officialEntry ?? input.cardEntry;
  const sl = input.officialSL ?? input.cardSL;
  if (!entry || !sl || entry === sl) return "PARTIAL";
  return "HIGH";
}

export function computeRComputability(input: OpenTradeInput): boolean {
  const entry = input.officialEntry ?? input.cardEntry;
  const sl = input.officialSL ?? input.cardSL;
  if (!entry || !sl || entry === sl) return false;
  if (input.officialRiskAbs && input.officialRiskAbs > 0) return true;
  return Math.abs(entry - sl) > 0;
}

export function computeEntryQuality(input: OpenTradeInput): EntryQuality {
  const actualEntry = input.mtOpenPrice;
  const plannedEntry = input.officialEntry ?? input.cardEntry;
  const plannedSL = input.officialSL ?? input.cardSL;

  if (!actualEntry || !plannedEntry || !plannedSL) return "UNKNOWN";

  const riskDistance = Math.abs(plannedEntry - plannedSL);
  if (riskDistance === 0) return "UNKNOWN";

  const deviation = Math.abs(actualEntry - plannedEntry) / riskDistance;

  if (deviation <= ENTRY_QUALITY_PRECISE) return "PRECISE";
  if (deviation <= ENTRY_QUALITY_GOOD) return "GOOD";
  if (deviation <= ENTRY_QUALITY_LATE) return "LATE";
  return "CHASED";
}

export function computeProtectionStatus(input: OpenTradeInput): ProtectionStatus {
  const originalSL = input.officialSL ?? input.cardSL;
  const entry = input.officialEntry ?? input.mtOpenPrice ?? input.cardEntry;

  // No valid original baseline → unknown
  if (!originalSL || originalSL === 0) return "UNKNOWN_RISK";

  const currentSL = input.currentSL;

  // SL removed or set to 0
  if (!currentSL || currentSL === 0) return "UNPROTECTED";

  // Check if SL is at breakeven or better
  if (!entry) return "PROTECTED";

  const isLong = input.direction === "LONG";
  const slAtOrBeyondEntry = isLong
    ? currentSL >= entry
    : currentSL <= entry;

  if (slAtOrBeyondEntry) return "BREAKEVEN_LOCKED";

  // Check if SL improved meaningfully vs original (>10% of risk distance tightened)
  const originalRisk = Math.abs(entry - originalSL);
  if (originalRisk === 0) return "PROTECTED";

  const currentRisk = Math.abs(entry - currentSL);
  const improvement = (originalRisk - currentRisk) / originalRisk;

  if (improvement > SL_WIDENED_BROKEN_THRESHOLD) return "PARTIALLY_PROTECTED";

  return "PROTECTED";
}

export function computeSetupStatus(input: OpenTradeInput): SetupStatus {
  const currentPrice = input.currentPrice;
  const sl = input.currentSL ?? input.officialSL ?? input.cardSL;
  const entry = input.officialEntry ?? input.mtOpenPrice ?? input.cardEntry;

  if (!currentPrice || !sl || sl === 0 || input.trackingStatus === "TRACKING_LOST") {
    return "UNKNOWN";
  }

  const isLong = input.direction === "LONG";

  // Check invalidation: price crossed SL
  const invalidated = isLong ? currentPrice <= sl : currentPrice >= sl;
  if (invalidated) return "INVALIDATED";

  // Check near invalidation
  if (!entry) return "VALID";

  const riskDistance = Math.abs(entry - sl);
  if (riskDistance === 0) return "VALID";

  const distanceToSL = isLong ? currentPrice - sl : sl - currentPrice;
  const ratio = distanceToSL / riskDistance;

  if (ratio < APPROACHING_SL_THRESHOLD) return "NEAR_INVALIDATION";

  return "VALID";
}

export function computeManagementStatus(input: OpenTradeInput): ManagementStatus {
  const officialSL = input.officialSL;
  const officialEntry = input.officialEntry;

  // No frozen snapshot → cannot assess management drift
  if (!officialSL || !officialEntry) return "UNKNOWN";

  const currentSL = input.currentSL;
  const originalRiskDistance = Math.abs(officialEntry - officialSL);

  if (originalRiskDistance === 0) return "UNKNOWN";

  // Check SL breakage: SL removed or widened materially
  if (!currentSL || currentSL === 0) {
    // SL removed after originally existing → BROKEN
    return "BROKEN";
  }

  const isLong = input.direction === "LONG";

  // Check SL widening (worse direction)
  const slWidened = isLong
    ? currentSL < officialSL // SL moved further down for longs
    : currentSL > officialSL; // SL moved further up for shorts

  if (slWidened) {
    const widening = isLong
      ? officialSL - currentSL
      : currentSL - officialSL;
    const wideningRatio = widening / originalRiskDistance;
    if (wideningRatio > SL_WIDENED_BROKEN_THRESHOLD) return "BROKEN";
  }

  // Check TP drift
  const officialTP = input.officialTargets[0];
  const currentTP = input.currentTP;
  if (officialTP && officialTP > 0 && currentTP && currentTP > 0) {
    const targetDistance = Math.abs(officialEntry - officialTP);
    if (targetDistance > 0) {
      const tpDrift = Math.abs(currentTP - officialTP) / targetDistance;
      if (tpDrift > TP_CHANGED_DRIFTED_THRESHOLD) return "DRIFTED";
    }
  }

  return "ON_PLAN";
}

export function computeProfitProtection(
  input: OpenTradeInput,
  rComputable: boolean,
  protectionStatus: ProtectionStatus
): ProfitProtection {
  const floatingR = input.floatingR;

  // Not in profit or R not computable → N/A
  if (!rComputable || floatingR === null || floatingR <= 0) return "N_A";

  if (
    protectionStatus === "BREAKEVEN_LOCKED" ||
    protectionStatus === "PARTIALLY_PROTECTED"
  ) {
    return "SECURED";
  }

  if (
    protectionStatus === "UNPROTECTED" ||
    protectionStatus === "UNKNOWN_RISK"
  ) {
    return "FRAGILE_WINNER";
  }

  return "OPEN_WINNER";
}

export function resolveOverallHealth(
  confidence: DataConfidence,
  protection: ProtectionStatus,
  setup: SetupStatus,
  management: ManagementStatus,
  entryQuality: EntryQuality,
  profitProtection: ProfitProtection
): OverallHealth {
  // Precedence 1: LOW_CONFIDENCE
  if (confidence === "LOW") return "LOW_CONFIDENCE";

  // Precedence 2: BROKEN_PLAN
  if (setup === "INVALIDATED" || management === "BROKEN") return "BROKEN_PLAN";

  // Precedence 3: AT_RISK
  if (
    protection === "UNPROTECTED" ||
    protection === "UNKNOWN_RISK" ||
    setup === "NEAR_INVALIDATION" ||
    profitProtection === "FRAGILE_WINNER"
  ) {
    return "AT_RISK";
  }

  // Precedence 4: NEEDS_REVIEW
  if (
    entryQuality === "LATE" ||
    entryQuality === "CHASED" ||
    management === "DRIFTED" ||
    confidence === "PARTIAL"
  ) {
    return "NEEDS_REVIEW";
  }

  return "HEALTHY";
}

/**
 * Compute full health for a single open trade.
 */
export function computeOpenTradeHealth(input: OpenTradeInput): OpenTradeHealth {
  const dataConfidence = computeDataConfidence(input);
  const rComputable = computeRComputability(input);
  const entryQuality = computeEntryQuality(input);
  const protectionStatus = computeProtectionStatus(input);
  const setupStatus = computeSetupStatus(input);
  const managementStatus = computeManagementStatus(input);
  const profitProtection = computeProfitProtection(input, rComputable, protectionStatus);

  const overall = resolveOverallHealth(
    dataConfidence,
    protectionStatus,
    setupStatus,
    managementStatus,
    entryQuality,
    profitProtection
  );

  // Collect reasons
  const reasons: OpenTradeHealthReason[] = [];
  if (input.trackingStatus === "TRACKING_LOST") reasons.push("TRACKING_LOST");
  if (input.trackingStatus === "STALE") reasons.push("TRACKING_STALE");
  if (!rComputable) reasons.push("R_NOT_COMPUTABLE");
  if (protectionStatus === "UNPROTECTED") reasons.push("UNPROTECTED");
  if (protectionStatus === "UNKNOWN_RISK") reasons.push("NO_VALID_SL");
  if (setupStatus === "NEAR_INVALIDATION") reasons.push("NEAR_INVALIDATION");
  if (setupStatus === "INVALIDATED") reasons.push("INVALIDATED");
  if (entryQuality === "LATE") reasons.push("ENTRY_LATE");
  if (entryQuality === "CHASED") reasons.push("ENTRY_CHASED");
  if (managementStatus === "BROKEN") reasons.push("SL_WIDENED");
  if (managementStatus === "DRIFTED") reasons.push("TP_CHANGED");
  if (profitProtection === "FRAGILE_WINNER") reasons.push("WINNER_NOT_PROTECTED");

  return {
    overall,
    dataConfidence,
    entryQuality,
    protectionStatus,
    setupStatus,
    managementStatus,
    profitProtection,
    reasons,
  };
}

// ─── Attention Queue ───

const ATTENTION_PRIORITY: AttentionKind[] = [
  "UNPROTECTED_LOSER",
  "INVALIDATED_OR_BROKEN",
  "TRACKING_LOST_OPEN_RISK",
  "NEAR_INVALIDATION",
  "FRAGILE_WINNER",
  "UNKNOWN_RISK",
  "HIGH_EXPOSURE_MEMBER",
];

const ATTENTION_SEVERITY: Record<AttentionKind, AttentionSeverity> = {
  UNPROTECTED_LOSER: "CRITICAL",
  INVALIDATED_OR_BROKEN: "CRITICAL",
  TRACKING_LOST_OPEN_RISK: "CRITICAL",
  NEAR_INVALIDATION: "WARNING",
  FRAGILE_WINNER: "WARNING",
  UNKNOWN_RISK: "WARNING",
  HIGH_EXPOSURE_MEMBER: "INFO",
};

const ATTENTION_MESSAGE_KEYS: Record<AttentionKind, string> = {
  UNPROTECTED_LOSER: "digest.attention.unprotected_loser",
  INVALIDATED_OR_BROKEN: "digest.attention.invalidated_or_broken",
  TRACKING_LOST_OPEN_RISK: "digest.attention.tracking_lost_open_risk",
  NEAR_INVALIDATION: "digest.attention.near_invalidation",
  FRAGILE_WINNER: "digest.attention.fragile_winner",
  UNKNOWN_RISK: "digest.attention.unknown_risk",
  HIGH_EXPOSURE_MEMBER: "digest.attention.high_exposure_member",
};

interface TradeWithHealth {
  tradeId: string;
  userId: string;
  username: string;
  instrument: string;
  health: OpenTradeHealth;
  floatingR: number | null;
  trackingStatus: string;
  rComputable: boolean;
}

/**
 * Build the attention queue from open trades with computed health.
 * Max ATTENTION_QUEUE_MAX items, max ATTENTION_PER_MEMBER_MAX per member.
 * Dedupes same trade (keeps highest-priority reason).
 * Does NOT emit price-sensitive items for TRACKING_LOST trades.
 */
export function buildAttentionQueue(trades: TradeWithHealth[]): AttentionItem[] {
  const candidates: AttentionItem[] = [];
  const seenTrades = new Set<string>();

  for (const kind of ATTENTION_PRIORITY) {
    for (const t of trades) {
      if (seenTrades.has(t.tradeId)) continue;

      const item = matchAttentionKind(kind, t);
      if (item) {
        candidates.push(item);
        seenTrades.add(t.tradeId);
      }
    }
  }

  // Group tracking-lost items by member (collapse "X lost tracking on EURUSD" + "X lost tracking on GBPUSD" → "X — tracking lost on 2 trades")
  const trackingLostByMember = new Map<string, AttentionItem[]>();
  const nonTrackingLost: AttentionItem[] = [];
  for (const item of candidates) {
    if (item.kind === "TRACKING_LOST_OPEN_RISK") {
      const arr = trackingLostByMember.get(item.userId) ?? [];
      arr.push(item);
      trackingLostByMember.set(item.userId, arr);
    } else {
      nonTrackingLost.push(item);
    }
  }

  const grouped: AttentionItem[] = [...nonTrackingLost];
  for (const [userId, items] of trackingLostByMember) {
    if (items.length <= 1) {
      grouped.push(items[0]);
    } else {
      // Merge into one grouped item
      grouped.push({
        kind: "TRACKING_LOST_OPEN_RISK",
        severity: "CRITICAL",
        userId,
        username: items[0].username,
        tradeId: items[0].tradeId,
        instrument: "",
        messageKey: "digest.cockpit.trackingLostGroup",
        messageParams: { username: items[0].username, count: items.length },
      });
    }
  }

  // Sort: CRITICAL first, then WARNING, then INFO
  const sevOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
  grouped.sort((a, b) => (sevOrder[a.severity] ?? 2) - (sevOrder[b.severity] ?? 2));

  // Enforce per-member cap + total cap
  const memberCount = new Map<string, number>();
  const result: AttentionItem[] = [];
  for (const item of grouped) {
    const count = memberCount.get(item.userId) ?? 0;
    if (count >= ATTENTION_PER_MEMBER_MAX) continue;
    memberCount.set(item.userId, count + 1);
    result.push(item);
    if (result.length >= ATTENTION_QUEUE_MAX) break;
  }

  return result;
}

function matchAttentionKind(
  kind: AttentionKind,
  t: TradeWithHealth
): AttentionItem | null {
  const isTrackingLost = t.trackingStatus === "TRACKING_LOST";

  switch (kind) {
    case "UNPROTECTED_LOSER":
      // Do not emit price-sensitive for tracking lost
      if (isTrackingLost) return null;
      if (
        t.health.protectionStatus === "UNPROTECTED" &&
        t.floatingR !== null &&
        t.floatingR < 0
      ) {
        return makeItem(kind, t);
      }
      return null;

    case "INVALIDATED_OR_BROKEN":
      if (isTrackingLost) return null;
      if (
        t.health.setupStatus === "INVALIDATED" ||
        t.health.managementStatus === "BROKEN"
      ) {
        return makeItem(kind, t);
      }
      return null;

    case "TRACKING_LOST_OPEN_RISK":
      if (isTrackingLost) {
        return makeItem(kind, t);
      }
      return null;

    case "NEAR_INVALIDATION":
      if (isTrackingLost) return null;
      if (t.health.setupStatus === "NEAR_INVALIDATION") {
        return makeItem(kind, t);
      }
      return null;

    case "FRAGILE_WINNER":
      if (isTrackingLost) return null;
      if (t.health.profitProtection === "FRAGILE_WINNER") {
        return makeItem(kind, t);
      }
      return null;

    case "UNKNOWN_RISK":
      if (!t.rComputable || t.health.protectionStatus === "UNKNOWN_RISK") {
        return makeItem(kind, t);
      }
      return null;

    default:
      return null;
  }
}

function makeItem(kind: AttentionKind, t: TradeWithHealth): AttentionItem {
  return {
    kind,
    severity: ATTENTION_SEVERITY[kind],
    userId: t.userId,
    username: t.username,
    tradeId: t.tradeId,
    instrument: t.instrument,
    messageKey: ATTENTION_MESSAGE_KEYS[kind],
    messageParams: {
      username: t.username,
      instrument: t.instrument,
      ...(t.floatingR !== null ? { floatingR: Math.round(t.floatingR * 100) / 100 } : {}),
    },
  };
}

// ─── Health Summary ───

export function buildLiveHealthSummary(
  healths: Array<{ health: OpenTradeHealth; rComputable: boolean }>
): LiveHealthSummary {
  const summary: LiveHealthSummary = {
    healthyPositions: 0,
    needsReviewPositions: 0,
    atRiskPositions: 0,
    brokenPlanPositions: 0,
    lowConfidencePositions: 0,
    unknownRiskPositions: 0,
    unprotectedPositions: 0,
    fragileWinnerPositions: 0,
  };

  for (const { health, rComputable } of healths) {
    switch (health.overall) {
      case "HEALTHY": summary.healthyPositions++; break;
      case "NEEDS_REVIEW": summary.needsReviewPositions++; break;
      case "AT_RISK": summary.atRiskPositions++; break;
      case "BROKEN_PLAN": summary.brokenPlanPositions++; break;
      case "LOW_CONFIDENCE": summary.lowConfidencePositions++; break;
    }
    if (!rComputable || health.protectionStatus === "UNKNOWN_RISK") {
      summary.unknownRiskPositions++;
    }
    if (health.protectionStatus === "UNPROTECTED") {
      summary.unprotectedPositions++;
    }
    if (health.profitProtection === "FRAGILE_WINNER") {
      summary.fragileWinnerPositions++;
    }
  }

  return summary;
}
