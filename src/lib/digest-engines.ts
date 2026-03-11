// ────────────────────────────────────────────
// Activity Digest — Decision Engines
// ────────────────────────────────────────────
// Pure computation. No DB, no Redis, no side effects.
// 5 engines: State, Delta, Alerts, Actions, Impact.

// ─── Types ───

export type SafetyBand = "SAFE" | "WATCH" | "AT_RISK" | "CRITICAL";
export type ConfidenceBand = "HIGH" | "MODERATE" | "LOW" | "DEGRADED";
export type SeverityBand = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type DeltaDirection = "good" | "bad" | "neutral";

export type AlertType =
  | "tracking_lost_with_exposure"
  | "stale_with_exposure"
  | "unprotected_trade"
  | "unknown_risk_trade"
  | "account_inactive_with_open_positions"
  | "confidence_degraded"
  | "missing_stop_loss_cluster"
  | "high_open_trade_cluster";

export interface StateMetrics {
  openTradeCount: number;
  needActionCount: number;
  unknownRiskCount: number;
  unprotectedCount: number;
  trackingLostTradeCount: number;
  staleTradeCount: number;
  activeAccountCount: number;
  totalAccountCount: number;
  knownRiskTradeCount: number;
  trustedTrackedTradeCount: number;
}

export interface StateAssessment {
  safetyScore: number;
  safetyBand: SafetyBand;
  confidenceScore: number;
  confidenceBand: ConfidenceBand;
  metrics: StateMetrics;
}

export interface DigestAlert {
  id: string;
  type: AlertType;
  affectedMember: string | null;
  affectedMemberId: string | null;
  issueCount: number;
  severityScore: number;
  severityBand: SeverityBand;
}

export interface ActionItem {
  alertId: string;
  alertType: AlertType;
  priority: number;
  affectedMember: string | null;
  issueCount: number;
}

export interface DigestSnapshot {
  openPnl: number | null;
  realizedPnl: number | null;
  realizedR: number | null;
  needActionCount: number;
  unknownRiskCount: number;
  unprotectedCount: number;
  trackingLostTradeCount: number;
  staleTradeCount: number;
  activeAccountCount: number;
  closedCount: number;
  openTradeCount: number;
  confidenceScore: number;
  safetyScore: number;
  ts: number;
}

export interface DigestDelta {
  metric: string;
  current: number;
  previous: number;
  delta: number;
  direction: DeltaDirection;
}

export interface AlertMemberInput {
  userId: string;
  name: string;
  openTradeCount: number;
  needActionCount: number;
  unknownRiskCount: number;
  unprotectedCount: number;
  trackingLostCount: number;
  staleCount: number;
}

// ─── Internal Constants ───

const ALERT_BASE_SEVERITY: Record<AlertType, number> = {
  tracking_lost_with_exposure: 85,
  account_inactive_with_open_positions: 80,
  missing_stop_loss_cluster: 72,
  stale_with_exposure: 70,
  unprotected_trade: 68,
  unknown_risk_trade: 60,
  confidence_degraded: 50,
  high_open_trade_cluster: 45,
};

const GOOD_WHEN_UP = new Set([
  "openPnl", "realizedPnl", "realizedR", "activeAccountCount",
  "confidenceScore", "safetyScore",
]);

const GOOD_WHEN_DOWN = new Set([
  "needActionCount", "unknownRiskCount", "unprotectedCount",
  "trackingLostTradeCount", "staleTradeCount",
]);

const HIGH_TRADE_CLUSTER_THRESHOLD = 5;
const ACTION_MAX = 3;

// ═══════════════════════════════════════════
// ENGINE 1: STATE ASSESSMENT
// ═══════════════════════════════════════════

