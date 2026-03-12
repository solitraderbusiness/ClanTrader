// ────────────────────────────────────────────
// Activity Digest v2 — Zod Response Schema
// ────────────────────────────────────────────

import { z } from "zod";

// ─── Open Trade Health Enums ───

export const overallHealthSchema = z.enum([
  "HEALTHY", "NEEDS_REVIEW", "AT_RISK", "BROKEN_PLAN", "LOW_CONFIDENCE",
]);

export const dataConfidenceSchema = z.enum(["HIGH", "PARTIAL", "LOW"]);

export const entryQualitySchema = z.enum([
  "PRECISE", "GOOD", "LATE", "CHASED", "UNKNOWN",
]);

export const protectionStatusSchema = z.enum([
  "PROTECTED", "BREAKEVEN_LOCKED", "PARTIALLY_PROTECTED", "UNPROTECTED", "UNKNOWN_RISK",
]);

export const setupStatusSchema = z.enum([
  "VALID", "NEAR_INVALIDATION", "INVALIDATED", "UNKNOWN",
]);

export const managementStatusSchema = z.enum([
  "ON_PLAN", "DRIFTED", "BROKEN", "UNKNOWN",
]);

export const profitProtectionSchema = z.enum([
  "SECURED", "OPEN_WINNER", "FRAGILE_WINNER", "N_A",
]);

export const healthReasonSchema = z.enum([
  "TRACKING_LOST", "TRACKING_STALE", "NO_VALID_SL", "UNPROTECTED",
  "NEAR_INVALIDATION", "INVALIDATED", "ENTRY_LATE", "ENTRY_CHASED",
  "SL_WIDENED", "TP_CHANGED", "WINNER_NOT_PROTECTED", "R_NOT_COMPUTABLE",
]);

export const openTradeHealthSchema = z.object({
  overall: overallHealthSchema,
  dataConfidence: dataConfidenceSchema,
  entryQuality: entryQualitySchema,
  protectionStatus: protectionStatusSchema,
  setupStatus: setupStatusSchema,
  managementStatus: managementStatusSchema,
  profitProtection: profitProtectionSchema,
  reasons: z.array(healthReasonSchema),
});

// ─── Attention Queue ───

export const attentionKindSchema = z.enum([
  "UNPROTECTED_LOSER", "INVALIDATED_OR_BROKEN", "TRACKING_LOST_OPEN_RISK",
  "NEAR_INVALIDATION", "FRAGILE_WINNER", "UNKNOWN_RISK", "HIGH_EXPOSURE_MEMBER",
]);

export const attentionItemSchema = z.object({
  kind: attentionKindSchema,
  severity: z.enum(["CRITICAL", "WARNING", "INFO"]),
  userId: z.string(),
  username: z.string(),
  tradeId: z.string().optional(),
  instrument: z.string().optional(),
  messageKey: z.string(),
  messageParams: z.record(z.string(), z.union([z.string(), z.number()])),
});

// ─── Live Health Summary ───

export const liveHealthSummarySchema = z.object({
  healthyPositions: z.number(),
  needsReviewPositions: z.number(),
  atRiskPositions: z.number(),
  brokenPlanPositions: z.number(),
  lowConfidencePositions: z.number(),
  unknownRiskPositions: z.number(),
  unprotectedPositions: z.number(),
  fragileWinnerPositions: z.number(),
});

// ─── Tracking Summary ───

export const trackingSummarySchema = z.object({
  activeAccounts: z.number(),
  staleAccounts: z.number(),
  lostAccounts: z.number(),
});

// ─── State Assessment ───

export const stateMetricsSchema = z.object({
  openTradeCount: z.number(),
  needActionCount: z.number(),
  unknownRiskCount: z.number(),
  unprotectedCount: z.number(),
  trackingLostTradeCount: z.number(),
  staleTradeCount: z.number(),
  activeAccountCount: z.number(),
  totalAccountCount: z.number(),
  knownRiskTradeCount: z.number(),
  trustedTrackedTradeCount: z.number(),
});

export const stateAssessmentSchema = z.object({
  safetyScore: z.number(),
  safetyBand: z.enum(["SAFE", "WATCH", "AT_RISK", "CRITICAL"]),
  confidenceScore: z.number(),
  confidenceBand: z.enum(["HIGH", "MODERATE", "LOW", "DEGRADED"]),
  metrics: stateMetricsSchema,
});

// ─── Alert types ───

