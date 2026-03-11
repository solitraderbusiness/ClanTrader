import { describe, it, expect } from "vitest";
import {
  computeStateAssessment,
  computeStateMetrics,
  createDigestSnapshot,
  createDigestSnapshotV2,
  computeDeltas,
  generateAlerts,
  generateActions,
  computeMemberImpactScore,
  getMemberImpactLabel,
  computeConcentration,
  computeRiskBudget,
  computeMemberTrend,
  computePredictiveHints,
  type AlertMemberInput,
  type DigestSnapshot,
  type StateMetrics,
} from "../digest-engines";

// ─── Helpers ───

function makeHealthResult(overrides: Partial<{
  overall: string;
  protectionStatus: string;
  rComputable: boolean;
  trackingStatus: string;
}> = {}) {
  return {
    health: {
      overall: overrides.overall ?? "HEALTHY",
      protectionStatus: overrides.protectionStatus ?? "PROTECTED",
    },
    rComputable: overrides.rComputable ?? true,
    trackingStatus: overrides.trackingStatus ?? "ACTIVE",
  };
}

function makeAlertMember(overrides: Partial<AlertMemberInput> = {}): AlertMemberInput {
  return {
    userId: "u1",
    name: "Alice",
    openTradeCount: 3,
    needActionCount: 0,
    unknownRiskCount: 0,
    unprotectedCount: 0,
    trackingLostCount: 0,
    staleCount: 0,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<DigestSnapshot> = {}): DigestSnapshot {
  return {
    openPnl: 100,
    realizedPnl: 50,
    realizedR: 2,
    needActionCount: 1,
    unknownRiskCount: 2,
    unprotectedCount: 1,
    trackingLostTradeCount: 0,
    staleTradeCount: 0,
    activeAccountCount: 2,
    closedCount: 5,
    openTradeCount: 4,
    confidenceScore: 80,
    safetyScore: 75,
    ts: Date.now() - 60000,
    ...overrides,
  };
}

// ═══════════════════════════════════════════
// ENGINE 1: STATE ASSESSMENT
// ═══════════════════════════════════════════

describe("computeStateAssessment", () => {
  it("returns SAFE/HIGH for zero open trades", () => {
    const result = computeStateAssessment({
      openHealthResults: [],
      trackingSummary: { activeAccounts: 1, staleAccounts: 0, lostAccounts: 0 },
    });
    expect(result.safetyScore).toBe(100);
    expect(result.safetyBand).toBe("SAFE");
    expect(result.confidenceScore).toBe(100);
    expect(result.confidenceBand).toBe("HIGH");
  });

  it("computes correct scores for healthy trades", () => {
    const result = computeStateAssessment({
      openHealthResults: [makeHealthResult(), makeHealthResult()],
      trackingSummary: { activeAccounts: 1, staleAccounts: 0, lostAccounts: 0 },
    });
    expect(result.safetyBand).toBe("SAFE");
    expect(result.confidenceBand).toBe("HIGH");
    expect(result.safetyScore).toBeGreaterThanOrEqual(80);
  });

  it("drops safety when trades are unprotected", () => {
    const result = computeStateAssessment({
      openHealthResults: [
        makeHealthResult({ protectionStatus: "UNPROTECTED", overall: "AT_RISK" }),
        makeHealthResult({ protectionStatus: "UNPROTECTED", overall: "AT_RISK" }),
      ],
      trackingSummary: { activeAccounts: 1, staleAccounts: 0, lostAccounts: 0 },
    });
    expect(result.safetyScore).toBeLessThan(80);
    expect(result.metrics.unprotectedCount).toBe(2);
    expect(result.metrics.needActionCount).toBe(2);
  });

  it("drops confidence when tracking is lost", () => {
    const result = computeStateAssessment({
      openHealthResults: [
        makeHealthResult({ trackingStatus: "TRACKING_LOST", rComputable: false }),
      ],
      trackingSummary: { activeAccounts: 0, staleAccounts: 0, lostAccounts: 1 },
    });
    expect(result.confidenceScore).toBeLessThan(65);
    expect(result.metrics.trackingLostTradeCount).toBe(1);
  });
});

describe("computeStateMetrics", () => {
  it("counts all metric dimensions correctly", () => {
    const m = computeStateMetrics({
      openHealthResults: [
        makeHealthResult({ overall: "AT_RISK", protectionStatus: "UNPROTECTED" }),
        makeHealthResult({ rComputable: false, protectionStatus: "UNKNOWN_RISK" }),
        makeHealthResult({ trackingStatus: "TRACKING_LOST" }),
        makeHealthResult({ trackingStatus: "STALE" }),
        makeHealthResult(),
      ],
      trackingSummary: { activeAccounts: 2, staleAccounts: 1, lostAccounts: 1 },
    });
    expect(m.openTradeCount).toBe(5);
    expect(m.needActionCount).toBe(1);
    expect(m.unknownRiskCount).toBe(1);
    expect(m.unprotectedCount).toBe(1);
    expect(m.trackingLostTradeCount).toBe(1);
    expect(m.staleTradeCount).toBe(1);
    expect(m.activeAccountCount).toBe(2);
    expect(m.totalAccountCount).toBe(4);
    expect(m.knownRiskTradeCount).toBe(4);
    expect(m.trustedTrackedTradeCount).toBe(2);
  });
});

// ═══════════════════════════════════════════
// ENGINE 2: DELTA
// ═══════════════════════════════════════════

describe("createDigestSnapshot / createDigestSnapshotV2", () => {
  const cockpit = { totalFloatingPnl: 100, realizedPnl: 50, realizedR: 2, closedCount: 3 };
  const assessment = computeStateAssessment({
    openHealthResults: [makeHealthResult()],
    trackingSummary: { activeAccounts: 1, staleAccounts: 0, lostAccounts: 0 },
  });

  it("creates snapshot with correct shape", () => {
    const snap = createDigestSnapshot(cockpit, assessment);
    expect(snap.openPnl).toBe(100);
    expect(snap.realizedPnl).toBe(50);
    expect(snap.closedCount).toBe(3);
    expect(snap.ts).toBeGreaterThan(0);
  });

  it("createDigestSnapshotV2 includes member metrics", () => {
    const memberData = { u1: { needAction: 1, unknownRisk: 0, trackingLost: 0, unprotected: 0, openCount: 2 } };
    const snap = createDigestSnapshotV2(cockpit, assessment, memberData);
    expect(snap.memberMetrics).toBeDefined();
    expect(snap.memberMetrics?.u1.needAction).toBe(1);
  });
});

describe("computeDeltas", () => {
  it("returns null when no previous snapshot", () => {
    expect(computeDeltas(makeSnapshot(), null)).toBeNull();
  });

  it("returns null when no changes", () => {
    const snap = makeSnapshot();
    expect(computeDeltas(snap, { ...snap })).toBeNull();
  });

  it("computes good direction for openPnl increase", () => {
    const current = makeSnapshot({ openPnl: 200 });
    const previous = makeSnapshot({ openPnl: 100 });
    const deltas = computeDeltas(current, previous);
    expect(deltas).not.toBeNull();
    const pnlDelta = deltas!.find(d => d.metric === "openPnl");
    expect(pnlDelta?.direction).toBe("good");
    expect(pnlDelta?.delta).toBe(100);
  });

  it("computes bad direction for needActionCount increase", () => {
    const current = makeSnapshot({ needActionCount: 5 });
    const previous = makeSnapshot({ needActionCount: 2 });
    const deltas = computeDeltas(current, previous);
    const d = deltas!.find(d => d.metric === "needActionCount");
    expect(d?.direction).toBe("bad");
    expect(d?.delta).toBe(3);
  });

  it("computes good direction for needActionCount decrease", () => {
    const current = makeSnapshot({ needActionCount: 1 });
    const previous = makeSnapshot({ needActionCount: 3 });
    const deltas = computeDeltas(current, previous);
    const d = deltas!.find(d => d.metric === "needActionCount");
    expect(d?.direction).toBe("good");
  });
});

// ═══════════════════════════════════════════
// ENGINE 3: ALERTS
// ═══════════════════════════════════════════

describe("generateAlerts", () => {
  const baseAssessment = computeStateAssessment({
    openHealthResults: [
      makeHealthResult({ protectionStatus: "UNPROTECTED" }),
      makeHealthResult({ rComputable: false, protectionStatus: "UNKNOWN_RISK" }),
    ],
    trackingSummary: { activeAccounts: 1, staleAccounts: 0, lostAccounts: 0 },
  });

  it("generates unprotected and unknown risk alerts", () => {
    const alerts = generateAlerts(baseAssessment, []);
    const types = alerts.map(a => a.type);
    expect(types).toContain("unprotected_trade");
    expect(types).toContain("unknown_risk_trade");
  });

  it("generates per-member tracking lost alert", () => {
    const members = [makeAlertMember({ trackingLostCount: 2 })];
    const alerts = generateAlerts(baseAssessment, members);
    const lost = alerts.find(a => a.type === "tracking_lost_with_exposure");
    expect(lost).toBeDefined();
    expect(lost!.affectedMember).toBe("Alice");
    expect(lost!.issueCount).toBe(2);
  });

  it("generates high trade cluster alert when threshold exceeded", () => {
    const members = [makeAlertMember({ openTradeCount: 8 })];
    const alerts = generateAlerts(baseAssessment, members);
    expect(alerts.find(a => a.type === "high_open_trade_cluster")).toBeDefined();
  });

  it("generates concentration alert for clusters", () => {
    const clusters = [{
      instrument: "XAUUSD", direction: "LONG", tradeCount: 4,
      memberCount: 2, members: ["Alice", "Bob"],
      totalFloatingR: 1.5, totalRiskToSLR: -2,
    }];
    const alerts = generateAlerts(baseAssessment, [], null, clusters);
    const conc = alerts.find(a => a.type === "concentration_risk");
    expect(conc).toBeDefined();
    expect(conc!.affectedMember).toBe("XAUUSD LONG");
  });

  it("sorts by severity descending", () => {
    const members = [makeAlertMember({ trackingLostCount: 3, staleCount: 1 })];
    const alerts = generateAlerts(baseAssessment, members);
    for (let i = 1; i < alerts.length; i++) {
      expect(alerts[i - 1].severityScore).toBeGreaterThanOrEqual(alerts[i].severityScore);
    }
  });

  it("adds worsening modifier when previous snapshot shows lower count", () => {
    const prev = makeSnapshot({ unprotectedCount: 0 });
    const alerts = generateAlerts(baseAssessment, [], prev);
    const unp = alerts.find(a => a.type === "unprotected_trade");
    // base 68 + 1*4 + 10 worsening = 82
    expect(unp!.severityScore).toBeGreaterThanOrEqual(82);
  });
});

// ═══════════════════════════════════════════
// ENGINE 4: ACTIONS
// ═══════════════════════════════════════════

describe("generateActions", () => {
  it("returns max 3 actions", () => {
    const alerts = Array.from({ length: 5 }, (_, i) => ({
      id: String(i), type: "unprotected_trade" as const,
      affectedMember: null, affectedMemberId: null,
      issueCount: 2, severityScore: 70 - i, severityBand: "HIGH" as const,
    }));
    expect(generateActions(alerts).length).toBe(3);
  });

  it("sorts by priority descending", () => {
    const alerts = [
      { id: "1", type: "unprotected_trade" as const, affectedMember: null, affectedMemberId: null, issueCount: 1, severityScore: 60, severityBand: "MEDIUM" as const },
      { id: "2", type: "tracking_lost_with_exposure" as const, affectedMember: "Alice", affectedMemberId: "u1", issueCount: 3, severityScore: 90, severityBand: "CRITICAL" as const },
    ];
    expect(generateActions(alerts)[0].alertType).toBe("tracking_lost_with_exposure");
  });

  it("returns empty for no alerts", () => {
    expect(generateActions([])).toEqual([]);
  });
});

// ═══════════════════════════════════════════
// ENGINE 5: MEMBER IMPACT
// ═══════════════════════════════════════════

describe("computeMemberImpactScore", () => {
  it("returns 0 when clan has no open trades", () => {
    const totals: StateMetrics = {
      openTradeCount: 0, needActionCount: 0, unknownRiskCount: 0,
      unprotectedCount: 0, trackingLostTradeCount: 0, staleTradeCount: 0,
      activeAccountCount: 1, totalAccountCount: 1,
      knownRiskTradeCount: 0, trustedTrackedTradeCount: 0,
    };
    expect(computeMemberImpactScore(makeAlertMember(), totals)).toBe(0);
  });

  it("gives high score to member causing all issues", () => {
    const member = makeAlertMember({ needActionCount: 5, unknownRiskCount: 3, trackingLostCount: 2 });
    const totals: StateMetrics = {
      openTradeCount: 10, needActionCount: 5, unknownRiskCount: 3,
      unprotectedCount: 0, trackingLostTradeCount: 2, staleTradeCount: 0,
      activeAccountCount: 2, totalAccountCount: 2,
      knownRiskTradeCount: 7, trustedTrackedTradeCount: 8,
    };
    expect(computeMemberImpactScore(member, totals)).toBeGreaterThanOrEqual(60);
  });

  it("excludes zero-total dimensions", () => {
    const member = makeAlertMember({ openTradeCount: 3 });
    const totals: StateMetrics = {
      openTradeCount: 10, needActionCount: 0, unknownRiskCount: 0,
      unprotectedCount: 0, trackingLostTradeCount: 0, staleTradeCount: 0,
      activeAccountCount: 2, totalAccountCount: 2,
      knownRiskTradeCount: 10, trustedTrackedTradeCount: 10,
    };
    expect(computeMemberImpactScore(member, totals)).toBe(30);
  });
});

describe("getMemberImpactLabel", () => {
  it("returns tracking degraded for high score with tracking lost", () => {
    expect(getMemberImpactLabel(60, makeAlertMember({ trackingLostCount: 1 }))).toBe("digest.impact.trackingDegraded");
  });

  it("returns high unknown risk for score 50+ with unknown risk", () => {
    expect(getMemberImpactLabel(50, makeAlertMember({ unknownRiskCount: 2 }))).toBe("digest.impact.highUnknownRisk");
  });

  it("returns null for low score", () => {
    expect(getMemberImpactLabel(20, makeAlertMember())).toBeNull();
  });
});

// ═══════════════════════════════════════════
// ENGINE 6: CONCENTRATION
// ═══════════════════════════════════════════

describe("computeConcentration", () => {
  it("groups positions by instrument+direction", () => {
    const positions = [
      { instrument: "XAUUSD", direction: "LONG", memberName: "Alice", floatingR: 1, riskToSLR: -1 },
      { instrument: "XAUUSD", direction: "LONG", memberName: "Bob", floatingR: 0.5, riskToSLR: -1 },
      { instrument: "XAUUSD", direction: "LONG", memberName: "Alice", floatingR: -0.3, riskToSLR: -1 },
    ];
    const clusters = computeConcentration(positions);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].tradeCount).toBe(3);
    expect(clusters[0].memberCount).toBe(2);
    expect(clusters[0].totalFloatingR).toBe(1.2);
    expect(clusters[0].totalRiskToSLR).toBe(-3);
  });

  it("excludes clusters below threshold", () => {
    const positions = [
      { instrument: "EURUSD", direction: "SHORT", memberName: "Alice", floatingR: 1, riskToSLR: -1 },
      { instrument: "EURUSD", direction: "SHORT", memberName: "Bob", floatingR: 0.5, riskToSLR: -1 },
    ];
    expect(computeConcentration(positions)).toHaveLength(0);
  });

  it("returns empty for no positions", () => {
    expect(computeConcentration([])).toEqual([]);
  });
});