export function computeStateAssessment(input: {
  openHealthResults: Array<{
    health: { overall: string; protectionStatus: string };
    rComputable: boolean;
    trackingStatus: string;
  }>;
  trackingSummary: { activeAccounts: number; staleAccounts: number; lostAccounts: number };
}): StateAssessment {
  const m = computeStateMetrics(input);

  if (m.openTradeCount === 0) {
    return {
      safetyScore: 100, safetyBand: "SAFE",
      confidenceScore: 100, confidenceBand: "HIGH",
      metrics: m,
    };
  }

  const open = Math.max(m.openTradeCount, 1);
  const totalAcct = Math.max(m.totalAccountCount, 1);

  const trackingCoverage = m.trustedTrackedTradeCount / open;
  const knownRiskCoverage = m.knownRiskTradeCount / open;
  const activeAccountCoverage = m.activeAccountCount / totalAcct;
  const protectionCoverage = (m.openTradeCount - m.unprotectedCount) / open;

  const confidenceScore = Math.round(
    100 * (0.40 * trackingCoverage + 0.35 * knownRiskCoverage + 0.25 * activeAccountCoverage)
  );

  const safeUnknown = 1 - (m.unknownRiskCount / open);
  const safeTracking = 1 - ((m.trackingLostTradeCount + m.staleTradeCount) / open);
  const safetyScore = Math.round(
    100 * (0.45 * protectionCoverage + 0.30 * safeUnknown + 0.25 * safeTracking)
  );

  return {
    safetyScore,
    safetyBand: safetyScore >= 80 ? "SAFE" : safetyScore >= 60 ? "WATCH" : safetyScore >= 40 ? "AT_RISK" : "CRITICAL",
    confidenceScore,
    confidenceBand: confidenceScore >= 85 ? "HIGH" : confidenceScore >= 65 ? "MODERATE" : confidenceScore >= 40 ? "LOW" : "DEGRADED",
    metrics: m,
  };
}

export function computeStateMetrics(input: {
  openHealthResults: Array<{
    health: { overall: string; protectionStatus: string };
    rComputable: boolean;
    trackingStatus: string;
  }>;
  trackingSummary: { activeAccounts: number; staleAccounts: number; lostAccounts: number };
}): StateMetrics {
  let needActionCount = 0, unknownRiskCount = 0, unprotectedCount = 0;
  let trackingLostTradeCount = 0, staleTradeCount = 0;
  let knownRiskTradeCount = 0, trustedTrackedTradeCount = 0;

  for (const r of input.openHealthResults) {
    if (r.health.overall === "AT_RISK" || r.health.overall === "BROKEN_PLAN") needActionCount++;
    if (!r.rComputable || r.health.protectionStatus === "UNKNOWN_RISK") unknownRiskCount++;
    else knownRiskTradeCount++;
    if (r.health.protectionStatus === "UNPROTECTED") unprotectedCount++;
    if (r.trackingStatus === "TRACKING_LOST") trackingLostTradeCount++;
    else if (r.trackingStatus === "STALE") staleTradeCount++;
    if (r.trackingStatus === "ACTIVE" && r.rComputable) trustedTrackedTradeCount++;
  }

  const ts = input.trackingSummary;
  return {
    openTradeCount: input.openHealthResults.length,
    needActionCount, unknownRiskCount, unprotectedCount,
    trackingLostTradeCount, staleTradeCount,
    activeAccountCount: ts.activeAccounts,
    totalAccountCount: ts.activeAccounts + ts.staleAccounts + ts.lostAccounts,
    knownRiskTradeCount, trustedTrackedTradeCount,
  };
}

// ═══════════════════════════════════════════
// ENGINE 2: DELTA
// ═══════════════════════════════════════════

export function createDigestSnapshot(
  cockpit: {
    totalFloatingPnl: number | null;
    realizedPnl: number | null;
    realizedR: number | null;
    closedCount: number;
  },
  assessment: StateAssessment
): DigestSnapshot {
  const m = assessment.metrics;
  return {
    openPnl: cockpit.totalFloatingPnl,
    realizedPnl: cockpit.realizedPnl,
    realizedR: cockpit.realizedR,
    needActionCount: m.needActionCount,
    unknownRiskCount: m.unknownRiskCount,
    unprotectedCount: m.unprotectedCount,
    trackingLostTradeCount: m.trackingLostTradeCount,
    staleTradeCount: m.staleTradeCount,
    activeAccountCount: m.activeAccountCount,
    closedCount: cockpit.closedCount,
    openTradeCount: m.openTradeCount,
    confidenceScore: assessment.confidenceScore,
    safetyScore: assessment.safetyScore,
    ts: Date.now(),
  };
}