const alertTypeEnum = z.enum([
  "tracking_lost_with_exposure",
  "stale_with_exposure",
  "unprotected_trade",
  "unknown_risk_trade",
  "account_inactive_with_open_positions",
  "confidence_degraded",
  "missing_stop_loss_cluster",
  "high_open_trade_cluster",
  "concentration_risk",
]);

// ─── Concentration Clusters (Phase 2) ───

export const concentrationClusterSchema = z.object({
  instrument: z.string(),
  direction: z.string(),
  tradeCount: z.number(),
  memberCount: z.number(),
  members: z.array(z.string()),
  totalFloatingR: z.number().nullable(),
  totalRiskToSLR: z.number().nullable(),
});

// ─── Risk Budget (Phase 2+3) ───

export const riskBudgetSchema = z.object({
  totalOpenRiskR: z.number(),
  totalEquity: z.number().nullable(),
  riskPctOfEquity: z.number().nullable(),
  riskBudgetBand: z.enum(["LOW", "MODERATE", "HIGH", "CRITICAL"]),
});

// ─── Entry Quality Insight (Phase 5) ───

export const entryClusterInsightSchema = z.object({
  instrument: z.string(),
  direction: z.string(),
  tradeCount: z.number(),
  weightedAvgEntry: z.number().nullable(),
  entrySpread: z.number().nullable(),
  entrySpreadPct: z.number().nullable(),
  qualityLabel: z.enum(["tight", "spread", "wide", "unknown"]),
  accounts: z.array(z.string()),
});

// ─── Scaling Insight (Phase 5) ───

export const scalingInsightSchema = z.object({
  instrument: z.string(),
  direction: z.string(),
  legCount: z.number(),
  totalLots: z.number(),
  avgLots: z.number(),
  largestLegLots: z.number(),
  largestLegShare: z.number(),
  lastLegVsAvg: z.number(),
  pattern: z.enum(["balanced", "increasing", "decreasing", "spike", "unknown"]),
});

// ─── Concentration Summary (Phase 5) ───

export const concentrationSummarySchema = z.object({
  topSymbolShare: z.number(),
  topSymbol: z.string().nullable(),
  longShare: z.number(),
  shortShare: z.number(),
  singleDirectionExposure: z.boolean(),
  singleSymbolExposure: z.boolean(),
  accountCount: z.number(),
  riskLevel: z.enum(["low", "moderate", "high", "critical"]),
});

// ─── Equity Curve Data Point (Phase 8) ───

export const equityDataPointSchema = z.object({
  timestamp: z.string(),
  balance: z.number(),
  equity: z.number(),
});

// ─── Predictive Hints (Phase 3) ───

export const predictiveHintSchema = z.object({
  metric: z.string(),
  hintKey: z.string(),
  severity: z.enum(["warning", "info"]),
});

// ─── Alerts ───

export const digestAlertSchema = z.object({
  id: z.string(),
  type: alertTypeEnum,
  affectedMember: z.string().nullable(),
  affectedMemberId: z.string().nullable(),
  issueCount: z.number(),
  severityScore: z.number(),
  severityBand: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
});

// ─── Actions ───

export const actionItemSchema = z.object({
  alertId: z.string(),
  alertType: alertTypeEnum,
  priority: z.number(),
  affectedMember: z.string().nullable(),
  issueCount: z.number(),
});

// ─── Deltas ───

export const digestDeltaSchema = z.object({
  metric: z.string(),
  current: z.number(),
  previous: z.number(),
  delta: z.number(),
  direction: z.enum(["good", "bad", "neutral"]),
});

// ─── Cockpit Summary ───

export const cockpitSummarySchema = z.object({
  // RIGHT NOW — live open trade metrics
  totalFloatingPnl: z.number().nullable(),
  totalFloatingR: z.number().nullable(),
  computableRCount: z.number(),
  nonComputableRCount: z.number(),
  currentOpenRiskR: z.number().nullable(),
  unknownRiskCount: z.number(),
  tradesNeedingAction: z.number(),
  liveConfidence: z.enum(["HIGH", "PARTIAL", "LOW"]),

  // PERIOD — realized metrics from closed trades
  realizedPnl: z.number().nullable(),
  realizedR: z.number().nullable(),
  closedCount: z.number(),
  officialWinRate: z.number().nullable(),
  officialCount: z.number(),
  unofficialCount: z.number(),
});

// ─── Extended Open Position ───

