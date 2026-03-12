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
  | "high_open_trade_cluster"
  | "concentration_risk";

export type MemberTrend = "improving" | "declining" | "stable" | "new";
export type RiskBudgetBand = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type HintSeverity = "warning" | "info";

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
  /** Per-member metrics for trend computation (Phase 2) */
  memberMetrics?: Record<string, MemberSnapshotData>;
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

// ─── Phase 2+3 Types ───

export interface ConcentrationCluster {
  instrument: string;
  direction: string;
  tradeCount: number;
  memberCount: number;
  members: string[];
  totalFloatingR: number | null;
  totalRiskToSLR: number | null;
}

export interface ConcentrationPositionInput {
  instrument: string;
  direction: string;
  memberName: string;
  floatingR: number | null;
  riskToSLR: number | null;
}

export interface RiskBudget {
  totalOpenRiskR: number;
  totalEquity: number | null;
  riskPctOfEquity: number | null;
  riskBudgetBand: RiskBudgetBand;
}

export interface PredictiveHint {
  metric: string;
  hintKey: string;
  severity: HintSeverity;
}

export interface MemberSnapshotData {
  needAction: number;
  unknownRisk: number;
  trackingLost: number;
  unprotected: number;
  openCount: number;
}

// ─── Internal Constants ───

