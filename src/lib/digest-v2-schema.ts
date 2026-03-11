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
});

export type DigestV2Response = z.infer<typeof digestV2ResponseSchema>;
export type MemberStatsV2 = z.infer<typeof memberStatsV2Schema>;
export type OpenPositionV2 = z.infer<typeof openPositionV2Schema>;
export type ClosedTradeV2 = z.infer<typeof closedTradeV2Schema>;
export type TrackingSummary = z.infer<typeof trackingSummarySchema>;
export type CockpitSummary = z.infer<typeof cockpitSummarySchema>;
