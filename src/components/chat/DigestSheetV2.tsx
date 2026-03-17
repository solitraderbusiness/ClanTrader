"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  ClipboardList,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Shield,
  ShieldOff,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  User,
  Users,
  Target,
  Activity,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ClanDigestData, DigestPeriod } from "@/types/clan-digest";
import type {
  DigestV2Response,
  OpenPositionV2,
  ClosedTradeV2,
  MemberStatsV2,
} from "@/lib/digest-v2-schema";
import type {
  OverallHealth,
  AttentionSeverity,
} from "@/lib/open-trade-health";
import {
  computeStateAssessment,
  computeConcentration,
  generateAlerts,
  generateActions,
  computeRiskBudget,
  computeEntryInsights,
  computeScalingInsights,
  computeConcentrationSummary,
  computeSmartActions,
  computePriceLadder,
  computeEquityCurveStats,
  normalizeEquityData,
  type SafetyBand,
  type ConfidenceBand,
  type DigestDelta,
  type ActionItem,
  type AlertMemberInput,
  type EntryClusterInsight,
  type SmartAction,
  type RiskBudgetBand,
  type MemberTrend,
  type PriceLadderData,
  type PriceLadderLevel,
  type EquityDataPoint,
  type NormalizedEquityStats,
} from "@/lib/digest-engines";

interface DigestSheetV2Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clanId: string;
}

const PERIODS: { value: DigestPeriod; labelKey: string }[] = [
  { value: "today", labelKey: "digest.today" },
  { value: "week", labelKey: "digest.thisWeek" },
  { value: "month", labelKey: "digest.thisMonth" },
];

// ─── Style Maps ───

const HEALTH_COLORS: Record<OverallHealth, { bg: string; text: string; border: string }> = {
  HEALTHY: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30" },
  NEEDS_REVIEW: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" },
  AT_RISK: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  BROKEN_PLAN: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
  LOW_CONFIDENCE: { bg: "bg-gray-500/10", text: "text-gray-500 dark:text-gray-400", border: "border-gray-500/30" },
};

const SEVERITY_ACCENT: Record<AttentionSeverity, string> = {
  CRITICAL: "border-s-red-500",
  WARNING: "border-s-yellow-500",
  INFO: "border-s-blue-500",
};