const ALERT_BASE_SEVERITY: Record<AlertType, number> = {
  tracking_lost_with_exposure: 85,
  account_inactive_with_open_positions: 80,
  missing_stop_loss_cluster: 72,
  stale_with_exposure: 70,
  unprotected_trade: 68,
  concentration_risk: 62,
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
const CONCENTRATION_THRESHOLD = 3; // trades on same instrument+direction
const ACTION_MAX = 3;

// Risk budget thresholds (total SL risk as negative R)
const RISK_BUDGET_MODERATE_R = -3;
const RISK_BUDGET_HIGH_R = -6;
const RISK_BUDGET_CRITICAL_R = -10;

// Predictive hint thresholds
const HINT_RAPID_SAFETY_DROP = 10;
const HINT_HIGH_ISSUE_THRESHOLD = 5;

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
  previousSnapshot: DigestSnapshot | null = null,
  concentrationClusters: ConcentrationCluster[] = []
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

  // Concentration alerts (Phase 2)
  for (const cluster of concentrationClusters) {
    if (cluster.tradeCount >= CONCENTRATION_THRESHOLD) {
      alerts.push(makeAlert(
        String(++nextId), "concentration_risk",
        `${cluster.instrument} ${cluster.direction}`, null,
        cluster.tradeCount, previousSnapshot
      ));
    }
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

// ═══════════════════════════════════════════
// ENGINE 6: CONCENTRATION ANALYSIS (Phase 2)
// ═══════════════════════════════════════════

export function computeConcentration(
  positions: ConcentrationPositionInput[]
): ConcentrationCluster[] {
  const map = new Map<string, {
    instrument: string;
    direction: string;
    trades: number;
    members: Set<string>;
    floatingR: number;
    riskToSLR: number;
    hasR: boolean;
    hasRisk: boolean;
  }>();

  for (const p of positions) {
    const key = `${p.instrument}:${p.direction}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        instrument: p.instrument,
        direction: p.direction,
        trades: 0,
        members: new Set(),
        floatingR: 0,
        riskToSLR: 0,
        hasR: false,
        hasRisk: false,
      };
      map.set(key, entry);
    }
    entry.trades++;
    entry.members.add(p.memberName);
    if (p.floatingR !== null) {
      entry.floatingR += p.floatingR;
      entry.hasR = true;
    }
    if (p.riskToSLR !== null) {
      entry.riskToSLR += p.riskToSLR;
      entry.hasRisk = true;
    }
  }

  const clusters: ConcentrationCluster[] = [];
  for (const e of map.values()) {
    if (e.trades >= CONCENTRATION_THRESHOLD) {
      clusters.push({
        instrument: e.instrument,
        direction: e.direction,
        tradeCount: e.trades,
        memberCount: e.members.size,
        members: Array.from(e.members),
        totalFloatingR: e.hasR ? Math.round(e.floatingR * 100) / 100 : null,
        totalRiskToSLR: e.hasRisk ? Math.round(e.riskToSLR * 100) / 100 : null,
      });
    }
  }

  // Sort by trade count descending
  clusters.sort((a, b) => b.tradeCount - a.tradeCount);
  return clusters;
}

// ═══════════════════════════════════════════
// ENGINE 7: RISK BUDGET (Phase 2+3)
// ═══════════════════════════════════════════

export function computeRiskBudget(input: {
  currentOpenRiskR: number | null;
  totalEquity: number | null;
  totalBalance: number | null;
  openTradeCount: number;
}): RiskBudget | null {
  if (input.openTradeCount === 0 || input.currentOpenRiskR === null) return null;

  const riskR = input.currentOpenRiskR; // negative = risk

  // Risk as % of equity (Phase 3)
  let riskPctOfEquity: number | null = null;
  if (input.totalEquity && input.totalEquity > 0 && input.totalBalance && input.totalBalance > 0) {
    // currentOpenRiskR is in R units not money, so we estimate:
    // if equity and balance are close, risk is manageable
    // Use equity drawdown potential as a proxy
    const equityDiff = input.totalEquity - input.totalBalance;
    const drawdownPct = input.totalBalance > 0 ? (equityDiff / input.totalBalance) * 100 : 0;
    riskPctOfEquity = Math.round(drawdownPct * 100) / 100;
  }

  // Band based on total R risk
  let riskBudgetBand: RiskBudgetBand;
  if (riskR >= RISK_BUDGET_MODERATE_R) riskBudgetBand = "LOW";
  else if (riskR >= RISK_BUDGET_HIGH_R) riskBudgetBand = "MODERATE";
  else if (riskR >= RISK_BUDGET_CRITICAL_R) riskBudgetBand = "HIGH";
  else riskBudgetBand = "CRITICAL";

  return {
    totalOpenRiskR: Math.round(riskR * 100) / 100,
    totalEquity: input.totalEquity,
    riskPctOfEquity,
    riskBudgetBand,
  };
}

// ═══════════════════════════════════════════
// ENGINE 8: MEMBER TREND (Phase 2)
// ═══════════════════════════════════════════

export function computeMemberTrend(
  current: MemberSnapshotData,
  previous: MemberSnapshotData | null
): MemberTrend {
  if (!previous) return "new";

  // Count improvements (bad metrics going down) and deteriorations (bad metrics going up)
  let improvements = 0;
  let deteriorations = 0;

  if (current.needAction < previous.needAction) improvements++;
  else if (current.needAction > previous.needAction) deteriorations++;

  if (current.unknownRisk < previous.unknownRisk) improvements++;
  else if (current.unknownRisk > previous.unknownRisk) deteriorations++;

  if (current.trackingLost < previous.trackingLost) improvements++;
  else if (current.trackingLost > previous.trackingLost) deteriorations++;

  if (current.unprotected < previous.unprotected) improvements++;
  else if (current.unprotected > previous.unprotected) deteriorations++;

  if (deteriorations > improvements) return "declining";
  if (improvements > deteriorations) return "improving";
  return "stable";
}

// ═══════════════════════════════════════════
// ENGINE 9: PREDICTIVE HINTS (Phase 3)
// ═══════════════════════════════════════════

export function computePredictiveHints(
  current: DigestSnapshot,
  previous: DigestSnapshot | null,
  deltas: DigestDelta[] | null
): PredictiveHint[] {
  const hints: PredictiveHint[] = [];
  if (!previous || !deltas) return hints;

  // Rapid safety score drop
  const safetyDrop = previous.safetyScore - current.safetyScore;
  if (safetyDrop >= HINT_RAPID_SAFETY_DROP) {
    hints.push({
      metric: "safetyScore",
      hintKey: "digest.hint.rapidSafetyDrop",
      severity: "warning",
    });
  }

  // Rapid confidence drop
  const confDrop = previous.confidenceScore - current.confidenceScore;
  if (confDrop >= HINT_RAPID_SAFETY_DROP) {
    hints.push({
      metric: "confidenceScore",
      hintKey: "digest.hint.rapidConfidenceDrop",
      severity: "warning",
    });
  }

  // High and worsening issue counts
  for (const d of deltas) {
    if (d.direction !== "bad") continue;

    if (d.metric === "unknownRiskCount" && d.current >= HINT_HIGH_ISSUE_THRESHOLD) {
      hints.push({
        metric: "unknownRiskCount",
        hintKey: "digest.hint.unknownRiskGrowing",
        severity: "warning",
      });
    }
    if (d.metric === "unprotectedCount" && d.current >= HINT_HIGH_ISSUE_THRESHOLD) {
      hints.push({
        metric: "unprotectedCount",
        hintKey: "digest.hint.unprotectedGrowing",
        severity: "warning",
      });
    }
    if (d.metric === "trackingLostTradeCount" && d.current >= 2) {
      hints.push({
        metric: "trackingLostTradeCount",
        hintKey: "digest.hint.trackingDeteriorating",
        severity: "warning",
      });
    }
  }

  // Open trades growing without proportional risk coverage
  if (current.openTradeCount > previous.openTradeCount) {
    const newTrades = current.openTradeCount - previous.openTradeCount;
    const newUnknown = current.unknownRiskCount - previous.unknownRiskCount;
    if (newUnknown > 0 && newUnknown >= newTrades / 2) {
      hints.push({
        metric: "openTradeCount",
        hintKey: "digest.hint.newTradesLowCoverage",
        severity: "info",
      });
    }
  }

  return hints;
}

// ═══════════════════════════════════════════
// Enhanced createDigestSnapshot (Phase 2)
// ═══════════════════════════════════════════

export function createDigestSnapshotV2(
  cockpit: {
    totalFloatingPnl: number | null;
    realizedPnl: number | null;
    realizedR: number | null;
    closedCount: number;
  },
  assessment: StateAssessment,
  memberData?: Record<string, MemberSnapshotData>
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
    memberMetrics: memberData,
  };
}

// ═══════════════════════════════════════════
// ENGINE 10: ENTRY QUALITY INSIGHT (Phase 5)
// ═══════════════════════════════════════════

export interface EntryClusterInput {
  instrument: string;
  direction: string;
  openPrice: number | null;
  lots: number | null;
  floatingPnl: number | null;
  accountLabel?: string;
}

export interface EntryClusterInsight {
  instrument: string;
  direction: string;
  tradeCount: number;
  weightedAvgEntry: number | null;
  entrySpread: number | null;
  entrySpreadPct: number | null;
  qualityLabel: "tight" | "spread" | "wide" | "unknown";
  accounts: string[];
}

export function computeEntryInsights(
  positions: EntryClusterInput[]
): EntryClusterInsight[] {
  // Group by instrument+direction
  const clusters = new Map<string, {
    instrument: string;
    direction: string;
    entries: Array<{ price: number; lots: number }>;
    accounts: Set<string>;
    count: number;
  }>();

  for (const p of positions) {
    if (p.openPrice === null || p.openPrice <= 0) continue;
    const key = `${p.instrument}:${p.direction}`;
    let c = clusters.get(key);
    if (!c) {
      c = { instrument: p.instrument, direction: p.direction, entries: [], accounts: new Set(), count: 0 };
      clusters.set(key, c);
    }
    c.entries.push({ price: p.openPrice, lots: p.lots ?? 1 });
    c.count++;
    if (p.accountLabel) c.accounts.add(p.accountLabel);
  }

  const results: EntryClusterInsight[] = [];
  for (const c of clusters.values()) {
    if (c.count < 2) continue; // Need at least 2 trades for meaningful cluster

    const totalLots = c.entries.reduce((s, e) => s + e.lots, 0);
    const weightedAvgEntry = totalLots > 0
      ? c.entries.reduce((s, e) => s + e.price * e.lots, 0) / totalLots
      : null;

    const prices = c.entries.map((e) => e.price);
    const minEntry = Math.min(...prices);
    const maxEntry = Math.max(...prices);
    const entrySpread = maxEntry - minEntry;
    const avgPrice = weightedAvgEntry ?? (minEntry + maxEntry) / 2;
    const entrySpreadPct = avgPrice > 0 ? Math.round((entrySpread / avgPrice) * 10000) / 100 : null;

    // Quality: tight (<0.5% spread), spread (0.5-2%), wide (>2%)
    let qualityLabel: EntryClusterInsight["qualityLabel"] = "unknown";
    if (entrySpreadPct !== null) {
      if (entrySpreadPct < 0.5) qualityLabel = "tight";
      else if (entrySpreadPct < 2) qualityLabel = "spread";
      else qualityLabel = "wide";
    }

    results.push({
      instrument: c.instrument,
      direction: c.direction,
      tradeCount: c.count,
      weightedAvgEntry: weightedAvgEntry !== null ? Math.round(weightedAvgEntry * 100000) / 100000 : null,
      entrySpread: Math.round(entrySpread * 100000) / 100000,
      entrySpreadPct,
      qualityLabel,
      accounts: Array.from(c.accounts),
    });
  }

  results.sort((a, b) => b.tradeCount - a.tradeCount);
  return results;
}

// ═══════════════════════════════════════════
// ENGINE 11: SCALING PATTERN (Phase 5)
// ═══════════════════════════════════════════

export interface ScalingInput {
  instrument: string;
  direction: string;
  openPrice: number | null;
  lots: number | null;
  createdAt: string;
}

export type ScalingPattern = "balanced" | "increasing" | "decreasing" | "spike" | "unknown";

export interface ScalingInsight {
  instrument: string;
  direction: string;
  legCount: number;
  totalLots: number;
  avgLots: number;
  largestLegLots: number;
  largestLegShare: number; // 0-1
  lastLegVsAvg: number; // ratio: lastLeg/avgLots
  pattern: ScalingPattern;
}

export function computeScalingInsights(
  positions: ScalingInput[]
): ScalingInsight[] {
  const clusters = new Map<string, {
    instrument: string;
    direction: string;
    legs: Array<{ lots: number; ts: number }>;
  }>();

  for (const p of positions) {
    if (p.lots === null || p.lots <= 0) continue;
    const key = `${p.instrument}:${p.direction}`;
    let c = clusters.get(key);
    if (!c) {
      c = { instrument: p.instrument, direction: p.direction, legs: [] };
      clusters.set(key, c);
    }
    c.legs.push({ lots: p.lots, ts: new Date(p.createdAt).getTime() });
  }

  const results: ScalingInsight[] = [];
  for (const c of clusters.values()) {
    if (c.legs.length < 2) continue; // Need multiple legs

    // Sort by time ascending
    c.legs.sort((a, b) => a.ts - b.ts);

    const totalLots = c.legs.reduce((s, l) => s + l.lots, 0);
    const avgLots = totalLots / c.legs.length;
    const largestLeg = Math.max(...c.legs.map((l) => l.lots));
    const largestLegShare = totalLots > 0 ? largestLeg / totalLots : 0;
    const lastLeg = c.legs[c.legs.length - 1].lots;
    const lastLegVsAvg = avgLots > 0 ? lastLeg / avgLots : 1;

    // Detect pattern
    let pattern: ScalingPattern = "unknown";
    if (c.legs.length >= 2) {
      const lotSizes = c.legs.map((l) => l.lots);
      const isIncreasing = lotSizes.every((v, i) => i === 0 || v >= lotSizes[i - 1]);
      const isDecreasing = lotSizes.every((v, i) => i === 0 || v <= lotSizes[i - 1]);
      const maxDeviation = Math.max(...lotSizes.map((l) => Math.abs(l - avgLots)));
      const isBalanced = maxDeviation / avgLots < 0.3; // within 30% of avg

      if (isBalanced) pattern = "balanced";
      else if (largestLegShare > 0.5) pattern = "spike"; // one leg > 50% of total
      else if (isIncreasing) pattern = "increasing";
      else if (isDecreasing) pattern = "decreasing";
      else pattern = "spike"; // mixed with a large leg
    }

    results.push({
      instrument: c.instrument,
      direction: c.direction,
      legCount: c.legs.length,
      totalLots: Math.round(totalLots * 100) / 100,
      avgLots: Math.round(avgLots * 100) / 100,
      largestLegLots: Math.round(largestLeg * 100) / 100,
      largestLegShare: Math.round(largestLegShare * 100) / 100,
      lastLegVsAvg: Math.round(lastLegVsAvg * 100) / 100,
      pattern,
    });
  }

  results.sort((a, b) => b.legCount - a.legCount);
  return results;
}

// ═══════════════════════════════════════════
// ENGINE 12: ENHANCED CONCENTRATION (Phase 5)
// ═══════════════════════════════════════════

export interface ConcentrationSummary {
  topSymbolShare: number; // 0-1
  topSymbol: string | null;
  longShare: number; // 0-1
  shortShare: number; // 0-1;
  singleDirectionExposure: boolean;
  singleSymbolExposure: boolean;
  accountCount: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
}

export function computeConcentrationSummary(
  positions: Array<{ instrument: string; direction: string; accountLabel?: string }>
): ConcentrationSummary | null {
  if (positions.length < 2) return null;

  // Symbol counts
  const symbolCounts = new Map<string, number>();
  const accounts = new Set<string>();
  let longCount = 0;
  let shortCount = 0;

  for (const p of positions) {
    symbolCounts.set(p.instrument, (symbolCounts.get(p.instrument) ?? 0) + 1);
    if (p.accountLabel) accounts.add(p.accountLabel);
    if (p.direction === "LONG" || p.direction === "BUY") longCount++;
    else shortCount++;
  }

  const total = positions.length;
  let topSymbol: string | null = null;
  let topCount = 0;
  for (const [sym, count] of symbolCounts) {
    if (count > topCount) {
      topCount = count;
      topSymbol = sym;
    }
  }

  const topSymbolShare = topCount / total;
  const longShare = longCount / total;
  const shortShare = shortCount / total;
  const singleDirectionExposure = longShare === 1 || shortShare === 1;
  const singleSymbolExposure = topSymbolShare === 1;

  // Risk level based on concentration
  let riskLevel: ConcentrationSummary["riskLevel"] = "low";
  if (singleSymbolExposure && singleDirectionExposure) riskLevel = "critical";
  else if (singleSymbolExposure || singleDirectionExposure) riskLevel = "high";
  else if (topSymbolShare >= 0.7) riskLevel = "moderate";

  return {
    topSymbolShare: Math.round(topSymbolShare * 100) / 100,
    topSymbol,
    longShare: Math.round(longShare * 100) / 100,
    shortShare: Math.round(shortShare * 100) / 100,
    singleDirectionExposure,
    singleSymbolExposure,
    accountCount: accounts.size,
    riskLevel,
  };
}

// ═══════════════════════════════════════════
// ENGINE 13: SMART ACTIONS (Phase 6)
// ═══════════════════════════════════════════

export interface SmartActionInput {
  positions: Array<{
    floatingPnl: number | null;
    protectionStatus: string;
    lots: number | null;
    instrument: string;
    direction: string;
    openPrice: number | null;
    createdAt: string;
  }>;
  totalFloatingPnl: number | null;
  entryInsights: EntryClusterInsight[];
  scalingInsights: ScalingInsight[];
  concentrationSummary: ConcentrationSummary | null;
}

export interface SmartAction {
  priority: number;
  icon: "risk" | "opportunity" | "analysis";
  titleKey: string;
  detailKey: string;
  detailParams: Record<string, string | number>;
}

export function computeSmartActions(input: SmartActionInput): SmartAction[] {
  const actions: SmartAction[] = [];
  const { positions, entryInsights, scalingInsights, concentrationSummary } = input;

  if (positions.length === 0) return actions;

  // Priority 1: Unprotected profit — highest urgency
  const unprotectedProfitable = positions.filter(
    (p) => p.floatingPnl !== null && p.floatingPnl > 0 && p.protectionStatus === "UNPROTECTED"
  );
  if (unprotectedProfitable.length > 0) {
    const totalUnprotectedPnl = unprotectedProfitable.reduce((s, p) => s + (p.floatingPnl ?? 0), 0);
    const totalLots = unprotectedProfitable.reduce((s, p) => s + (p.lots ?? 0), 0);
    actions.push({
      priority: 1,
      icon: "risk",
      titleKey: "digest.smart.setStopLoss",
      detailKey: "digest.smart.setStopLossDetail",
      detailParams: {
        pnl: Math.round(totalUnprotectedPnl),
        count: unprotectedProfitable.length,
        lots: Math.round(totalLots),
      },
    });
  }

  // Priority 2: Position size anomaly (last leg >40% larger than avg)
  for (const s of scalingInsights) {
    if (s.lastLegVsAvg > 1.4) {
      const deviationPct = Math.round((s.lastLegVsAvg - 1) * 100);
      actions.push({
        priority: 2,
        icon: "risk",
        titleKey: "digest.smart.reviewSizing",
        detailKey: "digest.smart.reviewSizingDetail",
        detailParams: {
          instrument: s.instrument,
          deviationPct,
          avgLots: s.avgLots,
        },
      });
      break; // only show worst case
    }
  }

  // Priority 3: Single-asset concentration (>80% in one symbol)
  if (concentrationSummary && concentrationSummary.topSymbolShare > 0.8) {
    const pct = Math.round(concentrationSummary.topSymbolShare * 100);
    actions.push({
      priority: 3,
      icon: "risk",
      titleKey: "digest.smart.concentration",
      detailKey: concentrationSummary.singleDirectionExposure
        ? "digest.smart.concentrationBoth"
        : "digest.smart.concentrationSymbol",
      detailParams: {
        symbol: concentrationSummary.topSymbol ?? "?",
        pct,
      },
    });
  }

  // Priority 4: Wide entry spread (>10% of current price)
  for (const e of entryInsights) {
    if (e.qualityLabel === "wide" && e.entrySpreadPct !== null && e.entrySpreadPct > 10) {
      actions.push({
        priority: 4,
        icon: "analysis",
        titleKey: "digest.smart.wideSpread",
        detailKey: "digest.smart.wideSpreadDetail",
        detailParams: {
          instrument: e.instrument,
          spreadPct: e.entrySpreadPct,
          tradeCount: e.tradeCount,
        },
      });
      break;
    }
  }

  // Priority 5: No SL on non-profitable positions (if not already covered by P1)
  if (!actions.some((a) => a.priority === 1)) {
    const noSL = positions.filter(
      (p) => p.protectionStatus === "UNPROTECTED" || p.protectionStatus === "UNKNOWN_RISK"
    );
    if (noSL.length > 0) {
      actions.push({
        priority: 5,
        icon: "risk",
        titleKey: "digest.smart.defineRisk",
        detailKey: "digest.smart.defineRiskDetail",
        detailParams: { count: noSL.length },
      });
    }
  }

  // Priority 6: Extended hold without SL (>48h)
  const now = Date.now();
  const extendedNoSL = positions.filter((p) => {
    const age = now - new Date(p.createdAt).getTime();
    return (
      age > 48 * 3600 * 1000 &&
      (p.protectionStatus === "UNPROTECTED" || p.protectionStatus === "UNKNOWN_RISK")
    );
  });
  if (extendedNoSL.length > 0 && !actions.some((a) => a.priority === 1 || a.priority === 5)) {
    actions.push({
      priority: 6,
      icon: "risk",
      titleKey: "digest.smart.extendedNoSL",
      detailKey: "digest.smart.extendedNoSLDetail",
      detailParams: { count: extendedNoSL.length },
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}
