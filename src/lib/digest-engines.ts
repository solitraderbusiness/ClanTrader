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