// ═══════════════════════════════════════════
// ENGINE 7: RISK BUDGET
// ═══════════════════════════════════════════

describe("computeRiskBudget", () => {
  it("returns null for zero open trades", () => {
    expect(computeRiskBudget({ currentOpenRiskR: -2, totalEquity: 10000, totalBalance: 10000, openTradeCount: 0 })).toBeNull();
  });

  it("returns null when risk is null", () => {
    expect(computeRiskBudget({ currentOpenRiskR: null, totalEquity: 10000, totalBalance: 10000, openTradeCount: 3 })).toBeNull();
  });

  it("assigns LOW band for small risk", () => {
    expect(computeRiskBudget({ currentOpenRiskR: -2, totalEquity: null, totalBalance: null, openTradeCount: 2 })!.riskBudgetBand).toBe("LOW");
  });

  it("assigns MODERATE band for medium risk", () => {
    expect(computeRiskBudget({ currentOpenRiskR: -4, totalEquity: null, totalBalance: null, openTradeCount: 4 })!.riskBudgetBand).toBe("MODERATE");
  });

  it("assigns CRITICAL band for very high risk", () => {
    expect(computeRiskBudget({ currentOpenRiskR: -12, totalEquity: null, totalBalance: null, openTradeCount: 6 })!.riskBudgetBand).toBe("CRITICAL");
  });
});