export function computeDeltas(
  current: DigestSnapshot,
  previous: DigestSnapshot | null
): DigestDelta[] | null {
  if (!previous) return null;

  const fields: Array<{ metric: string; cur: number | null; prev: number | null }> = [
    { metric: "openPnl", cur: current.openPnl, prev: previous.openPnl },
    { metric: "realizedPnl", cur: current.realizedPnl, prev: previous.realizedPnl },
    { metric: "realizedR", cur: current.realizedR, prev: previous.realizedR },
    { metric: "needActionCount", cur: current.needActionCount, prev: previous.needActionCount },
    { metric: "unknownRiskCount", cur: current.unknownRiskCount, prev: previous.unknownRiskCount },
    { metric: "unprotectedCount", cur: current.unprotectedCount, prev: previous.unprotectedCount },
    { metric: "trackingLostTradeCount", cur: current.trackingLostTradeCount, prev: previous.trackingLostTradeCount },
    { metric: "staleTradeCount", cur: current.staleTradeCount, prev: previous.staleTradeCount },
    { metric: "activeAccountCount", cur: current.activeAccountCount, prev: previous.activeAccountCount },
    { metric: "closedCount", cur: current.closedCount, prev: previous.closedCount },
    { metric: "openTradeCount", cur: current.openTradeCount, prev: previous.openTradeCount },
    { metric: "confidenceScore", cur: current.confidenceScore, prev: previous.confidenceScore },
    { metric: "safetyScore", cur: current.safetyScore, prev: previous.safetyScore },
  ];

  const deltas: DigestDelta[] = [];
  for (const f of fields) {
    const cur = f.cur ?? 0;
    const prev = f.prev ?? 0;
    const delta = Math.round((cur - prev) * 100) / 100;
    if (delta === 0) continue;

    let direction: DeltaDirection = "neutral";
    if (GOOD_WHEN_UP.has(f.metric)) direction = delta > 0 ? "good" : "bad";
    else if (GOOD_WHEN_DOWN.has(f.metric)) direction = delta < 0 ? "good" : "bad";

    deltas.push({ metric: f.metric, current: cur, previous: prev, delta, direction });
  }

  return deltas.length > 0 ? deltas : null;
}

// ═══════════════════════════════════════════
// ENGINE 3: RISK SEVERITY (ALERTS)
// ═══════════════════════════════════════════

export function generateAlerts(
  assessment: StateAssessment,
  members: AlertMemberInput[],
  previousSnapshot: DigestSnapshot | null = null
): DigestAlert[] {
  const alerts: DigestAlert[] = [];
  let nextId = 0;

  // Per-member alerts
  for (const m of members) {
    if (m.trackingLostCount > 0) {
      alerts.push(makeAlert(
        String(++nextId), "tracking_lost_with_exposure",
        m.name, m.userId, m.trackingLostCount, previousSnapshot
      ));
    }
    if (m.staleCount > 0) {
      alerts.push(makeAlert(
        String(++nextId), "stale_with_exposure",
        m.name, m.userId, m.staleCount, previousSnapshot
      ));
    }
    if (m.openTradeCount > HIGH_TRADE_CLUSTER_THRESHOLD) {
      alerts.push(makeAlert(
        String(++nextId), "high_open_trade_cluster",
        m.name, m.userId, m.openTradeCount, previousSnapshot
      ));
    }
  }

  // Aggregate alerts
  const sm = assessment.metrics;
  if (sm.unprotectedCount > 0) {
    alerts.push(makeAlert(
      String(++nextId), "unprotected_trade",
      null, null, sm.unprotectedCount, previousSnapshot
    ));
  }
  if (sm.unknownRiskCount > 0) {
    alerts.push(makeAlert(
      String(++nextId), "unknown_risk_trade",
      null, null, sm.unknownRiskCount, previousSnapshot
    ));
  }
  if (assessment.confidenceScore < 65) {
    alerts.push(makeAlert(
      String(++nextId), "confidence_degraded",
      null, null, 1, previousSnapshot
    ));
  }
  if (sm.totalAccountCount > sm.activeAccountCount && sm.openTradeCount > 0) {
    const inactive = sm.totalAccountCount - sm.activeAccountCount;
    alerts.push(makeAlert(
      String(++nextId), "account_inactive_with_open_positions",
      null, null, inactive, previousSnapshot
    ));
  }

  // Sort by severity descending
  alerts.sort((a, b) => b.severityScore - a.severityScore);
  return alerts;
}