const SAFETY_STYLES: Record<SafetyBand, { text: string; border: string; bar: string; dot: string }> = {
  SAFE: { text: "text-green-600 dark:text-green-400", border: "border-green-500/30", bar: "bg-green-500", dot: "bg-green-500" },
  WATCH: { text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30", bar: "bg-yellow-500", dot: "bg-yellow-500" },
  AT_RISK: { text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30", bar: "bg-orange-500", dot: "bg-orange-500" },
  CRITICAL: { text: "text-red-600 dark:text-red-400", border: "border-red-500/30", bar: "bg-red-500", dot: "bg-red-500" },
};

const CONFIDENCE_STYLES: Record<ConfidenceBand, { text: string }> = {
  HIGH: { text: "text-green-600 dark:text-green-400" },
  MODERATE: { text: "text-yellow-600 dark:text-yellow-400" },
  LOW: { text: "text-orange-600 dark:text-orange-400" },
  DEGRADED: { text: "text-red-600 dark:text-red-400" },
};

const RISK_BUDGET_STYLES: Record<RiskBudgetBand, { bar: string; text: string }> = {
  LOW: { bar: "bg-green-500", text: "text-green-600 dark:text-green-400" },
  MODERATE: { bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" },
  HIGH: { bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  CRITICAL: { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
};

// ─── Formatting Helpers ───

function fmtPnl(v: number | null): string {
  if (v === null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}

function fmtR(v: number | null): string {
  if (v === null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}R`;
}

function fmtCurrency(v: number): string {
  const sign = v >= 0 ? "+" : "";
  if (Math.abs(v) >= 1000) {
    return `${sign}$${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  return `${sign}$${v.toFixed(2)}`;
}

function pnlColor(v: number | null): string {
  if (v === null) return "text-muted-foreground";
  return v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function holdDuration(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}

function getAction(
  reasons: string[],
  overall: string,
  t: (key: string) => string
): string | null {
  if (reasons.includes("TRACKING_LOST")) return t("digest.action.verifyConnection");
  if (reasons.includes("INVALIDATED")) return t("digest.action.considerClosing");
  if (reasons.includes("NO_VALID_SL")) return t("digest.action.addStopLoss");
  if (reasons.includes("SL_WIDENED")) return t("digest.action.reviewSL");
  if (reasons.includes("WINNER_NOT_PROTECTED")) return t("digest.action.lockProfit");
  if (reasons.includes("NEAR_INVALIDATION")) return t("digest.action.monitorClosely");
  if (reasons.includes("UNPROTECTED") && overall !== "HEALTHY") return t("digest.action.reviewProtection");
  if (reasons.includes("R_NOT_COMPUTABLE")) return t("digest.action.verifyRisk");
  return null;
}

// ─── Position Grouping ───

interface PositionGroup {
  instrument: string;
  direction: string;
  positions: OpenPositionV2[];
  totalLots: number;
  totalPnl: number;
  avgEntry: number | null;
}

function groupPositionsBySymbol(positions: OpenPositionV2[]): PositionGroup[] {
  const map = new Map<string, PositionGroup>();
  for (const p of positions) {
    const key = `${p.instrument}:${p.direction}`;
    let g = map.get(key);
    if (!g) {
      g = { instrument: p.instrument, direction: p.direction, positions: [], totalLots: 0, totalPnl: 0, avgEntry: null };
      map.set(key, g);
    }
    g.positions.push(p);
    g.totalLots += p.lots ?? 0;
    g.totalPnl += p.floatingPnl ?? 0;
  }
  // Compute weighted avg entry per group
  for (const g of map.values()) {
    let totalLotPrice = 0;
    let totalLots = 0;
    for (const p of g.positions) {
      if (p.openPrice != null && p.lots != null && p.lots > 0) {
        totalLotPrice += p.openPrice * p.lots;
        totalLots += p.lots;
      }
    }
    g.avgEntry = totalLots > 0 ? Math.round((totalLotPrice / totalLots) * 100000) / 100000 : null;
  }
  return Array.from(map.values()).sort((a, b) => Math.abs(b.totalPnl) - Math.abs(a.totalPnl));
}

// ─── Scope Types ───

type DigestScope = "trader" | "clan";

function buildTraderView(data: DigestV2Response): DigestV2Response | null {
  const myId = data.currentUserId;
  if (!myId) return null;

  const myMember = data.members.find((m) => m.userId === myId);
  if (!myMember) return null;

  const hasActive = myMember.openPositions.some((p) => p.trackingStatus === "ACTIVE");
  const hasStale = myMember.openPositions.some((p) => p.trackingStatus === "STALE");
  const hasLost = myMember.openPositions.some((p) => p.trackingStatus === "TRACKING_LOST");

  const traderState = computeStateAssessment({
    openHealthResults: myMember.openPositions.map((p) => ({
      health: p.health,
      rComputable: p.rComputable,
      trackingStatus: p.trackingStatus,
    })),
    trackingSummary: {
      activeAccounts: hasActive ? 1 : 0,
      staleAccounts: hasStale ? 1 : 0,
      lostAccounts: hasLost ? 1 : 0,
    },
  });

  const traderCockpit: DigestV2Response["cockpit"] = {
    totalFloatingPnl: myMember.memberFloatingPnl,
    totalFloatingR: myMember.memberFloatingR,
    computableRCount: myMember.openPositions.filter((p) => p.rComputable).length,
    nonComputableRCount: myMember.openPositions.filter((p) => !p.rComputable).length,
    currentOpenRiskR: myMember.memberRiskToSLR,
    unknownRiskCount: myMember.memberUnknownRiskCount,
    tradesNeedingAction: myMember.memberActionsNeeded,
    liveConfidence:
      traderState.confidenceBand === "HIGH" ? "HIGH" :
      traderState.confidenceBand === "MODERATE" ? "PARTIAL" : "LOW",
    realizedPnl: null,
    realizedR: myMember.closedTrades.length > 0 ? myMember.totalR : null,
    closedCount: myMember.closedTrades.length,
    officialWinRate: myMember.winRate > 0 ? myMember.winRate : null,
    officialCount: myMember.closedTrades.filter((t) => t.isOfficial).length,
    unofficialCount: myMember.closedTrades.filter((t) => !t.isOfficial).length,
  };

  const traderConcentration = computeConcentration(
    myMember.openPositions.map((p) => ({
      instrument: p.instrument,
      direction: p.direction,
      memberName: myMember.name,
      floatingR: p.floatingR,
      riskToSLR: p.riskToSLR,
    }))
  );

  const traderMemberInput: AlertMemberInput = {
    userId: myMember.userId,
    name: myMember.name,
    openTradeCount: myMember.openCount,
    needActionCount: myMember.memberActionsNeeded,
    unknownRiskCount: myMember.memberUnknownRiskCount,
    unprotectedCount: myMember.memberUnprotectedCount,
    trackingLostCount: myMember.memberTrackingLostCount,
    staleCount: myMember.memberStaleCount,
  };
  const traderAlerts = generateAlerts(traderState, [traderMemberInput], null, traderConcentration);
  const traderActions = generateActions(traderAlerts);

  const traderRiskBudget = computeRiskBudget({
    currentOpenRiskR: myMember.memberRiskToSLR,
    totalEquity: data.riskBudget?.totalEquity ?? null,
    totalBalance: data.riskBudget?.totalBalance ?? null,
    openTradeCount: myMember.openCount,
  });

  const traderAttention = data.attentionQueue.filter((a) => a.userId === myId);

  const traderTracking = {
    activeAccounts: hasActive ? 1 : 0,
    staleAccounts: hasStale ? 1 : 0,
    lostAccounts: hasLost ? 1 : 0,
  };

  const traderLiveHealth: DigestV2Response["liveHealthSummary"] = {
    healthyPositions: myMember.openPositions.filter((p) => p.health.overall === "HEALTHY").length,
    needsReviewPositions: myMember.openPositions.filter((p) => p.health.overall === "NEEDS_REVIEW").length,
    atRiskPositions: myMember.openPositions.filter((p) => p.health.overall === "AT_RISK").length,
    brokenPlanPositions: myMember.openPositions.filter((p) => p.health.overall === "BROKEN_PLAN").length,
    lowConfidencePositions: myMember.openPositions.filter((p) => p.health.overall === "LOW_CONFIDENCE").length,
    unknownRiskPositions: myMember.openPositions.filter((p) => p.health.protectionStatus === "UNKNOWN_RISK").length,
    unprotectedPositions: myMember.openPositions.filter((p) => p.health.protectionStatus === "UNPROTECTED").length,
    fragileWinnerPositions: myMember.openPositions.filter((p) => p.health.profitProtection === "FRAGILE_WINNER").length,
  };

  const traderSummary: DigestV2Response["summary"] = {
    totalCards: myMember.signalCount + myMember.analysisCount,
    totalSignals: myMember.signalCount,
    totalAnalysis: myMember.analysisCount,
    tpHit: myMember.tpHit,
    slHit: myMember.slHit,
    be: myMember.be,
    openCount: myMember.openCount,
    winRate: myMember.winRate,
    totalR: myMember.totalR,
    avgR: myMember.avgR,
    activeMemberCount: 1,
  };

  const traderEntryInsights = computeEntryInsights(
    myMember.openPositions.map((p) => ({
      instrument: p.instrument,
      direction: p.direction,
      openPrice: p.openPrice ?? null,
      lots: p.lots ?? null,
      floatingPnl: p.floatingPnl,
      accountLabel: p.accountLabel,
    }))
  );

  const traderScalingInsights = computeScalingInsights(
    myMember.openPositions.map((p) => ({
      instrument: p.instrument,
      direction: p.direction,
      openPrice: p.openPrice ?? null,
      lots: p.lots ?? null,
      createdAt: p.createdAt,
    }))
  );

  const traderConcentrationSummary = computeConcentrationSummary(
    myMember.openPositions.map((p) => ({
      instrument: p.instrument,
      direction: p.direction,
      accountLabel: p.accountLabel,
    }))
  );

  return {
    ...data,
    cockpit: traderCockpit,
    stateAssessment: traderState,
    members: [myMember],
    attentionQueue: traderAttention,
    alerts: traderAlerts,
    actions: traderActions,
    concentration: traderConcentration,
    riskBudget: traderRiskBudget,
    accountBalance: data.accountBalance ?? null,
    trackingSummary: traderTracking,
    liveHealthSummary: traderLiveHealth,
    summary: traderSummary,
    deltas: data.traderDeltas ?? null,
    hints: data.traderHints ?? [],
    entryInsights: traderEntryInsights,
    scalingInsights: traderScalingInsights,
    concentrationSummary: traderConcentrationSummary,
  };
}

// ─── Main Component ───

export function DigestSheetV2({ open, onOpenChange, clanId }: DigestSheetV2Props) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<DigestPeriod>("today");
  const [v1Data, setV1Data] = useState<ClanDigestData | null>(null);
  const [v2Data, setV2Data] = useState<DigestV2Response | null>(null);
  const [isV2, setIsV2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<DigestScope>("trader");

  const fetchDigest = useCallback(
    async (p: DigestPeriod) => {
      setLoading(true);
      setV1Data(null);
      setV2Data(null);
      try {
        const tz = new Date().getTimezoneOffset();
        const res = await fetch(`/api/clans/${clanId}/digest?period=${p}&tz=${tz}`);
        if (res.ok) {
          const json = await res.json();
          if (json.version === 2) {
            setV2Data(json as DigestV2Response);
            setIsV2(true);
          } else {
            setV1Data(json as ClanDigestData);
            setIsV2(false);
          }
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    },
    [clanId]
  );

  useEffect(() => {
    if (open) {
      fetchDigest(period);
      setExpandedMembers(new Set());
      setExpandedTrades(new Set());
    }
  }, [open, period, fetchDigest]);

  function toggleMember(userId: string) {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleTrade(tradeId: string) {
    setExpandedTrades((prev) => {
      const next = new Set(prev);
      if (next.has(tradeId)) next.delete(tradeId);
      else next.add(tradeId);
      return next;
    });
  }

  const traderView = useMemo(() => {
    if (!v2Data) return null;
    return buildTraderView(v2Data);
  }, [v2Data]);

  const effectiveV2Data = scope === "trader" ? traderView : v2Data;

  const hasData = isV2
    ? scope === "trader"
      ? traderView !== null && (traderView.summary.totalCards > 0 || traderView.summary.openCount > 0)
      : v2Data && (v2Data.summary.totalCards > 0 || v2Data.summary.openCount > 0)
    : v1Data && v1Data.summary.totalCards > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col overflow-hidden sm:max-w-lg">
        <SheetHeader className="shrink-0">
          <div className="flex items-center justify-between pe-10">
            <SheetTitle className="text-lg font-bold">{t("digest.title")}</SheetTitle>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => fetchDigest(period)}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </SheetHeader>

        {/* Scope switcher */}
        <div className="mt-3 flex shrink-0 rounded-lg bg-muted/50 p-1">
          <button
            type="button"
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              scope === "trader"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setScope("trader")}
          >
            <User className="h-3.5 w-3.5" />
            {t("digest.scope.trader")}
          </button>
          <button
            type="button"
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
              scope === "clan"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setScope("clan")}
          >
            <Users className="h-3.5 w-3.5" />
            {t("digest.scope.clan")}
          </button>
        </div>

        {/* Period selector */}
        <div className="mt-2 flex shrink-0 rounded-lg bg-muted/50 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                period === p.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setPeriod(p.value)}
              disabled={loading}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex-1 overflow-y-auto pb-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && !hasData && (
            <EmptyState
              icon={ClipboardList}
              title={t("digest.empty")}
              description={t("digest.emptyDesc")}
            />
          )}

          {!loading && isV2 && effectiveV2Data && hasData && (
            <V2Content
              data={effectiveV2Data}
              scope={scope}
              expandedMembers={expandedMembers}
              expandedTrades={expandedTrades}
              toggleMember={toggleMember}
              toggleTrade={toggleTrade}
              t={t}
            />
          )}

          {!loading && !isV2 && v1Data && hasData && (
            <V1Content
              data={v1Data}
              expandedMembers={expandedMembers}
              toggleMember={toggleMember}
              t={t}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ════════════════════════════════════════════
// V2 Content — 3-Zone Trading Intelligence
// ════════════════════════════════════════════

function V2Content({
  data,
  scope,
  expandedMembers,
  expandedTrades,
  toggleMember,
  toggleTrade,
  t,
}: {
  data: DigestV2Response;
  scope: DigestScope;
  expandedMembers: Set<string>;
  expandedTrades: Set<string>;
  toggleMember: (id: string) => void;
  toggleTrade: (id: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const c = data.cockpit;
  const ts = data.trackingSummary;
  const sa = data.stateAssessment;
  const hasTrackingIssue = ts.staleAccounts > 0 || ts.lostAccounts > 0;
  const hasOpenPositions = data.summary.openCount > 0;

  const nowMs = new Date(data.generatedAt).getTime();

  // Flatten all positions for analysis
  const allPositions = useMemo(() =>
    data.members.flatMap((m) => m.openPositions),
    [data.members]
  );

  // Group positions by symbol
  const positionGroups = useMemo(() =>
    groupPositionsBySymbol(allPositions),
    [allPositions]
  );

  const equity = data.riskBudget?.totalEquity ?? null;
  const balance = data.accountBalance ?? data.riskBudget?.totalBalance ?? null;

  // Smart actions (trade intelligence)
  const smartActions = useMemo(() =>
    computeSmartActions({
      positions: allPositions.map((p) => ({
        floatingPnl: p.floatingPnl,
        protectionStatus: p.health.protectionStatus,
        lots: p.lots ?? null,
        instrument: p.instrument,
        direction: p.direction,
        openPrice: p.openPrice ?? null,
        createdAt: p.createdAt,
        currentSL: p.currentSL ?? null,
        currentTP: p.currentTP ?? null,
      })),
      totalFloatingPnl: c.totalFloatingPnl,
      accountEquity: equity,
      entryInsights: data.entryInsights ?? [],
      scalingInsights: data.scalingInsights ?? [],
      concentrationSummary: data.concentrationSummary ?? null,
    }),
    [allPositions, c.totalFloatingPnl, equity, data.entryInsights, data.scalingInsights, data.concentrationSummary]
  );

  // Price Ladder computation
  const priceLadders = useMemo(() =>
    computePriceLadder({
      positions: allPositions.map((p) => ({
        instrument: p.instrument,
        direction: p.direction,
        openPrice: p.openPrice ?? null,
        lots: p.lots ?? null,
        floatingPnl: p.floatingPnl,
        currentPrice: p.currentPrice ?? null,
        currentSL: p.currentSL ?? null,
        currentTP: p.currentTP ?? null,
      })),
      accountEquity: equity,
    }),
    [allPositions, equity]
  );


  // Equity curve stats — override "current" values with live data from cockpit
  const equityCurveData = useMemo(() => data.equityCurve ?? [], [data.equityCurve]);
  const equityCurveStats = useMemo(() => {
    const snapshotStats = computeEquityCurveStats(equityCurveData, data.anchorBalance);
    if (!snapshotStats || balance === null || c.totalFloatingPnl === null) return snapshotStats;

    // Sum cumulative external flows from the period to adjust live values
    const cumulativeFlow = equityCurveData.reduce(
      (sum, d) => sum + ((d as { externalFlowSigned?: number }).externalFlowSigned ?? 0),
      0,
    );
    // Adjusted live values: strip out deposits/withdrawals for chart continuity
    const adjLiveBalance = balance - cumulativeFlow;
    const liveEquity = adjLiveBalance + c.totalFloatingPnl;
    const liveEqChange = liveEquity - snapshotStats.baselineBalance;
    const liveBalChange = adjLiveBalance - snapshotStats.baselineBalance;

    return {
      ...snapshotStats,
      currentEquityChange: liveEqChange,
      currentEquityChangePct: (liveEqChange / snapshotStats.baselineBalance) * 100,
      currentBalanceChange: liveBalChange,
      currentBalanceChangePct: (liveBalChange / snapshotStats.baselineBalance) * 100,
      floatingPL: c.totalFloatingPnl,
      floatingPct: balance > 0 ? (c.totalFloatingPnl / balance) * 100 : 0,
      // Update peak if live is new peak
      peakEquityChange: Math.max(snapshotStats.peakEquityChange, liveEqChange),
      peakEquityChangePct: liveEqChange > snapshotStats.peakEquityChange
        ? (liveEqChange / snapshotStats.baselineBalance) * 100
        : snapshotStats.peakEquityChangePct,
      // Update low if live is new low
      lowEquityChange: Math.min(snapshotStats.lowEquityChange, liveEqChange),
      lowEquityChangePct: liveEqChange < snapshotStats.lowEquityChange
        ? (liveEqChange / snapshotStats.baselineBalance) * 100
        : snapshotStats.lowEquityChangePct,
    };
  }, [equityCurveData, balance, c.totalFloatingPnl, data.anchorBalance]);

  // Context line: "5 positions · 250 lots UKBRENT LONG · 5 unprotected"
  const unprotectedCount = allPositions.filter(
    (p) => p.health.protectionStatus === "UNPROTECTED" || p.health.protectionStatus === "UNKNOWN_RISK"
  ).length;
  const contextLine = useMemo(() => {
    const parts: string[] = [];
    parts.push(`${allPositions.length} positions`);
    if (positionGroups.length > 0) {
      const top = positionGroups[0];
      parts.push(`${top.totalLots}L ${top.instrument} ${top.direction}`);
    }
    if (unprotectedCount > 0) parts.push(`${unprotectedCount} unprotected`);
    return parts.join(" · ");
  }, [allPositions.length, positionGroups, unprotectedCount]);

  return (
    <div className="space-y-3">
      {/* ═══ SECTION 1: HERO STATS ═══ */}

      {/* Status banner — only on tracking issues */}
      <SystemStatusBar
        tracking={ts}
        hasTrackingIssue={hasTrackingIssue}
        generatedAt={data.generatedAt}
        t={t}
      />

      {/* Hero: P/L + % of equity (or $/pt fallback) */}
      {hasOpenPositions && (
        <HeroStats pnl={c.totalFloatingPnl} balance={balance} contextLine={contextLine} />
      )}

      {/* ═══ SECTION 2: SMART ACTIONS ═══ */}
      {smartActions.length > 0 && (
        <SmartActionsBlock actions={smartActions} t={t} />
      )}

      {/* ═══ SECTION 3: EQUITY & BALANCE CURVE ═══ */}
      <EquityCurveCard data={equityCurveData} stats={equityCurveStats} t={t} anchorBalance={data.anchorBalance} />

      {/* ═══ SECTION 4: PRICE LADDER ═══ */}
      {priceLadders.length > 0 && (
        <PriceLadderSection ladders={priceLadders} t={t} />
      )}

      {/* ═══ SECTION 4: POSITION PROFILE ═══ */}
      {allPositions.length > 1 && (
        <PositionProfileCard
          positions={allPositions}
          entryInsights={data.entryInsights ?? []}
          nowMs={nowMs}
          t={t}
        />
      )}

      {/* ═══ SECTION 5: WHAT CHANGED ═══ */}
      <DeltaStrip deltas={data.deltas} t={t} />

      {/* ═══ ZONE 3: THE DETAILS ═══ */}

      {/* ═══ SECTION 6: MY POSITIONS (collapsed by default) ═══ */}
      {scope === "clan" ? (
        <CollapsibleSection
          label={`${t("digest.memberBreakdown")} (${data.members.length})`}
          defaultOpen={false}
        >
          <div className="space-y-2">
            {data.members.map((member) => (
              <MemberCard
                key={member.userId}
                member={member}
                expanded={expandedMembers.has(member.userId)}
                expandedTrades={expandedTrades}
                onToggle={() => toggleMember(member.userId)}
                onToggleTrade={toggleTrade}
                t={t}
              />
            ))}
          </div>
        </CollapsibleSection>
      ) : allPositions.length > 0 ? (
        <CollapsibleSection
          label={`${t("digest.myPositions")} (${allPositions.length})`}
          defaultOpen={false}
        >
          <div className="space-y-0.5">
            {allPositions.map((pos) => (
              <CompactPositionRow key={pos.tradeId} position={pos} />
            ))}
            {/* Total row */}
            <div className="mt-1 flex items-center gap-1.5 border-t border-border/30 pt-1.5 text-[11px] font-semibold">
              <span className="text-muted-foreground">{t("digest.total")}</span>
              <span className="text-muted-foreground">
                {allPositions.reduce((s, p) => s + (p.lots ?? 0), 0)}L
              </span>
              <span className={cn("ms-auto font-mono", pnlColor(c.totalFloatingPnl))}>
                {c.totalFloatingPnl !== null ? fmtCurrency(c.totalFloatingPnl) : "—"}
              </span>
              {unprotectedCount > 0 && (
                <span className="flex items-center gap-0.5 text-red-500">
                  {unprotectedCount}/{allPositions.length} <ShieldOff className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
        </CollapsibleSection>
      ) : null}

      {/* ═══ SECTION 7: SYSTEM HEALTH (collapsed at bottom) ═══ */}
      <SystemHealthSection
        tracking={ts}
        assessment={sa}
        attention={data.attentionQueue}
        actions={data.actions}
        riskBudget={data.riskBudget}
        generatedAt={data.generatedAt}
        t={t}
      />
    </div>
  );
}

// ════════════════════════════════════════════
// SECTION COMPONENTS
// ════════════════════════════════════════════

// ─── System Status Bar (slim banner) ───

function SystemStatusBar({
  tracking,
  hasTrackingIssue,
  generatedAt,
  t,
}: {
  tracking: DigestV2Response["trackingSummary"];
  hasTrackingIssue: boolean;
  generatedAt: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const totalAccounts = tracking.activeAccounts + tracking.staleAccounts + tracking.lostAccounts;

  if (hasTrackingIssue) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
        <span className="flex-1 text-xs text-amber-600 dark:text-amber-400">
          {tracking.lostAccounts > 0
            ? t("digest.status.trackingLost", { count: tracking.lostAccounts })
            : t("digest.status.stale", { count: tracking.staleAccounts })}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  if (totalAccounts > 0) {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
        <span className="text-[10px] text-muted-foreground">{t("digest.status.live")}</span>
        <span className="ms-auto text-[10px] text-muted-foreground">
          {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  return null;
}

// ─── Section 1: Hero Stats ───

function HeroStats({
  pnl,
  balance,
  contextLine,
}: {
  pnl: number | null;
  balance: number | null;
  contextLine: string;
}) {
  const pnlPct = balance && balance > 0 && pnl !== null ? (pnl / balance) * 100 : null;

  return (
    <div className="px-1">
      <div className="flex items-baseline justify-between">
        <span className={cn("text-4xl font-black tabular-nums tracking-tight", pnlColor(pnl))}>
          {pnl !== null ? fmtCurrency(pnl) : "—"}
        </span>
        {pnlPct !== null ? (
          <span className={cn("text-xl font-bold tabular-nums", pnlColor(pnl))}>
            {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—%</span>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{contextLine}</p>
    </div>
  );
}

// ─── Section 3: Price Ladder with Asset Tabs ───

const ZONE_COLORS: Record<PriceLadderLevel["zone"], string> = {
  profit: "text-green-500",
  warning: "text-amber-500",
  danger: "text-red-500",
  catastrophic: "text-red-700 dark:text-red-400",
};

function PriceLadderSection({
  ladders,
  t,
}: {
  ladders: PriceLadderData[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const ladder = ladders[activeIdx] ?? ladders[0];
  if (!ladder) return null;

  return (
    <div className="rounded-xl border border-border/30 bg-muted/10 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("digest.ladder.title")}{ladders.length === 1 ? ` — ${ladder.symbol}` : ""}
      </p>

      {/* Asset tabs — only when multiple symbols */}
      {ladders.length > 1 && (
        <div className="mb-2 flex gap-2">
          {ladders.map((l, i) => (
            <button
              key={`${l.symbol}-${l.direction}`}
              onClick={() => setActiveIdx(i)}
              className={cn(
                "flex min-w-[72px] flex-col items-center rounded-lg border px-3 py-1.5 transition-colors",
                i === activeIdx
                  ? "border-white/20 bg-white/[0.08]"
                  : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]",
              )}
            >
              <span className="text-[12px] font-semibold text-foreground/90">{l.symbol}</span>
              <span className={cn("text-[10px] font-mono", l.totalPnl >= 0 ? "text-green-500" : "text-red-500")}>
                {fmtChange(l.totalPnl)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Context line: "LONG · 4 trades · 250 lots · +$29,955" */}
      <p className="mb-2 text-[11px] text-muted-foreground">
        <span className={cn("font-semibold", ladder.direction === "LONG" ? "text-green-500" : "text-red-500")}>
          {ladder.direction}
        </span>
        {" · "}{ladder.tradeCount} trade{ladder.tradeCount > 1 ? "s" : ""}
        {" · "}{ladder.totalLots} lots
        {" · "}
        <span className={cn("font-mono", ladder.totalPnl >= 0 ? "text-green-500" : "text-red-500")}>
          {fmtChange(ladder.totalPnl)}
        </span>
      </p>

      <PriceLadderCard ladder={ladder} />
    </div>
  );
}

function PriceLadderCard({
  ladder,
}: {
  ladder: PriceLadderData;
}) {
  const levels = ladder.levels;
  const isLong = ladder.direction === "LONG";

  const BAR_EQ_H = 300;
  const BAR_EQ_W = 32;
  const LEFT_MARGIN = 60;
  const RIGHT_MARGIN = 180;
  const SVG_EQ_W = LEFT_MARGIN + BAR_EQ_W + RIGHT_MARGIN + 10;
  const TOP_PAD = 20;
  const MIN_LABEL_GAP = 22;

  // Resolve label collisions: ensure min gap between consecutive labels
  const { resolvedY, minPrice, range, bePct } = useMemo(() => {
    if (levels.length < 2) return { resolvedY: [], minPrice: 0, range: 0, bePct: 50 };
    const mn = levels[levels.length - 1].price;
    const r = levels[0].price - mn;
    if (r <= 0) return { resolvedY: [], minPrice: mn, range: 0, bePct: 50 };

    const rawY = levels.map((l) => TOP_PAD + (1 - (l.price - mn) / r) * BAR_EQ_H);
    const resolved = [...rawY];
    for (let i = 1; i < resolved.length; i++) {
      if (resolved[i] - resolved[i - 1] < MIN_LABEL_GAP) {
        resolved[i] = resolved[i - 1] + MIN_LABEL_GAP;
      }
    }
    const beLevel = levels.find((l) => l.label === "Breakeven");
    const bp = beLevel ? ((beLevel.price - mn) / r) * 100 : 50;
    return { resolvedY: resolved, minPrice: mn, range: r, bePct: bp };
  }, [levels]);

  if (levels.length < 2 || range <= 0) return null;

  function priceToY(price: number): number {
    return TOP_PAD + (1 - (price - minPrice) / range) * BAR_EQ_H;
  }

  const SVG_EQ_H = Math.max(BAR_EQ_H + 40, (resolvedY[resolvedY.length - 1] ?? BAR_EQ_H) + 30);

  // Gradient: green-top for LONG (profit up), red-top for SHORT (loss up)
  const gradTop = isLong ? "#22c55e" : "#ef4444";
  const gradBottom = isLong ? "#ef4444" : "#22c55e";

  return (
    <>
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_EQ_W} ${SVG_EQ_H}`}
        className="overflow-visible"
        aria-label={`Price ladder for ${ladder.symbol}`}
      >
        <defs>
          <linearGradient id={`grad-${ladder.symbol}-${ladder.direction}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradTop} stopOpacity="0.7" />
            <stop offset={`${100 - bePct}%`} stopColor="#eab308" stopOpacity="0.5" />
            <stop offset="100%" stopColor={gradBottom} stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* Main thermometer bar */}
        <rect
          x={LEFT_MARGIN}
          y={TOP_PAD}
          width={BAR_EQ_W}
          height={BAR_EQ_H}
          rx={6}
          fill={`url(#grad-${ladder.symbol}-${ladder.direction})`}
        />

        {/* Level markers */}
        {levels.map((level, i) => {
          const y = priceToY(level.price);
          const labelY = resolvedY[i];
          const color = ZONE_COLORS[level.zone];
          const isCur = level.isCurrent;

          return (
            <g key={`${level.label}-${i}`}>
              {/* Horizontal tick line at actual price position */}
              <line
                x1={LEFT_MARGIN}
                y1={y}
                x2={LEFT_MARGIN + BAR_EQ_W}
                y2={y}
                stroke="currentColor"
                className={isCur ? "text-white" : "text-white/30"}
                strokeWidth={isCur ? 2 : 1}
              />

              {/* Connector line from tick to offset label if needed */}
              {Math.abs(y - labelY) > 2 && (
                <line
                  x1={LEFT_MARGIN + BAR_EQ_W + 2}
                  y1={y}
                  x2={LEFT_MARGIN + BAR_EQ_W + 6}
                  y2={labelY}
                  stroke="currentColor"
                  className="text-white/10"
                  strokeWidth={0.5}
                />
              )}

              {/* Current price marker */}
              {isCur && (
                <circle
                  cx={LEFT_MARGIN + BAR_EQ_W / 2}
                  cy={y}
                  r={5}
                  fill="white"
                  className="drop-shadow-md"
                />
              )}

              {/* Price label (left) */}
              <text
                x={LEFT_MARGIN - 4}
                y={labelY + 4}
                textAnchor="end"
                className={cn("fill-current text-[10px] tabular-nums", color)}
              >
                {level.price.toFixed(2)}
              </text>

              {/* Level label + sublabel (right) */}
              <text
                x={LEFT_MARGIN + BAR_EQ_W + 8}
                y={labelY + 4}
                className={cn("fill-current text-[11px] font-medium", color)}
              >
                {level.label}
              </text>
              {level.sublabel && (
                <text
                  x={LEFT_MARGIN + BAR_EQ_W + 8}
                  y={labelY + 16}
                  className="fill-current text-[9px] text-muted-foreground"
                >
                  {level.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Risk context insight below ladder */}
      {ladder.insight && (
        <p className="mt-2 border-t border-white/[0.06] pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {ladder.insight}
        </p>
      )}
    </>
  );
}

// ─── Section 4: Position Profile Card ───

function PositionProfileCard({
  positions,
  entryInsights,
  t,
}: {
  positions: OpenPositionV2[];
  entryInsights: EntryClusterInsight[];
  nowMs?: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  // Donut SVG constants
  const DONUT_SIZE = 90;
  const DONUT_R = 34;
  const DONUT_STROKE = 12;
  const circumference = 2 * Math.PI * DONUT_R;
  const DONUT_GREENS = ["#22c55e", "#16a34a", "#15803d", "#166534", "#14532d"];

  // All memoized computations
  const {
    donutArcs, profitSegments, topInsight, totalLots, withLotsCount,
    donutInsight, profitInsight, spreadInsight,
  } = useMemo(() => {
    const wLots = positions.filter((p) => p.lots != null && p.lots > 0);
    const wPnl = positions.filter((p) => p.floatingPnl !== null);
    const tLots = wLots.reduce((s, p) => s + (p.lots ?? 0), 0);
    const tPnl = wPnl.reduce((s, p) => s + (p.floatingPnl ?? 0), 0);

    // Donut segments + arcs
    const segments = wLots.map((p) => ({
      share: tLots > 0 ? (p.lots ?? 0) / tLots : 0,
    }));
    const mxShare = Math.max(...segments.map((s) => s.share), 0);

    const arcs: Array<{ dash: number; gap: number; offset: number }> = [];
    let runningOffset = 0;
    for (const seg of segments) {
      const dash = seg.share * circumference;
      arcs.push({ dash, gap: circumference - dash, offset: runningOffset });
      runningOffset += dash;
    }

    // Profit bar segments
    const pSegs = wPnl
      .filter((p) => (p.floatingPnl ?? 0) !== 0)
      .sort((a, b) => Math.abs(b.floatingPnl ?? 0) - Math.abs(a.floatingPnl ?? 0))
      .map((p) => ({
        tradeId: p.tradeId,
        pnl: p.floatingPnl ?? 0,
        pct: tPnl !== 0 ? ((p.floatingPnl ?? 0) / tPnl) * 100 : 0,
        lots: p.lots ?? 0,
        openPrice: p.openPrice ?? 0,
      }));

    const tInsight = entryInsights.length > 0 ? entryInsights[0] : null;

    // Donut insight sentence
    let dInsight: string | null = null;
    const mxSharePct = Math.round(mxShare * 100);
    if (mxSharePct > 40 && wLots.length > 1) {
      dInsight = t("digest.insight.lotDominant", { pct: mxSharePct });
    } else if (wLots.length > 1) {
      dInsight = t("digest.insight.lotEven");
    }

    // Profit insight sentence
    let pInsight: string | null = null;
    if (pSegs.length > 1 && pSegs[0]) {
      const topPct = Math.round(Math.abs(pSegs[0].pct));
      const restPnl = tPnl - pSegs[0].pnl;
      if (topPct > 50) {
        pInsight = t("digest.insight.profitConcentrated", {
          pct: topPct,
          rest: fmtCurrency(restPnl),
          n: pSegs.length - 1,
        });
      }
    }

    // Entry spread insight sentence
    let sInsight: string | null = null;
    if (tInsight?.entrySpreadPct != null && tInsight.weightedAvgEntry != null && tInsight.entrySpread != null) {
      const sp = tInsight.entrySpreadPct;
      if (sp < 3) {
        sInsight = t("digest.insight.spreadTight", { pct: sp.toFixed(1) });
      } else if (sp < 8) {
        sInsight = t("digest.insight.spreadModerate", { pct: sp.toFixed(1) });
      } else if (sp < 15) {
        sInsight = t("digest.insight.spreadWide", {
          pct: sp.toFixed(1),
          range: tInsight.entrySpread.toFixed(2),
          breakeven: tInsight.weightedAvgEntry.toFixed(2),
        });
      } else {
        sInsight = t("digest.insight.spreadVeryWide", { pct: sp.toFixed(1) });
      }
    }

    return {
      donutArcs: arcs,
      profitSegments: pSegs,
      topInsight: tInsight,
      totalLots: tLots,
      withLotsCount: wLots.length,
      donutInsight: dInsight,
      profitInsight: pInsight,
      spreadInsight: sInsight,
    };
  }, [positions, entryInsights, circumference, t]);

  return (
    <div className="rounded-xl border border-border/30 bg-muted/10 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("digest.profile.title")}
      </p>

      <div className="flex items-start gap-4">
        {/* Mini donut */}
        {withLotsCount > 1 && (
          <div className="flex shrink-0 flex-col items-center">
            <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}>
              {donutArcs.map((arc, i) => (
                  <circle
                    key={i}
                    cx={DONUT_SIZE / 2}
                    cy={DONUT_SIZE / 2}
                    r={DONUT_R}
                    fill="none"
                    stroke={DONUT_GREENS[i % DONUT_GREENS.length]}
                    strokeWidth={DONUT_STROKE}
                    strokeDasharray={`${arc.dash} ${arc.gap}`}
                    strokeDashoffset={-arc.offset}
                    transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
                  />
              ))}
              <text
                x={DONUT_SIZE / 2}
                y={DONUT_SIZE / 2 + 1}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-current text-sm font-bold text-foreground"
              >
                {Math.round(totalLots)}
              </text>
            </svg>
          </div>
        )}

        {/* Profit stacked bar + best trade */}
        {profitSegments.length > 0 && (
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] text-muted-foreground">{t("digest.profile.profitByTrade")}</p>
            <div className="flex h-5 overflow-hidden rounded-full">
              {profitSegments.map((seg, i) => {
                const absPct = Math.max(Math.abs(seg.pct), 3);
                const opacity = 0.4 + (i === 0 ? 0.6 : 0.3 / Math.max(profitSegments.length - 1, 1) * (profitSegments.length - 1 - i));
                return (
                  <div
                    key={seg.tradeId}
                    className={seg.pnl >= 0 ? "bg-green-500" : "bg-red-500"}
                    style={{ width: `${absPct}%`, opacity: Math.min(opacity, 1) }}
                    title={`${fmtCurrency(seg.pnl)} (${seg.pct.toFixed(0)}%)`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Insight sentences */}
      <div className="mt-2 space-y-1">
        {donutInsight && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">{donutInsight}</p>
        )}
        {profitInsight && (
          <p className="text-[11px] leading-relaxed text-muted-foreground">{profitInsight}</p>
        )}
      </div>

      {/* Entry spread gauge */}
      {topInsight && topInsight.weightedAvgEntry !== null && topInsight.entrySpreadPct !== null && (
        <div className="mt-3">
          <div className="relative h-3 rounded-full bg-muted/30">
            {/* Range bar */}
            <div className="absolute inset-y-0 rounded-full bg-blue-500/30" style={{ left: "5%", right: "5%" }} />
            {/* Avg entry marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-amber-500"
              style={{ left: "50%" }}
              title={`Avg: ${topInsight.weightedAvgEntry}`}
            />
          </div>
          {spreadInsight && (
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{spreadInsight}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section 3: Equity & Balance Curve (Normalized + Interactive) ───

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtChange(v: number): string {
  const sign = v >= 0 ? "+" : "";
  if (Math.abs(v) >= 1000) return `${sign}$${(v / 1000).toFixed(1)}K`;
  return `${sign}$${v.toFixed(0)}`;
}

// Equity chart layout constants (module-level for hook dependency safety)
const EQ_W = 340;
const EQ_H = 140;
const EQ_PAD_L = 55;
const EQ_CHART_W = EQ_W - EQ_PAD_L - 4;

function EquityCurveCard({
  data,
  stats,
  t,
  anchorBalance,
}: {
  data: EquityDataPoint[];
  stats: NormalizedEquityStats | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  anchorBalance?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgNodeRef = useRef<SVGSVGElement | null>(null);
  const normalized = useMemo(() => normalizeEquityData(data, anchorBalance), [data, anchorBalance]);

  const findNearest = useCallback((clientX: number) => {
    const svg = svgNodeRef.current;
    if (!svg || normalized.length < 2) return null;
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * EQ_W;
    const chartX = svgX - EQ_PAD_L;
    if (chartX < 0 || chartX > EQ_CHART_W) return null;
    const ratio = chartX / EQ_CHART_W;
    return Math.min(Math.max(0, Math.round(ratio * (normalized.length - 1))), normalized.length - 1);
  }, [normalized.length]);

  const handleMove = useCallback((clientX: number) => {
    setHoverIdx(findNearest(clientX));
  }, [findNearest]);

  if (normalized.length < 2) {
    return (
      <div className="rounded-xl border border-border/30 bg-muted/10 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("digest.equity.title")}
        </p>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Activity className="mb-2 h-6 w-6 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">{t("digest.equity.collecting")}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/70">{t("digest.equity.collectingHint")}</p>
        </div>
      </div>
    );
  }

  const PAD = { top: 8, bottom: 20, left: EQ_PAD_L, right: 4 };
  const chartW = EQ_CHART_W;
  const chartH = EQ_H - PAD.top - PAD.bottom;

  // Y-axis: normalized change values with padding + always include zero
  const allChanges = normalized.flatMap((d) => [d.equityChange, d.balanceChange]);
  const rawMin = Math.min(...allChanges);
  const rawMax = Math.max(...allChanges);
  const dataRange = rawMax - rawMin || 1;
  const yMin = Math.min(rawMin - dataRange * 0.1, -dataRange * 0.05);
  const yMax = Math.max(rawMax + dataRange * 0.1, dataRange * 0.05);
  const yRange = yMax - yMin;

  const timeMin = new Date(normalized[0].timestamp).getTime();
  const timeMax = new Date(normalized[normalized.length - 1].timestamp).getTime();
  const timeRange = timeMax - timeMin || 1;

  const sx = (ts: string) => PAD.left + ((new Date(ts).getTime() - timeMin) / timeRange) * chartW;
  const sy = (v: number) => PAD.top + (1 - (v - yMin) / yRange) * chartH;
  const zeroY = sy(0);

  // Check if any data is estimated
  const hasEstimated = normalized.some((d) => d.isEstimated);

  // Build equity path segments (solid for real, dashed for estimated)
  // Also detect time gaps (blind periods where no data was available)
  const GAP_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes — expected cadence is 5min

  type PathSeg = { d: string; estimated: boolean };
  const equitySegments: PathSeg[] = [];
  const balanceSegments: PathSeg[] = [];
  // Fill segments — one per continuous segment for gap-aware fill
  const fillSegments: string[] = [];
  let eqSeg = "";
  let balSeg = "";
  let fillSeg = "";
  let curEstimated = normalized[0].isEstimated ?? false;
  for (let i = 0; i < normalized.length; i++) {
    const pt = normalized[i];
    const ex = sx(pt.timestamp).toFixed(1);
    const eqY = sy(pt.equityChange).toFixed(1);
    const balY = sy(pt.balanceChange).toFixed(1);
    const est = pt.isEstimated ?? false;

    // Detect time gap from previous point (blind period)
    const hasGap = i > 0 &&
      (new Date(pt.timestamp).getTime() - new Date(normalized[i - 1].timestamp).getTime()) > GAP_THRESHOLD_MS;

    if (i === 0) {
      eqSeg = `M${ex},${eqY}`;
      balSeg = `M${ex},${balY}`;
      fillSeg = `M${ex},${eqY}`;
      curEstimated = est;
    } else if (est !== curEstimated || hasGap) {
      // Break segment on: estimated transition OR time gap
      if (!hasGap) {
        // Include this point as end of previous segment (smooth transition)
        eqSeg += ` L${ex},${eqY}`;
        balSeg += ` L${ex},${balY}`;
        fillSeg += ` L${ex},${eqY}`;
      }
      equitySegments.push({ d: eqSeg, estimated: curEstimated });
      balanceSegments.push({ d: balSeg, estimated: curEstimated });
      // Close fill segment back to zero line
      const prevPt = normalized[hasGap ? i - 1 : i];
      const prevEx = hasGap ? sx(prevPt.timestamp).toFixed(1) : ex;
      const firstFillMatch = fillSeg.match(/^M([^,]+)/);
      const firstFillX = firstFillMatch ? firstFillMatch[1] : prevEx;
      fillSegments.push(fillSeg + ` L${prevEx},${zeroY.toFixed(1)} L${firstFillX},${zeroY.toFixed(1)} Z`);
      // Start new segment from this point
      eqSeg = `M${ex},${eqY}`;
      balSeg = `M${ex},${balY}`;
      fillSeg = `M${ex},${eqY}`;
      curEstimated = est;
    } else {
      eqSeg += ` L${ex},${eqY}`;
      balSeg += ` L${ex},${balY}`;
      fillSeg += ` L${ex},${eqY}`;
    }
  }
  equitySegments.push({ d: eqSeg, estimated: curEstimated });
  balanceSegments.push({ d: balSeg, estimated: curEstimated });
  // Close final fill segment
  const lastEx = sx(normalized[normalized.length - 1].timestamp).toFixed(1);
  const firstFillMatch = fillSeg.match(/^M([^,]+)/);
  const firstFillX = firstFillMatch ? firstFillMatch[1] : lastEx;
  fillSegments.push(fillSeg + ` L${lastEx},${zeroY.toFixed(1)} L${firstFillX},${zeroY.toFixed(1)} Z`);

  const isAbove = stats ? stats.currentEquityChange >= 0 : true;
  const lineColor = isAbove ? "#22c55e" : "#ef4444";
  const fillColor = isAbove ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";

  // Y-axis labels (3 reference lines: top, zero, bottom)
  const yLabels = [
    { val: rawMax > 0 ? rawMax : yMax * 0.8, y: sy(rawMax > 0 ? rawMax : yMax * 0.8) },
    { val: 0, y: zeroY },
    { val: rawMin < 0 ? rawMin : yMin * 0.8, y: sy(rawMin < 0 ? rawMin : yMin * 0.8) },
  ];

  // X-axis time labels
  const labelCount = Math.min(5, normalized.length);
  const labelStep = Math.max(1, Math.floor(normalized.length / labelCount));
  const timeLabels: Array<{ x: number; label: string }> = [];
  for (let i = 0; i < normalized.length; i += labelStep) {
    timeLabels.push({
      x: sx(normalized[i].timestamp),
      label: new Date(normalized[i].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    });
  }

  const hoverPoint = hoverIdx !== null ? normalized[hoverIdx] : null;

  return (
    <div className="rounded-xl border border-border/30 bg-muted/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("digest.equity.title")}
        </p>
        {hasEstimated && (
          <span className="rounded-full bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-medium text-yellow-500" title={t("digest.estimatedTooltip")}>
            {t("digest.estimated")}
          </span>
        )}
      </div>

      {/* Header values — normalized change from period start */}
      {stats && (
        <div className="mb-2 flex items-baseline gap-4 text-xs">
          <span className="font-mono font-semibold" style={{ color: lineColor }}>
            {fmtChange(stats.currentEquityChange)} ({stats.currentEquityChangePct >= 0 ? "+" : ""}{stats.currentEquityChangePct.toFixed(1)}%)
            <span className="ms-1 text-[10px] font-normal text-muted-foreground">{t("digest.equity.equity")}</span>
          </span>
          <span className="font-mono font-semibold text-white/40">
            {fmtChange(stats.currentBalanceChange)} ({stats.currentBalanceChangePct >= 0 ? "+" : ""}{stats.currentBalanceChangePct.toFixed(1)}%)
            <span className="ms-1 text-[10px] font-normal text-muted-foreground">{t("digest.equity.balance")}</span>
          </span>
        </div>
      )}

      {/* Mobile touch info bar */}
      <div className="mb-1 flex h-6 items-center gap-2 text-[10px] text-muted-foreground sm:hidden">
        {hoverPoint ? (
          <>
            <span>{new Date(hoverPoint.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span style={{ color: "#22c55e" }}>Eq: {fmtCompact(hoverPoint.rawEquity)}</span>
            <span>Bal: {fmtCompact(hoverPoint.rawBalance)}</span>
            <span style={{ color: hoverPoint.floatingPL >= 0 ? "#22c55e" : "#ef4444" }}>
              Fl: {fmtChange(hoverPoint.floatingPL)}
            </span>
          </>
        ) : (
          <span>{t("digest.equity.touchHint")}</span>
        )}
      </div>

      {/* SVG Chart */}
      <div className="relative">
        <svg
          ref={svgNodeRef}
          width="100%"
          viewBox={`0 0 ${EQ_W} ${EQ_H}`}
          className="overflow-visible"
          style={{ cursor: "crosshair" }}
          onMouseMove={(e) => handleMove(e.clientX)}
          onMouseLeave={() => setHoverIdx(null)}
          onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }}
          onTouchEnd={() => setHoverIdx(null)}
        >
          {/* Y-axis reference lines */}
          {yLabels.map((yl, i) => (
            <g key={`yl-${i}`}>
              <line
                x1={PAD.left}
                y1={yl.y}
                x2={EQ_W - PAD.right}
                y2={yl.y}
                stroke={yl.val === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}
                strokeWidth={yl.val === 0 ? 1 : 0.5}
                strokeDasharray={yl.val === 0 ? undefined : "4,4"}
              />
              <text
                x={PAD.left - 4}
                y={yl.y + 3}
                textAnchor="end"
                className="fill-current text-[8px] text-muted-foreground"
              >
                {fmtChange(yl.val)}
              </text>
            </g>
          ))}

          {/* Peak equity dashed line */}
          {stats && stats.peakEquityChange > stats.currentEquityChange && (
            <g>
              <line
                x1={PAD.left}
                y1={sy(stats.peakEquityChange)}
                x2={EQ_W - PAD.right}
                y2={sy(stats.peakEquityChange)}
                stroke="rgba(34,197,94,0.35)"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <text
                x={EQ_W - PAD.right + 2}
                y={sy(stats.peakEquityChange) + 3}
                className="fill-current text-[7px] text-green-500/60"
              >
                peak
              </text>
            </g>
          )}

          {/* Low equity dashed line */}
          {stats && stats.lowEquityChange < stats.currentEquityChange && stats.lowEquityChange < 0 && (
            <g>
              <line
                x1={PAD.left}
                y1={sy(stats.lowEquityChange)}
                x2={EQ_W - PAD.right}
                y2={sy(stats.lowEquityChange)}
                stroke="rgba(239,68,68,0.35)"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <text
                x={EQ_W - PAD.right + 2}
                y={sy(stats.lowEquityChange) + 3}
                className="fill-current text-[7px] text-red-500/60"
              >
                low
              </text>
            </g>
          )}

          {/* Fill between equity and zero (gap-aware: one path per continuous segment) */}
          {fillSegments.map((d, i) => (
            <path key={`fill-${i}`} d={d} fill={fillColor} />
          ))}

          {/* Balance line segments (muted, behind) */}
          {balanceSegments.map((seg, i) => (
            <path key={`bal-${i}`} d={seg.d} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} fill="none"
              strokeDasharray={seg.estimated ? "4,3" : undefined} />
          ))}

          {/* Equity line segments (bold, in front — dashed for estimated) */}
          {equitySegments.map((seg, i) => (
            <path key={`eq-${i}`} d={seg.d} stroke={lineColor} strokeWidth={2} fill="none"
              strokeDasharray={seg.estimated ? "4,3" : undefined} strokeOpacity={seg.estimated ? 0.6 : 1} />
          ))}

          {/* Crosshair + dots on hover */}
          {hoverIdx !== null && hoverPoint && (
            <>
              <line
                x1={sx(hoverPoint.timestamp)}
                y1={PAD.top}
                x2={sx(hoverPoint.timestamp)}
                y2={EQ_H - PAD.bottom}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <circle
                cx={sx(hoverPoint.timestamp)}
                cy={sy(hoverPoint.equityChange)}
                r={4}
                fill={lineColor}
                stroke="#fff"
                strokeWidth={1}
              />
              <circle
                cx={sx(hoverPoint.timestamp)}
                cy={sy(hoverPoint.balanceChange)}
                r={3}
                fill="#9ca3af"
                stroke="#fff"
                strokeWidth={1}
              />
            </>
          )}

          {/* Time labels */}
          {timeLabels.map((tl, i) => (
            <text key={i} x={tl.x} y={EQ_H - 2} textAnchor="middle" className="fill-current text-[8px] text-muted-foreground">
              {tl.label}
            </text>
          ))}

          {/* Invisible interaction overlay */}
          <rect x={PAD.left} y={PAD.top} width={chartW} height={chartH} fill="transparent" />
        </svg>

        {/* Desktop tooltip */}
        {hoverIdx !== null && hoverPoint && (
          <div className="pointer-events-none absolute end-0 top-0 z-10 hidden rounded-lg border border-white/10 bg-[rgba(20,20,30,0.95)] px-3 py-2 text-[11px] backdrop-blur-sm sm:block"
            style={{ minWidth: 170 }}
          >
            <p className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>{new Date(hoverPoint.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {hoverPoint.isEstimated && (
                <span className="rounded bg-yellow-500/20 px-1 text-[8px] text-yellow-400">{t("digest.estimated")}</span>
              )}
            </p>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("digest.equity.equity")}</span>
              <span className="font-mono font-semibold text-green-400">{fmtCompact(hoverPoint.rawEquity)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{t("digest.equity.balance")}</span>
              <span className="font-mono text-white/50">{fmtCompact(hoverPoint.rawBalance)}</span>
            </div>
            <div className="mt-1 border-t border-white/[0.08] pt-1">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("digest.equity.floating")}</span>
                <span className={cn("font-mono font-semibold", hoverPoint.floatingPL >= 0 ? "text-green-400" : "text-red-400")}>
                  {fmtChange(hoverPoint.floatingPL)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("digest.equity.periodPL")}</span>
                <span className={cn("font-mono", hoverPoint.equityChange >= 0 ? "text-green-400" : "text-red-400")}>
                  {fmtChange(hoverPoint.equityChange)} ({hoverPoint.equityChangePct >= 0 ? "+" : ""}{hoverPoint.equityChangePct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats below chart — normalized */}
      {stats && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
          <span>
            {t("digest.equity.peak")}: {fmtChange(stats.peakEquityChange)} ({stats.peakEquityChangePct >= 0 ? "+" : ""}{stats.peakEquityChangePct.toFixed(1)}%) @{new Date(stats.peakTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span>
            {t("digest.equity.low")}: {fmtChange(stats.lowEquityChange)} ({stats.lowEquityChangePct.toFixed(1)}%) @{new Date(stats.lowTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span className={cn("font-mono font-semibold", pnlColor(stats.floatingPL))}>
            {t("digest.equity.floating")}: {fmtCurrency(stats.floatingPL)} ({stats.floatingPct >= 0 ? "+" : ""}{stats.floatingPct.toFixed(1)}%)
          </span>
          {hasEstimated && (
            <span className="text-[9px] text-yellow-500/70">
              {t("digest.equity.estimatedSegment")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Section ───

function CollapsibleSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/30 bg-muted/10">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-medium"
        onClick={() => setOpen(!open)}
      >
        <span className="flex-1">{label}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border/30 px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}

// ─── Compact Position Row (single-line for collapsed section) ───

function CompactPositionRow({ position }: { position: OpenPositionV2 }) {
  const noSL = position.health.protectionStatus === "UNPROTECTED" || position.health.protectionStatus === "UNKNOWN_RISK";
  return (
    <div className="flex items-center gap-1.5 py-1 text-[11px]">
      <DirectionBadge direction={position.direction as "LONG" | "SHORT"} />
      <span className="font-mono font-medium">{position.instrument}</span>
      {position.lots != null && position.lots > 0 && (
        <span className="text-muted-foreground">{position.lots}L</span>
      )}
      {position.openPrice != null && (
        <span className="text-muted-foreground">@{position.openPrice}</span>
      )}
      <span className={cn("ms-auto font-mono font-semibold", pnlColor(position.floatingPnl))}>
        {position.floatingPnl !== null ? fmtCurrency(position.floatingPnl) : "—"}
      </span>
      <span className="w-12 text-end text-[10px] text-muted-foreground">{holdDuration(position.createdAt)}</span>
      {noSL && (
        <span className="flex items-center gap-0.5 text-red-500">
          <ShieldOff className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

// ─── 1D. Smart Actions ───

const SMART_ICON_MAP: Record<SmartAction["icon"], typeof AlertTriangle> = {
  risk: AlertTriangle,
  opportunity: Target,
  analysis: Activity,
};

const SMART_ICON_COLORS: Record<SmartAction["icon"], string> = {
  risk: "text-red-500",
  opportunity: "text-green-500",
  analysis: "text-blue-500",
};

function SmartActionsBlock({
  actions,
  t,
}: {
  actions: SmartAction[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 divide-y divide-white/[0.06]">
      {actions.map((action, i) => {
        const Icon = SMART_ICON_MAP[action.icon];
        const iconColor = SMART_ICON_COLORS[action.icon];
        return (
          <div key={`smart-${i}`} className="px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor)} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">
                  {t(action.titleKey)}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {t(action.detailKey, action.detailParams)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════
// KEPT V1 COMPONENTS (still used)
// ════════════════════════════════════════════

// ─── Delta Strip ───

function DeltaStrip({
  deltas,
  t,
}: {
  deltas: DigestDelta[] | null;
  t: (key: string) => string;
}) {
  if (deltas === null) {
    return (
      <div className="rounded-lg bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
        {t("digest.delta.baseline")}
      </div>
    );
  }

  if (deltas.length === 0) return null;

  const sorted = [...deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);

  return (
    <div>
      <SectionHeader label={t("digest.delta.title")} />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {sorted.map((d) => {
          const isGood = d.direction === "good";
          const isBad = d.direction === "bad";
          const sign = d.delta > 0 ? "+" : "";
          const label = t(`digest.delta.${d.metric}`);
          const val = Number.isInteger(d.delta) ? String(d.delta) : d.delta.toFixed(2);

          return (
            <span
              key={d.metric}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]",
                isGood && "bg-green-500/10 text-green-600 dark:text-green-400",
                isBad && "bg-red-500/10 text-red-600 dark:text-red-400",
                !isGood && !isBad && "bg-muted/50 text-muted-foreground"
              )}
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono font-semibold">{sign}{val}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}


// ─── System Health Section (collapsible, at bottom) ───

function SystemHealthSection({
  tracking,
  assessment,
  attention,
  actions,
  riskBudget,
  generatedAt,
  t,
}: {
  tracking: DigestV2Response["trackingSummary"];
  assessment: DigestV2Response["stateAssessment"];
  attention: DigestV2Response["attentionQueue"];
  actions: ActionItem[];
  riskBudget: DigestV2Response["riskBudget"];
  generatedAt: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = tracking.staleAccounts > 0 || tracking.lostAccounts > 0 || attention.length > 0;
  const sa = assessment;
  const safety = SAFETY_STYLES[sa.safetyBand as SafetyBand];
  const conf = CONFIDENCE_STYLES[sa.confidenceBand as ConfidenceBand];

  return (
    <div className="rounded-xl border border-border/30 bg-muted/10">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs"
        onClick={() => setExpanded(!expanded)}
      >
        <Wifi className={cn("h-3.5 w-3.5 shrink-0", hasIssues ? "text-yellow-500" : "text-green-500")} />
        <span className="font-medium">{t("digest.systemHealth.title")}</span>
        <span className={cn("ms-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold", safety.text)}>
          {sa.safetyScore}
        </span>
        <span className={cn("rounded-full px-1.5 py-0.5 text-[9px]", conf.text)}>
          {t(`digest.confidence.${sa.confidenceBand.toLowerCase()}`)}
        </span>
        <span className="ms-auto text-muted-foreground">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border/30 px-3 pb-3 pt-2">
          {/* Tracking status */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {tracking.activeAccounts > 0 && (
              <span className="text-green-600 dark:text-green-400">
                {tracking.activeAccounts} {t("digest.tracking.active")}
              </span>
            )}
            {tracking.staleAccounts > 0 && (
              <span className="text-yellow-600 dark:text-yellow-400">
                {tracking.staleAccounts} {t("digest.tracking.stale")}
              </span>
            )}
            {tracking.lostAccounts > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {tracking.lostAccounts} {t("digest.tracking.lost")}
              </span>
            )}
          </div>

          {/* Safety bar */}
          <div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">{t("digest.state.title")}</span>
              <span className={cn("font-semibold", safety.text)}>
                {t(`digest.state.${sa.safetyBand.toLowerCase()}`)} ({sa.safetyScore})
              </span>
            </div>
            <div className="mt-0.5 h-1 rounded-full bg-muted/30">
              <div className={cn("h-full rounded-full", safety.bar)} style={{ width: `${Math.min(sa.safetyScore, 100)}%` }} />
            </div>
          </div>

          {/* Risk budget */}
          {riskBudget && (
            <div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">{t("digest.riskBudget.title")}</span>
                <span className={cn("font-mono font-semibold", RISK_BUDGET_STYLES[riskBudget.riskBudgetBand].text)}>
                  {fmtR(riskBudget.totalOpenRiskR)}
                </span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-muted/30">
                <div
                  className={cn("h-full rounded-full", RISK_BUDGET_STYLES[riskBudget.riskBudgetBand].bar)}
                  style={{ width: `${Math.min(Math.abs(riskBudget.totalOpenRiskR) * 10, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* System actions (reconnect, restore) */}
          {actions.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("digest.actions.title")}
              </p>
              {actions.map((action, i) => {
                const alertKey = `digest.actions.${action.alertType}`;
                const params: Record<string, string | number> = { count: action.issueCount };
                if (action.affectedMember) params.member = action.affectedMember;
                return (
                  <div key={`${action.alertId}-${i}`} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                    <span>{t(alertKey, params)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Attention queue */}
          {attention.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("digest.attention.title")} ({attention.length})
              </p>
              {attention.slice(0, 5).map((item, i) => (
                <div
                  key={`${item.userId}-${i}`}
                  className={cn("rounded-md border-s-2 px-2 py-1 text-[11px]", SEVERITY_ACCENT[item.severity as AttentionSeverity])}
                >
                  <span className="font-semibold">{item.username}</span>
                  {item.instrument && <span className="ms-1 font-mono text-muted-foreground">{item.instrument}</span>}
                  {item.messageKey && (
                    <span className="ms-1 text-muted-foreground">
                      — {t(item.messageKey, item.messageParams as Record<string, string | number>)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end text-[9px] text-muted-foreground">
            <Clock className="me-0.5 inline h-2.5 w-2.5" />
            {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════
// SHARED COMPONENTS
// ════════════════════════════════════════════

function SectionHeader({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {label}
    </h4>
  );
}

// ─── Member Card (Clan mode) ───

function MemberCard({
  member,
  expanded,
  expandedTrades,
  onToggle,
  onToggleTrade,
  t,
}: {
  member: MemberStatsV2;
  expanded: boolean;
  expandedTrades: Set<string>;
  onToggle: () => void;
  onToggleTrade: (id: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className={cn("rounded-xl transition-colors", expanded ? "bg-muted/30" : "bg-muted/20")}>
      <button type="button" className="flex w-full items-center gap-3 p-3 text-start" onClick={onToggle}>
        <Avatar className="h-9 w-9 shrink-0">
          {member.avatar && <AvatarImage src={member.avatar} />}
          <AvatarFallback className="text-sm font-medium">{member.name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{member.name}</span>
            {member.memberImpactLabel && (
              <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[9px] font-medium text-orange-600 dark:text-orange-400">
                {t(`digest.${member.memberImpactLabel.replace("digest.", "")}`)}
              </span>
            )}
            {member.memberTrend && member.memberTrend !== "new" && member.memberTrend !== "stable" && (
              <MemberTrendBadge trend={member.memberTrend} t={t} />
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2.5 text-xs text-muted-foreground">
            {member.openCount > 0 && <span>{member.openCount} {t("digest.open")}</span>}
            {member.openCount > 0 && member.memberFloatingR !== null && (
              <span className={cn("font-mono", pnlColor(member.memberFloatingR))}>{fmtR(member.memberFloatingR)}</span>
            )}
            {member.memberActionsNeeded > 0 && (
              <span className="text-red-600 dark:text-red-400">{member.memberActionsNeeded} {t("digest.cockpit.needAction")}</span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <p className={cn("text-base font-bold tabular-nums", member.totalR >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
            {member.totalR >= 0 ? "+" : ""}{member.totalR}R
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border/50 px-3 pb-3 pt-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">TP:{member.tpHit}</span>
            <span className="text-red-600 dark:text-red-400">SL:{member.slHit}</span>
            <span className="text-yellow-600 dark:text-yellow-400">BE:{member.be}</span>
            <span>WR: {member.winRate}%</span>
            <span>{t("digest.avgR")}: {member.avgR}</span>
          </div>

          {member.openCount > 0 && (member.memberFloatingPnl !== null || member.memberRiskToSLR !== null) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs font-mono">
              {member.memberFloatingPnl !== null && (
                <span className={pnlColor(member.memberFloatingPnl)}>P/L: {fmtPnl(member.memberFloatingPnl)}</span>
              )}
              {member.memberRiskToSLR !== null && (
                <span className="text-orange-600 dark:text-orange-400">SL: {fmtR(member.memberRiskToSLR)}</span>
              )}
            </div>
          )}

          {member.openPositions.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("digest.openPositions")} ({member.openPositions.length})
              </p>
              <div className="space-y-1">
                {member.openPositions.map((pos) => (
                  <OpenTradeRow key={pos.tradeId} position={pos} expanded={expandedTrades.has(pos.tradeId)} onToggle={() => onToggleTrade(pos.tradeId)} t={t} />
                ))}
              </div>
            </div>
          )}

          {member.closedTrades.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("digest.closedTrades")} ({member.closedTrades.length})
              </p>
              <div className="space-y-1">
                {member.closedTrades.map((trade) => (
                  <ClosedTradeRow key={trade.tradeId} trade={trade} t={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Open Trade Row ───

function OpenTradeRow({
  position,
  expanded,
  onToggle,
  t,
}: {
  position: OpenPositionV2;
  expanded: boolean;
  onToggle: () => void;
  t: (key: string) => string;
}) {
  const healthColors = HEALTH_COLORS[position.health.overall as OverallHealth];
  const action = getAction(position.health.reasons as string[], position.health.overall, t);
  const isBad = position.health.overall === "BROKEN_PLAN" || position.health.overall === "AT_RISK";

  return (
    <div className={cn("rounded-lg", isBad ? "bg-red-500/5" : "bg-muted/20")}>
      <button type="button" className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs text-start" onClick={onToggle}>
        <DirectionBadge direction={position.direction as "LONG" | "SHORT"} />
        <span className="font-mono font-medium">{position.instrument}</span>
        {position.lots != null && position.lots > 0 && (
          <span className="text-[10px] text-muted-foreground">{position.lots}L</span>
        )}
        {position.accountLabel && (
          <span className="hidden truncate text-[9px] text-muted-foreground sm:inline">{position.accountLabel}</span>
        )}
        <span className="ms-auto flex items-center gap-2 font-mono">
          {position.floatingPnl !== null && (
            <span className={cn("font-medium", pnlColor(position.floatingPnl))}>{fmtPnl(position.floatingPnl)}</span>
          )}
          {position.rComputable && position.floatingR !== null ? (
            <span className={cn("font-medium", pnlColor(position.floatingR))}>{fmtR(position.floatingR)}</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">R?</span>
          )}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-border/30 px-2.5 py-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]">
            {position.openPrice != null && (
              <span className="text-muted-foreground">@ {position.openPrice}</span>
            )}
            <span className="text-muted-foreground">{holdDuration(position.createdAt)}</span>
            {position.riskToSLR !== null && (
              <span className="text-orange-600 dark:text-orange-400">{t("digest.cockpit.slRisk")}: {fmtR(position.riskToSLR)}</span>
            )}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", healthColors.bg, healthColors.text)}>
              {t(`digest.health.${position.health.overall.toLowerCase()}`)}
            </span>
            {position.health.protectionStatus === "UNPROTECTED" && (
              <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                <ShieldOff className="h-2.5 w-2.5" />{t("digest.protection.unprotected")}
              </span>
            )}
            {position.health.protectionStatus === "BREAKEVEN_LOCKED" && (
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                <Shield className="h-2.5 w-2.5" />{t("digest.protection.breakevenLocked")}
              </span>
            )}
            {position.health.protectionStatus === "PROTECTED" && (
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                <Shield className="h-2.5 w-2.5" />{t("digest.protection.protected")}
              </span>
            )}
            {position.trackingStatus === "TRACKING_LOST" && (
              <span className="flex items-center gap-0.5 text-red-400">
                <WifiOff className="h-2.5 w-2.5" />{t("digest.tracking.lost")}
              </span>
            )}
            {position.trackingStatus === "STALE" && (
              <span className="flex items-center gap-0.5 text-yellow-400">
                <Clock className="h-2.5 w-2.5" />{t("digest.tracking.stale")}
              </span>
            )}
          </div>
          {position.accountLabel && (
            <div className="text-[10px] text-muted-foreground sm:hidden">{position.accountLabel}</div>
          )}
          {action && (
            <div className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-2.5 w-2.5" />{action}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Closed Trade Row ───

function ClosedTradeRow({ trade, t }: { trade: ClosedTradeV2; t: (key: string) => string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted/20 px-2.5 py-1.5 text-xs">
      <DirectionBadge direction={trade.direction as "LONG" | "SHORT"} />
      <span className="font-mono font-medium">{trade.instrument}</span>
      <StatusBadge status={trade.status} />
      {trade.isOfficial && (
        <span title={t("digest.official")}><Shield className="h-3 w-3 text-blue-500" /></span>
      )}
      {trade.r !== null ? (
        <span className={cn("ms-auto font-mono font-medium", pnlColor(trade.r))}>
          {trade.r >= 0 ? "+" : ""}{trade.r}R
        </span>
      ) : (
        <span className="ms-auto text-muted-foreground">—</span>
      )}
    </div>
  );
}

// ─── Member Trend Badge ───

function MemberTrendBadge({ trend, t }: { trend: MemberTrend; t: (key: string) => string }) {
  if (trend === "improving") {
    return (
      <span className="rounded-full bg-green-500/10 px-1.5 text-[9px] font-medium text-green-600 dark:text-green-400">
        {t("digest.trend.improving")}
      </span>
    );
  }
  if (trend === "declining") {
    return (
      <span className="rounded-full bg-red-500/10 px-1.5 text-[9px] font-medium text-red-600 dark:text-red-400">
        {t("digest.trend.declining")}
      </span>
    );
  }
  return null;
}

// ════════════════════════════════════════════
// V1 FALLBACK
// ════════════════════════════════════════════

function V1Content({
  data,
  expandedMembers,
  toggleMember,
  t,
}: {
  data: ClanDigestData;
  expandedMembers: Set<string>;
  toggleMember: (id: string) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label={t("digest.signals")} value={data.summary.totalSignals} />
        <SummaryCard label={t("digest.analysis")} value={data.summary.totalAnalysis} />
        <SummaryCard label={t("digest.winRate")} value={`${data.summary.winRate}%`} />
        <SummaryCard label={t("digest.totalR")} value={data.summary.totalR} color={data.summary.totalR >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
        <SummaryCard label={t("digest.avgR")} value={data.summary.avgR} color={data.summary.avgR >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"} />
        <SummaryCard label={t("digest.activeMembers")} value={data.summary.activeMemberCount} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-green-600 dark:text-green-400">TP: {data.summary.tpHit}</span>
        <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400">SL: {data.summary.slHit}</span>
        <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-600 dark:text-yellow-400">BE: {data.summary.be}</span>
        <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-400">{t("digest.open")}: {data.summary.openCount}</span>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium">{t("digest.memberBreakdown")}</h4>
        <div className="space-y-1">
          {data.members.map((member) => {
            const isExpanded = expandedMembers.has(member.userId);
            return (
              <div key={member.userId} className="rounded-lg border">
                <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-start" onClick={() => toggleMember(member.userId)}>
                  <Avatar className="h-7 w-7">
                    {member.avatar && <AvatarImage src={member.avatar} />}
                    <AvatarFallback className="text-xs">{member.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{member.name}</span>
                    <span className="ms-2 text-xs text-muted-foreground">{member.signalCount}S / {member.analysisCount}A · {member.winRate}% WR</span>
                  </div>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium", member.totalR >= 0 ? "border-green-500/50 text-green-600 dark:text-green-400" : "border-red-500/50 text-red-600 dark:text-red-400")}>
                    {member.totalR >= 0 ? "+" : ""}{member.totalR}R
                  </span>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-2">
                    <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400">TP: {member.tpHit}</span>
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-600 dark:text-red-400">SL: {member.slHit}</span>
                      <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-600 dark:text-yellow-400">BE: {member.be}</span>
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-600 dark:text-blue-400">{t("digest.open")}: {member.openCount}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{t("digest.avgR")}: {member.avgR}</span>
                    </div>
                    {member.trades.length > 0 && (
                      <div className="space-y-1">
                        {member.trades.map((trade) => (
                          <div key={trade.tradeId} className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1.5 text-xs">
                            <DirectionBadge direction={trade.direction as "LONG" | "SHORT"} />
                            <span className="font-mono font-medium">{trade.instrument}</span>
                            <StatusBadge status={trade.status} />
                            {trade.r !== null ? (
                              <span className={cn("ms-auto font-mono font-medium", trade.r >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400")}>
                                {trade.r >= 0 ? "+" : ""}{trade.r}R
                              </span>
                            ) : (
                              <span className="ms-auto text-muted-foreground">—</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <p className={cn("text-lg font-bold", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