// ═══════════════════════════════════════════
// ENGINE 8: MEMBER TREND
// ═══════════════════════════════════════════

describe("computeMemberTrend", () => {
  it("returns 'new' when no previous data", () => {
    expect(computeMemberTrend({ needAction: 1, unknownRisk: 0, trackingLost: 0, unprotected: 0, openCount: 3 }, null)).toBe("new");
  });

  it("returns 'improving' when bad metrics decreased", () => {
    expect(computeMemberTrend(
      { needAction: 0, unknownRisk: 0, trackingLost: 0, unprotected: 0, openCount: 3 },
      { needAction: 2, unknownRisk: 1, trackingLost: 0, unprotected: 0, openCount: 3 },
    )).toBe("improving");
  });

  it("returns 'declining' when bad metrics increased", () => {
    expect(computeMemberTrend(
      { needAction: 3, unknownRisk: 2, trackingLost: 1, unprotected: 0, openCount: 3 },
      { needAction: 1, unknownRisk: 0, trackingLost: 0, unprotected: 0, openCount: 3 },
    )).toBe("declining");
  });

  it("returns 'stable' when no change", () => {
    const d = { needAction: 1, unknownRisk: 0, trackingLost: 0, unprotected: 0, openCount: 3 };
    expect(computeMemberTrend(d, { ...d })).toBe("stable");
  });
});