function makeAlert(
  id: string,
  type: AlertType,
  member: string | null,
  memberId: string | null,
  count: number,
  prevSnapshot: DigestSnapshot | null
): DigestAlert {
  let score = ALERT_BASE_SEVERITY[type];

  // Modifier: affected trade count
  score += Math.min(count * 4, 20);

  // Modifier: worsening trend
  if (prevSnapshot) {
    const metricMap: Partial<Record<AlertType, keyof DigestSnapshot>> = {
      tracking_lost_with_exposure: "trackingLostTradeCount",
      unprotected_trade: "unprotectedCount",
      unknown_risk_trade: "unknownRiskCount",
      stale_with_exposure: "staleTradeCount",
    };
    const key = metricMap[type];
    if (key) {
      const prev = prevSnapshot[key];
      if (typeof prev === "number" && count > prev) {
        score += 10;
      }
    }
  }

  score = Math.min(score, 100);

  return {
    id, type,
    affectedMember: member,
    affectedMemberId: memberId,
    issueCount: count,
    severityScore: score,
    severityBand: score >= 85 ? "CRITICAL" : score >= 65 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW",
  };
}

// ═══════════════════════════════════════════
// ENGINE 4: ACTION QUEUE
// ═══════════════════════════════════════════

export function generateActions(alerts: DigestAlert[]): ActionItem[] {
  const actions: ActionItem[] = [];

  for (const alert of alerts) {
    if (actions.length >= ACTION_MAX) break;
    const priority = alert.severityScore + Math.min(alert.issueCount * 2, 10);
    actions.push({
      alertId: alert.id,
      alertType: alert.type,
      priority,
      affectedMember: alert.affectedMember,
      issueCount: alert.issueCount,
    });
  }

  actions.sort((a, b) => b.priority - a.priority);
  return actions.slice(0, ACTION_MAX);
}

// ═══════════════════════════════════════════
// ENGINE 5: MEMBER IMPACT
// ═══════════════════════════════════════════

export function computeMemberImpactScore(
  member: AlertMemberInput,
  clanTotals: StateMetrics
): number {
  if (clanTotals.openTradeCount === 0) return 0;

  const safe = (v: number) => Math.max(v, 1);
  const needActionShare = member.needActionCount / safe(clanTotals.needActionCount);
  const unknownRiskShare = member.unknownRiskCount / safe(clanTotals.unknownRiskCount);
  const trackingLostShare = member.trackingLostCount / safe(clanTotals.trackingLostTradeCount);
  const openTradeShare = member.openTradeCount / safe(clanTotals.openTradeCount);

  // If clan has zero issues in a category, member share defaults to 1/1 = 100%
  // which inflates score. Guard: if clan total is 0, skip that dimension.
  const weights: Array<[number, number]> = [];
  if (clanTotals.needActionCount > 0) weights.push([0.35, needActionShare]);
  if (clanTotals.unknownRiskCount > 0) weights.push([0.25, unknownRiskShare]);
  if (clanTotals.trackingLostTradeCount > 0) weights.push([0.25, trackingLostShare]);
  weights.push([0.15, openTradeShare]);

  if (weights.length === 0) return 0;

  const totalWeight = weights.reduce((s, [w]) => s + w, 0);
  const weightedSum = weights.reduce((s, [w, v]) => s + w * v, 0);
  const score = Math.round(100 * (weightedSum / totalWeight));

  return Math.min(score, 100);
}

export function getMemberImpactLabel(
  score: number,
  member: AlertMemberInput
): string | null {
  if (score >= 60 && member.trackingLostCount > 0) return "digest.impact.trackingDegraded";
  if (score >= 50 && member.unknownRiskCount > 0) return "digest.impact.highUnknownRisk";
  if (score >= 50) return "digest.impact.mainRiskSource";
  return null;
}
