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
  totalBalance: number | null;
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
    totalBalance: input.totalBalance,
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
    currentSL: number | null;
    currentTP: number | null;
  }>;
  totalFloatingPnl: number | null;
  accountEquity: number | null;
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
  const { positions, accountEquity, entryInsights, scalingInsights, concentrationSummary } = input;

  if (positions.length === 0) return actions;

  // P1: Unprotected profit — highest urgency
  const unprotectedProfitable = positions.filter(
    (p) => p.floatingPnl !== null && p.floatingPnl > 0 && p.protectionStatus === "UNPROTECTED"
  );
  if (unprotectedProfitable.length > 0) {
    const totalUnprotectedPnl = unprotectedProfitable.reduce((s, p) => s + (p.floatingPnl ?? 0), 0);
    actions.push({
      priority: 1,
      icon: "risk",
      titleKey: "digest.smart.setStopLoss",
      detailKey: "digest.smart.setStopLossDetail",
      detailParams: {
        pnl: Math.round(totalUnprotectedPnl),
        count: unprotectedProfitable.length,
        lots: Math.round(unprotectedProfitable.reduce((s, p) => s + (p.lots ?? 0), 0)),
      },
    });
  }

  // P2: Position size anomaly (last leg >40% larger than avg)
  for (const s of scalingInsights) {
    if (s.lastLegVsAvg > 1.4) {
      actions.push({
        priority: 2,
        icon: "risk",
        titleKey: "digest.smart.reviewSizing",
        detailKey: "digest.smart.reviewSizingDetail",
        detailParams: {
          instrument: s.instrument,
          deviationPct: Math.round((s.lastLegVsAvg - 1) * 100),
          avgLots: s.avgLots,
        },
      });
      break;
    }
  }

  // P3: Wide entry spread (>10% of current price)
  for (const e of entryInsights) {
    if (e.qualityLabel === "wide" && e.entrySpreadPct !== null && e.entrySpreadPct > 10) {
      actions.push({
        priority: 3,
        icon: "analysis",
        titleKey: "digest.smart.wideSpread",
        detailKey: "digest.smart.wideSpreadDetail",
        detailParams: { instrument: e.instrument, spreadPct: e.entrySpreadPct, tradeCount: e.tradeCount },
      });
      break;
    }
  }

  // P4: If all SLs hit — total loss across all SL-protected positions
  const withSL = positions.filter((p) => p.currentSL !== null && p.currentSL > 0 && p.openPrice !== null && p.lots !== null);
  if (withSL.length > 0) {
    const totalSLLoss = withSL.reduce((sum, p) => {
      const dir = p.direction === "LONG" ? 1 : -1;
      const pv = getSymbolPointValue(p.instrument);
      return sum + dir * (p.currentSL! - p.openPrice!) * (p.lots ?? 0) * pv;
    }, 0);
    if (totalSLLoss < 0) {
      const pct = accountEquity && accountEquity > 0 ? Math.round((totalSLLoss / accountEquity) * 1000) / 10 : null;
      actions.push({
        priority: 4,
        icon: "analysis",
        titleKey: "digest.smart.allSLHit",
        detailKey: "digest.smart.allSLHitDetail",
        detailParams: {
          loss: Math.round(Math.abs(totalSLLoss)),
          pct: pct !== null ? pct : 0,
          count: withSL.length,
        },
      });
    }
  }

  // P5: Single-asset concentration (>80% in one symbol)
  if (concentrationSummary && concentrationSummary.topSymbolShare > 0.8) {
    actions.push({
      priority: 5,
      icon: "risk",
      titleKey: "digest.smart.concentration",
      detailKey: concentrationSummary.singleDirectionExposure
        ? "digest.smart.concentrationBoth"
        : "digest.smart.concentrationSymbol",
      detailParams: {
        symbol: concentrationSummary.topSymbol ?? "?",
        pct: Math.round(concentrationSummary.topSymbolShare * 100),
      },
    });
  }

  // P6: No SL on non-profitable positions (if not already covered by P1)
  if (!actions.some((a) => a.priority === 1)) {
    const noSL = positions.filter(
      (p) => p.protectionStatus === "UNPROTECTED" || p.protectionStatus === "UNKNOWN_RISK"
    );
    if (noSL.length > 0) {
      actions.push({
        priority: 6,
        icon: "risk",
        titleKey: "digest.smart.defineRisk",
        detailKey: "digest.smart.defineRiskDetail",
        detailParams: { count: noSL.length },
      });
    }
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}