export const openPositionV2Schema = z.object({
  tradeId: z.string(),
  instrument: z.string(),
  direction: z.string(),
  floatingR: z.number().nullable(),
  floatingPnl: z.number().nullable(),
  rComputable: z.boolean(),
  riskToSLR: z.number().nullable(),
  health: openTradeHealthSchema,
  trackingStatus: z.string(),
  cardType: z.string(),
  createdAt: z.string(),
  // Phase 5: Live intelligence fields
  openPrice: z.number().nullable().optional(),
  lots: z.number().nullable().optional(),
  accountLabel: z.string().optional(),
  // Phase 7: Price Ladder fields
  currentPrice: z.number().nullable().optional(),
  currentSL: z.number().nullable().optional(),
  currentTP: z.number().nullable().optional(),
});

// ─── Closed Trade ───

export const closedTradeV2Schema = z.object({
  tradeId: z.string(),
  instrument: z.string(),
  direction: z.string(),
  status: z.string(),
  r: z.number().nullable(),
  cardType: z.string(),
  isOfficial: z.boolean(),
  createdAt: z.string(),
  closedAt: z.string().nullable(),
});

// ─── Member Stats v2 ───

export const memberStatsV2Schema = z.object({
  userId: z.string(),
  name: z.string(),
  avatar: z.string().nullable(),
  signalCount: z.number(),
  analysisCount: z.number(),
  tpHit: z.number(),
  slHit: z.number(),
  be: z.number(),
  openCount: z.number(),
  winRate: z.number(),
  totalR: z.number(),
  avgR: z.number(),
  // Member cockpit aggregates
  memberFloatingPnl: z.number().nullable(),
  memberFloatingR: z.number().nullable(),
  memberRiskToSLR: z.number().nullable(),
  memberActionsNeeded: z.number(),
  memberUnknownRiskCount: z.number(),
  memberTrackingLostCount: z.number(),
  memberStaleCount: z.number(),
  memberUnprotectedCount: z.number(),
  memberImpactScore: z.number(),
  memberImpactLabel: z.string().nullable(),
  memberTrend: z.enum(["improving", "declining", "stable", "new"]),
  closedTrades: z.array(closedTradeV2Schema),
  openPositions: z.array(openPositionV2Schema),
});

// ─── Full v2 Response ───

export const digestV2ResponseSchema = z.object({
  version: z.literal(2),
  period: z.enum(["today", "week", "month"]),
  generatedAt: z.string(),
  summary: z.object({
    totalCards: z.number(),
    totalSignals: z.number(),
    totalAnalysis: z.number(),
    tpHit: z.number(),
    slHit: z.number(),
    be: z.number(),
    openCount: z.number(),
    winRate: z.number(),
    totalR: z.number(),
    avgR: z.number(),
    activeMemberCount: z.number(),
  }),
  cockpit: cockpitSummarySchema,
  trackingSummary: trackingSummarySchema,
  members: z.array(memberStatsV2Schema),
  liveHealthSummary: liveHealthSummarySchema,
  attentionQueue: z.array(attentionItemSchema),
  stateAssessment: stateAssessmentSchema,
  alerts: z.array(digestAlertSchema),
  actions: z.array(actionItemSchema),
  deltas: z.array(digestDeltaSchema).nullable(),
  concentration: z.array(concentrationClusterSchema),
  riskBudget: riskBudgetSchema.nullable(),
  hints: z.array(predictiveHintSchema),
  // Phase 5: Live intelligence insights (optional for backward compat)
  entryInsights: z.array(entryClusterInsightSchema).optional(),
  scalingInsights: z.array(scalingInsightSchema).optional(),
  concentrationSummary: concentrationSummarySchema.nullable().optional(),
  // Phase 8: Equity curve data
  equityCurve: z.array(equityDataPointSchema).optional(),
  // Scope-aware fields (added by route, optional for service)
  currentUserId: z.string().optional(),
  traderDeltas: z.array(digestDeltaSchema).nullable().optional(),
  traderHints: z.array(predictiveHintSchema).optional(),
});

export type DigestV2Response = z.infer<typeof digestV2ResponseSchema>;
export type MemberStatsV2 = z.infer<typeof memberStatsV2Schema>;
export type OpenPositionV2 = z.infer<typeof openPositionV2Schema>;
export type ClosedTradeV2 = z.infer<typeof closedTradeV2Schema>;
export type TrackingSummary = z.infer<typeof trackingSummarySchema>;
export type CockpitSummary = z.infer<typeof cockpitSummarySchema>;