// ═══════════════════════════════════════════
// ENGINE 9: PREDICTIVE HINTS
// ═══════════════════════════════════════════

describe("computePredictiveHints", () => {
  it("returns empty when no previous snapshot", () => {
    expect(computePredictiveHints(makeSnapshot(), null, null)).toEqual([]);
  });

  it("detects rapid safety score drop", () => {
    const current = makeSnapshot({ safetyScore: 50 });
    const previous = makeSnapshot({ safetyScore: 65 });
    const deltas = computeDeltas(current, previous);
    const hints = computePredictiveHints(current, previous, deltas);
    expect(hints.find(h => h.hintKey === "digest.hint.rapidSafetyDrop")).toBeDefined();
  });

  it("detects growing unknown risk", () => {
    const current = makeSnapshot({ unknownRiskCount: 6 });
    const previous = makeSnapshot({ unknownRiskCount: 3 });
    const deltas = computeDeltas(current, previous);
    const hints = computePredictiveHints(current, previous, deltas);
    expect(hints.find(h => h.hintKey === "digest.hint.unknownRiskGrowing")).toBeDefined();
  });

  it("does not hint when metrics are good", () => {
    const current = makeSnapshot({ safetyScore: 85, unknownRiskCount: 0 });
    const previous = makeSnapshot({ safetyScore: 80, unknownRiskCount: 1 });
    const deltas = computeDeltas(current, previous);
    expect(computePredictiveHints(current, previous, deltas)).toHaveLength(0);
  });
});