// ═══════════════════════════════════════════
// ENGINE 14: PRICE LADDER (Phase 7)
// ═══════════════════════════════════════════

/** Conservative fallback table — ONLY used when derivation from real data fails */
const DEFAULT_POINT_VALUES: Record<string, number> = {
  UKBRENT: 10, UKOIL: 10, BRENT: 10,
  USOIL: 10, USCRUDE: 10, XTIUSD: 10, WTI: 10, CL: 10,
  XAUUSD: 100, GOLD: 100,
  XAGUSD: 5000,
  EURUSD: 100000, GBPUSD: 100000, AUDUSD: 100000, NZDUSD: 100000,
  USDCHF: 100000, USDCAD: 100000, USDJPY: 100000,
  GBPJPY: 100000, EURJPY: 100000, EURGBP: 100000,
  US30: 1, DJ30: 1, USTEC: 1, NAS100: 1, US500: 1, SPX500: 1,
  DE40: 1, UK100: 1, JP225: 1,
  BTCUSD: 1, BTCUSDT: 1, ETHUSD: 1, ETHUSDT: 1,
};

function getDefaultPointValue(symbol: string): number {
  const key = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (DEFAULT_POINT_VALUES[key]) return DEFAULT_POINT_VALUES[key];
  for (const [k, v] of Object.entries(DEFAULT_POINT_VALUES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return 1;
}

/**
 * Derive pointValue per lot from real trade data:
 *   pointValue = |P/L| / (lots × |priceChange|)
 *
 * Picks the trade with the largest price move (most numerically stable).
 * Falls back to a conservative lookup table only when no usable trades exist.
 */
export function derivePointValue(
  positions: Array<{
    openPrice: number | null;
    lots: number | null;
    floatingPnl: number | null;
    currentPrice: number | null;
    instrument?: string;
  }>,
): number {
  const usable = positions.filter((p) => {
    if (!p.openPrice || !p.lots || !p.currentPrice || p.floatingPnl == null) return false;
    const move = Math.abs(p.currentPrice - p.openPrice);
    return move > 0.01 && Math.abs(p.floatingPnl) > 0.01 && p.lots > 0;
  });

  if (usable.length === 0) {
    return getDefaultPointValue(positions[0]?.instrument ?? "");
  }

  // Pick the position with the largest price move for numerical stability
  const best = usable.reduce((a, b) =>
    Math.abs((a.currentPrice ?? 0) - (a.openPrice ?? 0)) > Math.abs((b.currentPrice ?? 0) - (b.openPrice ?? 0)) ? a : b
  );

  const priceChange = (best.currentPrice ?? 0) - (best.openPrice ?? 0);
  const derived = Math.abs(best.floatingPnl! / ((best.lots ?? 1) * priceChange));

  // Sanity check: if derived value is wildly off (>100x or <0.01x of default), use default
  const fallback = getDefaultPointValue(best.instrument ?? "");
  if (derived > fallback * 100 || derived < fallback * 0.01) {
    return fallback;
  }

  return derived;
}

/** @deprecated Use derivePointValue() for accurate results */
export function getSymbolPointValue(symbol: string): number {
  return getDefaultPointValue(symbol);
}

export type PriceLadderZone = "profit" | "warning" | "danger" | "catastrophic";

export interface PriceLadderLevel {
  price: number;
  label: string;
  sublabel?: string;
  zone: PriceLadderZone;
  isCurrent?: boolean;
}

export interface PriceLadderData {
  symbol: string;
  direction: "LONG" | "SHORT";
  levels: PriceLadderLevel[];
  currentPrice: number;
  avgEntry: number;
  totalLots: number;
  totalPnl: number;
  dollarsPerPoint: number;
  insight?: string;
  hiddenLossLevels: number;
  tradeCount: number;
}

export interface PriceLadderInput {
  positions: Array<{
    instrument: string;
    direction: string;
    openPrice: number | null;
    lots: number | null;
    floatingPnl: number | null;
    currentPrice: number | null;
    currentSL: number | null;
    currentTP: number | null;
  }>;
  accountEquity: number | null;
}

/**
 * Generate a risk-context insight for the Price Ladder.
 * Tells the trader how much account risk a 1% price move creates,
 * how far -10% account loss is, and warns about gap risk if no SL.
 */
export function generateLadderInsight(
  currentPrice: number,
  dollarsPerPoint: number,
  accountEquity: number,
  symbol: string,
  hasStopLoss: boolean,
  hiddenLossLevels: number,
): string {
  if (accountEquity <= 0 || dollarsPerPoint <= 0 || currentPrice <= 0) return "";

  // Account impact per 1% price move
  const onePercentMove = currentPrice * 0.01;
  const accountImpactPerPctMove = onePercentMove * dollarsPerPoint;
  const accountPctPerPctMove = (accountImpactPerPctMove / accountEquity) * 100;

  // How far is -10% account loss from current price?
  const tenPctLoss = accountEquity * 0.10;
  const tenPctDrop = tenPctLoss / dollarsPerPoint;
  const tenPctDropPct = (tenPctDrop / currentPrice) * 100;

  let insight: string;
  if (tenPctDropPct > 50) {
    const riskNote = hasStopLoss ? "" : " No stop loss — gap risk remains.";
    insight = `Low relative risk: 1% ${symbol} move = ${accountPctPerPctMove.toFixed(2)}% of account. ${tenPctDropPct.toFixed(0)}% crash needed for -10%.${riskNote}`;
  } else if (tenPctDropPct > 20) {
    insight = `Moderate exposure: 1% ${symbol} move ≈ ${accountPctPerPctMove.toFixed(1)}% account. -10% at ${tenPctDropPct.toFixed(0)}% price drop.`;
  } else if (tenPctDropPct > 5) {
    insight = `Significant exposure: 1% ${symbol} move = ${accountPctPerPctMove.toFixed(1)}% of account. ${tenPctDropPct.toFixed(0)}% price move wipes 10%.`;
  } else {
    insight = `High leverage: ${tenPctDropPct.toFixed(1)}% ${symbol} move hits -10% of account. 1% move = ${accountPctPerPctMove.toFixed(1)}% of account.`;
  }

  if (hiddenLossLevels > 0) {
    insight += ` (${hiddenLossLevels} loss level${hiddenLossLevels > 1 ? "s" : ""} beyond possible price range)`;
  }

  return insight;
}

export function computePriceLadder(input: PriceLadderInput): PriceLadderData[] {
  const { positions, accountEquity } = input;

  // Group by symbol+direction
  const groups = new Map<string, typeof positions>();
  for (const p of positions) {
    if (!p.openPrice || !p.lots || !p.currentPrice) continue;
    const key = `${p.instrument}|${p.direction}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  const ladders: PriceLadderData[] = [];

  for (const [key, group] of groups) {
    const [symbol, dir] = key.split("|");
    const isLong = dir === "LONG";
    const pv = derivePointValue(group.map((p) => ({
      openPrice: p.openPrice,
      lots: p.lots,
      floatingPnl: p.floatingPnl,
      currentPrice: p.currentPrice,
      instrument: p.instrument,
    })));
    const totalLots = group.reduce((s, p) => s + (p.lots ?? 0), 0);
    if (totalLots <= 0) continue;

    const avgEntry = group.reduce((s, p) => s + (p.lots ?? 0) * (p.openPrice ?? 0), 0) / totalLots;
    const curPrice = group[0].currentPrice!;
    const totalPnl = group.reduce((s, p) => s + (p.floatingPnl ?? 0), 0);

    const levels: PriceLadderLevel[] = [];

    // Current Price
    levels.push({
      price: curPrice,
      label: "Current",
      sublabel: `P/L: ${totalPnl >= 0 ? "+" : ""}$${Math.round(totalPnl).toLocaleString()}`,
      zone: totalPnl >= 0 ? "profit" : "danger",
      isCurrent: true,
    });

    // Half Profit
    if (totalPnl > 0 && pv > 0) {
      const halfDelta = (totalPnl / 2) / (totalLots * pv);
      const halfPrice = isLong ? curPrice - halfDelta : curPrice + halfDelta;
      if ((isLong && halfPrice > avgEntry) || (!isLong && halfPrice < avgEntry)) {
        levels.push({
          price: halfPrice,
          label: "Half Profit",
          sublabel: `+$${Math.round(totalPnl / 2).toLocaleString()}`,
          zone: "profit",
        });
      }
    }

    // Breakeven (Avg Entry)
    levels.push({
      price: avgEntry,
      label: "Breakeven",
      sublabel: "$0 P/L",
      zone: "warning",
    });

    // Worst entry
    const entries = group.map((p) => p.openPrice ?? 0).filter((e) => e > 0);
    const worstEntry = isLong ? Math.max(...entries) : Math.min(...entries);
    if (Math.abs(worstEntry - avgEntry) > avgEntry * 0.005) {
      levels.push({
        price: worstEntry,
        label: "Worst Entry",
        zone: "warning",
      });
    }

    // Account loss levels (-10%, -20%, -50%) — filter unrealistic prices
    let hiddenLossLevels = 0;
    const maxReasonable = curPrice * 2.0;
    const minReasonable = curPrice * 0.2;
    if (accountEquity && accountEquity > 0 && pv > 0) {
      for (const pct of [0.10, 0.20, 0.50]) {
        const lossDelta = (accountEquity * pct) / (totalLots * pv);
        const lossPrice = isLong ? avgEntry - lossDelta : avgEntry + lossDelta;
        if (lossPrice > minReasonable && lossPrice < maxReasonable) {
          levels.push({
            price: lossPrice,
            label: `-${Math.round(pct * 100)}% Account`,
            sublabel: `-$${Math.round(accountEquity * pct).toLocaleString()}`,
            zone: pct >= 0.50 ? "catastrophic" : "danger",
          });
        } else {
          hiddenLossLevels++;
        }
      }
    }

    // SL levels
    const withSL = group.filter((p) => p.currentSL !== null && p.currentSL > 0);
    const hasStopLoss = withSL.length > 0;
    if (hasStopLoss) {
      const slPrices = withSL.map((p) => p.currentSL!);
      const firstSL = isLong ? Math.max(...slPrices) : Math.min(...slPrices);
      const lastSL = isLong ? Math.min(...slPrices) : Math.max(...slPrices);

      // Total SL loss
      const totalSLLoss = withSL.reduce((sum, p) => {
        const d = isLong ? 1 : -1;
        return sum + d * (p.currentSL! - (p.openPrice ?? 0)) * (p.lots ?? 0) * pv;
      }, 0);

      levels.push({
        price: firstSL,
        label: withSL.length > 1 ? "First SL" : "Stop Loss",
        sublabel: withSL.length > 1 ? `(of ${withSL.length})` : undefined,
        zone: "warning",
      });

      if (withSL.length > 1 && Math.abs(firstSL - lastSL) > avgEntry * 0.002) {
        levels.push({
          price: lastSL,
          label: "All SLs Hit",
          sublabel: `Loss: -$${Math.round(Math.abs(totalSLLoss)).toLocaleString()}`,
          zone: "danger",
        });
      }
    }

    // TP levels
    const withTP = group.filter((p) => p.currentTP !== null && (p.currentTP ?? 0) > 0);
    if (withTP.length > 0) {
      const tpPrices = withTP.map((p) => p.currentTP!);
      // LONG: first TP = lowest TP (nearest above current). SHORT: first TP = highest TP (nearest below current)
      const firstTP = isLong ? Math.min(...tpPrices) : Math.max(...tpPrices);

      const tpProfit = withTP.reduce((sum, p) => {
        const priceDiff = isLong
          ? (p.currentTP ?? 0) - (p.openPrice ?? 0)
          : (p.openPrice ?? 0) - (p.currentTP ?? 0);
        return sum + priceDiff * (p.lots ?? 0) * pv;
      }, 0);

      levels.push({
        price: firstTP,
        label: withTP.length > 1 ? "First TP" : "Take Profit",
        sublabel: `+$${Math.round(Math.abs(tpProfit)).toLocaleString()}`,
        zone: "profit",
      });
    }

    // Sort: highest to lowest (always — display inverts meaning for SHORT via gradient)
    levels.sort((a, b) => b.price - a.price);

    // Collision resolver: merge levels within 3% of total range
    if (levels.length >= 2) {
      const totalRange = levels[0].price - levels[levels.length - 1].price;
      if (totalRange > 0) {
        const minGap = totalRange * 0.03;
        const priority: Record<string, number> = {
          Current: 10, Breakeven: 9, "Half Profit": 8,
          "-10% Account": 7, "-20% Account": 7, "-50% Account": 7,
          "Stop Loss": 6, "First SL": 6, "All SLs Hit": 6,
          "Take Profit": 5, "First TP": 5, "Worst Entry": 3,
        };
        for (let i = 0; i < levels.length - 1; i++) {
          const gap = Math.abs(levels[i].price - levels[i + 1].price);
          if (gap < minGap) {
            const priA = priority[levels[i].label] ?? 0;
            const priB = priority[levels[i + 1].label] ?? 0;
            if (priA >= priB) {
              const bLabel = levels[i + 1].label.toLowerCase();
              levels[i].sublabel = levels[i].sublabel
                ? `${levels[i].sublabel} · near ${bLabel}`
                : `Near ${bLabel}`;
              levels.splice(i + 1, 1);
            } else {
              const aLabel = levels[i].label.toLowerCase();
              levels[i + 1].sublabel = levels[i + 1].sublabel
                ? `${levels[i + 1].sublabel} · near ${aLabel}`
                : `Near ${aLabel}`;
              levels.splice(i, 1);
            }
            i--;
          }
        }
      }
    }

    // Generate risk context insight
    const dpp = totalLots * pv;
    const insight = accountEquity && accountEquity > 0 && dpp > 0
      ? generateLadderInsight(curPrice, dpp, accountEquity, symbol, hasStopLoss, hiddenLossLevels)
      : undefined;

    ladders.push({
      symbol,
      direction: isLong ? "LONG" : "SHORT",
      levels,
      currentPrice: curPrice,
      avgEntry,
      totalLots,
      totalPnl,
      dollarsPerPoint: dpp,
      insight,
      hiddenLossLevels,
      tradeCount: group.length,
    });
  }

  // Sort ladders by total exposure descending — no limit, tabs handle display
  ladders.sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl));

  return ladders;
}

// ════════════════════════════════════════════
// Engine 15: Equity Curve Stats
// ════════════════════════════════════════════

export interface EquityDataPoint {
  timestamp: string; // ISO string
  balance: number;
  equity: number;
  isEstimated?: boolean;
  // External flow annotation for cash-flow-neutral chart adjustment
  externalFlowSigned?: number;
  isBalanceEventBoundary?: boolean;
}

export interface EquityCurveStats {
  currentEquity: number;
  currentBalance: number;
  peakEquity: number;
  peakTime: string;
  lowEquity: number;
  lowTime: string;
  floatingPL: number;
  floatingPct: number;
  maxDrawdownPct: number;
}

export interface NormalizedEquityPoint {
  timestamp: string;
  balanceChange: number;
  balanceChangePct: number;
  equityChange: number;
  equityChangePct: number;
  rawBalance: number;
  rawEquity: number;
  floatingPL: number;
  isEstimated?: boolean;
  isBalanceEventBoundary?: boolean;
}

/**
 * Normalize equity data relative to the starting balance of the period.
 * Both equity and balance are plotted as deviation from the first data point's balance.
 *
 * Cash-flow adjustment: If snapshots have externalFlowSigned annotations,
 * cumulative external flows are subtracted so deposits/withdrawals don't
 * appear as trading spikes/cliffs. Raw values are always preserved.
 */
export function normalizeEquityData(data: EquityDataPoint[]): NormalizedEquityPoint[] {
  if (data.length === 0) return [];

  const baseBalance = data[0].balance;
  if (baseBalance <= 0) return [];

  // Build cumulative external flow to adjust chart values
  let cumulativeFlow = 0;

  return data.map((d) => {
    cumulativeFlow += (d.externalFlowSigned ?? 0);
    // Adjusted values: raw minus cumulative external flows = trading-only
    const adjBalance = d.balance - cumulativeFlow;
    const adjEquity = d.equity - cumulativeFlow;

    return {
      timestamp: d.timestamp,
      balanceChange: adjBalance - baseBalance,
      balanceChangePct: ((adjBalance - baseBalance) / baseBalance) * 100,
      equityChange: adjEquity - baseBalance,
      equityChangePct: ((adjEquity - baseBalance) / baseBalance) * 100,
      rawBalance: d.balance,
      rawEquity: d.equity,
      floatingPL: d.equity - d.balance, // Floating P/L is always raw (equity - balance)
      isEstimated: d.isEstimated,
      isBalanceEventBoundary: d.isBalanceEventBoundary,
    };
  });
}

export interface NormalizedEquityStats {
  currentEquityChange: number;
  currentEquityChangePct: number;
  currentBalanceChange: number;
  currentBalanceChangePct: number;
  peakEquityChange: number;
  peakEquityChangePct: number;
  peakTime: string;
  lowEquityChange: number;
  lowEquityChangePct: number;
  lowTime: string;
  floatingPL: number;
  floatingPct: number;
  baselineBalance: number;
}

export function computeEquityCurveStats(data: EquityDataPoint[]): NormalizedEquityStats | null {
  if (data.length === 0) return null;

  const baseBalance = data[0].balance;
  if (baseBalance <= 0) return null;

  // Build cumulative flow array for cash-flow-neutral stats
  const cumFlows: number[] = [];
  let cumFlow = 0;
  for (const d of data) {
    cumFlow += (d.externalFlowSigned ?? 0);
    cumFlows.push(cumFlow);
  }

  // Adjusted values: raw - cumulativeFlow = trading-only
  const lastIdx = data.length - 1;
  const adjCurrentEquity = data[lastIdx].equity - cumFlows[lastIdx];
  const adjCurrentBalance = data[lastIdx].balance - cumFlows[lastIdx];
  const currentEqChange = adjCurrentEquity - baseBalance;

  // Find peak and low from adjusted equity series
  let peakIdx = 0;
  let lowIdx = 0;
  for (let i = 1; i < data.length; i++) {
    const adjEq = data[i].equity - cumFlows[i];
    const peakAdjEq = data[peakIdx].equity - cumFlows[peakIdx];
    const lowAdjEq = data[lowIdx].equity - cumFlows[lowIdx];
    if (adjEq - baseBalance > peakAdjEq - baseBalance) peakIdx = i;
    if (adjEq - baseBalance < lowAdjEq - baseBalance) lowIdx = i;
  }

  const adjPeakEq = data[peakIdx].equity - cumFlows[peakIdx];
  const adjLowEq = data[lowIdx].equity - cumFlows[lowIdx];

  // Floating P/L is raw (equity - balance at current moment)
  const floating = data[lastIdx].equity - data[lastIdx].balance;

  return {
    currentEquityChange: currentEqChange,
    currentEquityChangePct: (currentEqChange / baseBalance) * 100,
    currentBalanceChange: adjCurrentBalance - baseBalance,
    currentBalanceChangePct: ((adjCurrentBalance - baseBalance) / baseBalance) * 100,
    peakEquityChange: adjPeakEq - baseBalance,
    peakEquityChangePct: ((adjPeakEq - baseBalance) / baseBalance) * 100,
    peakTime: data[peakIdx].timestamp,
    lowEquityChange: adjLowEq - baseBalance,
    lowEquityChangePct: ((adjLowEq - baseBalance) / baseBalance) * 100,
    lowTime: data[lowIdx].timestamp,
    floatingPL: floating,
    floatingPct: data[lastIdx].balance > 0 ? (floating / data[lastIdx].balance) * 100 : 0,
    baselineBalance: baseBalance,
  };
}
