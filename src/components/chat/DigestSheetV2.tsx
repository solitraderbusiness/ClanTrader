"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  TrendingDown,
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
  type SafetyBand,
  type ConfidenceBand,
  type DigestDelta,
  type ActionItem,
  type AlertMemberInput,
  type ConcentrationSummary,
  type EntryClusterInsight,
  type ScalingInsight,
  type SmartAction,
  type RiskBudgetBand,
  type MemberTrend,
  type PredictiveHint,
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
    totalBalance: null,
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
  const hasClosedResults = c.closedCount > 0;

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
      })),
      totalFloatingPnl: c.totalFloatingPnl,
      entryInsights: data.entryInsights ?? [],
      scalingInsights: data.scalingInsights ?? [],
      concentrationSummary: data.concentrationSummary ?? null,
    }),
    [allPositions, c.totalFloatingPnl, data.entryInsights, data.scalingInsights, data.concentrationSummary]
  );

  // Unprotected count for risk exposure
  const unprotectedCount = allPositions.filter(
    (p) => p.health.protectionStatus === "UNPROTECTED" || p.health.protectionStatus === "UNKNOWN_RISK"
  ).length;

  return (
    <div className="space-y-2">
      {/* ═══ ZONE 1: THE COCKPIT — Above the fold ═══ */}

      {/* 1A. System Status Bar — slim inline */}
      <SystemStatusBar
        tracking={ts}
        assessment={sa}
        hasTrackingIssue={hasTrackingIssue}
        generatedAt={data.generatedAt}
        t={t}
      />

      {/* 1B. The Money Line — P/L Hero */}
      {hasOpenPositions && (
        <MoneyLine
          cockpit={c}
          equity={data.riskBudget?.totalEquity ?? null}
          openCount={data.summary.openCount}
          t={t}
        />
      )}

      {/* 1D. Smart Actions — trade intelligence */}
      {smartActions.length > 0 && (
        <SmartActionsBlock actions={smartActions} t={t} />
      )}

      {/* ═══ ZONE 2: THE ANALYSIS — Scrollable cards ═══ */}

      {/* 2A. Position Summary */}
      {positionGroups.length > 0 && (
        <PositionSummaryCard groups={positionGroups} totalPnl={c.totalFloatingPnl ?? 0} t={t} />
      )}

      {/* 2B. Risk Exposure */}
      {hasOpenPositions && unprotectedCount > 0 && (
        <RiskExposureCard
          totalPnl={c.totalFloatingPnl}
          totalRisk={c.currentOpenRiskR}
          unprotectedCount={unprotectedCount}
          totalPositions={allPositions.length}
          t={t}
        />
      )}

      {/* 2C. Entry Quality */}
      {data.entryInsights && data.entryInsights.length > 0 && (
        <EntryQualityCard insights={data.entryInsights} t={t} />
      )}

      {/* 2D. Scaling Pattern */}
      {data.scalingInsights && data.scalingInsights.length > 0 && (
        <ScalingPatternCard insights={data.scalingInsights} positions={allPositions} t={t} />
      )}

      {/* 2E. Profit Attribution */}
      {allPositions.length > 1 && allPositions.some((p) => p.floatingPnl !== null) && (
        <ProfitAttributionCard positions={allPositions} nowMs={nowMs} t={t} />
      )}

      {/* 2G. Concentration */}
      {data.concentrationSummary && (
        <ConcentrationCard summary={data.concentrationSummary} t={t} />
      )}

      {/* Delta Strip */}
      <DeltaStrip deltas={data.deltas} t={t} />

      {/* Hints */}
      {data.hints && data.hints.length > 0 && (
        <HintsBlock hints={data.hints} t={t} />
      )}

      {/* ═══ ZONE 3: THE DETAILS ═══ */}

      {/* 3A/3B. Positions or Member Breakdown */}
      {scope === "clan" ? (
        <div>
          <SectionHeader label={t("digest.memberBreakdown")} />
          <div className="mt-2 space-y-2">
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
        </div>
      ) : data.members[0] && (data.members[0].openPositions.length > 0 || data.members[0].closedTrades.length > 0) ? (
        <div className="space-y-3">
          {data.members[0].openPositions.length > 0 && (
            <div>
              <SectionHeader label={`${t("digest.myPositions")} (${data.members[0].openPositions.length})`} />
              <div className="mt-2 space-y-1">
                {data.members[0].openPositions.map((pos) => (
                  <OpenTradeRow
                    key={pos.tradeId}
                    position={pos}
                    expanded={expandedTrades.has(pos.tradeId)}
                    onToggle={() => toggleTrade(pos.tradeId)}
                    t={t}
                  />
                ))}
              </div>
            </div>
          )}
          {data.members[0].closedTrades.length > 0 && (
            <div>
              <SectionHeader label={`${t("digest.myClosedTrades")} (${data.members[0].closedTrades.length})`} />
              <div className="mt-2 space-y-1">
                {data.members[0].closedTrades.map((trade) => (
                  <ClosedTradeRow key={trade.tradeId} trade={trade} t={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Period Results — only when there are actual results */}
      {hasClosedResults && (
        <PeriodResultsCard cockpit={c} summary={data.summary} t={t} />
      )}

      {/* 3C. System Health — collapsed at bottom */}
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
// ZONE 1 COMPONENTS
// ════════════════════════════════════════════

// ─── 1A. System Status Bar ───

function SystemStatusBar({
  tracking,
  assessment,
  hasTrackingIssue,
  generatedAt,
  t,
}: {
  tracking: DigestV2Response["trackingSummary"];
  assessment: DigestV2Response["stateAssessment"];
  hasTrackingIssue: boolean;
  generatedAt: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const safety = SAFETY_STYLES[assessment.safetyBand as SafetyBand];
  const totalAccounts = tracking.activeAccounts + tracking.staleAccounts + tracking.lostAccounts;

  // Slim banner for issues
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

  // Slim healthy bar
  if (totalAccounts > 0) {
    return (
      <div className="flex items-center gap-2 px-1 py-0.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", safety.dot)} />
        <span className="text-[10px] text-muted-foreground">{t("digest.status.live")}</span>
        <span className="ms-auto text-[10px] text-muted-foreground">
          {new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  return null;
}

// ─── 1B. Money Line ───

function MoneyLine({
  cockpit,
  equity,
  openCount,
  t,
}: {
  cockpit: DigestV2Response["cockpit"];
  equity: number | null;
  openCount: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const pnl = cockpit.totalFloatingPnl;
  const pnlPct = equity && equity > 0 && pnl !== null ? (pnl / equity) * 100 : null;

  return (
    <div className="rounded-xl bg-muted/20 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className={cn("text-3xl font-black tabular-nums tracking-tight", pnlColor(pnl))}>
          {pnl !== null ? fmtCurrency(pnl) : "—"}
        </span>
        {pnlPct !== null && (
          <span className={cn("text-lg font-bold tabular-nums", pnlColor(pnl))}>
            {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{t("digest.moneyLine.openPnl")} · {openCount} {t("digest.moneyLine.positions")}</span>
        {pnlPct !== null && <span>{t("digest.moneyLine.ofEquity")}</span>}
      </div>
      {/* Secondary metrics row */}
      <div className="mt-2 flex items-center gap-3 text-xs">
        {cockpit.totalFloatingR !== null && (
          <span className={cn("font-mono font-semibold", pnlColor(cockpit.totalFloatingR))}>
            {fmtR(cockpit.totalFloatingR)}
          </span>
        )}
        {cockpit.currentOpenRiskR !== null && (
          <span className="font-mono text-orange-600 dark:text-orange-400">
            {t("digest.cockpit.slRisk")}: {fmtR(cockpit.currentOpenRiskR)}
          </span>
        )}
        {cockpit.unknownRiskCount > 0 && (
          <span className="text-muted-foreground">
            {cockpit.unknownRiskCount} {t("digest.cockpit.unknownRisk")}
          </span>
        )}
      </div>
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
    <div className="space-y-1.5">
      {actions.map((action, i) => {
        const Icon = SMART_ICON_MAP[action.icon];
        const iconColor = SMART_ICON_COLORS[action.icon];
        return (
          <div
            key={`smart-${i}`}
            className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5"
          >
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
// ZONE 2 COMPONENTS
// ════════════════════════════════════════════

// ─── 2A. Position Summary Card ───

function PositionSummaryCard({
  groups,
  totalPnl,
  t,
}: {
  groups: PositionGroup[];
  totalPnl: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div>
      <SectionHeader label={t("digest.posSummary.title")} />
      <div className="mt-1.5 space-y-1.5">
        {groups.map((g) => {
          const absPnl = Math.abs(g.totalPnl);
          const barWidth = totalPnl !== 0 ? Math.min((absPnl / Math.abs(totalPnl)) * 100, 100) : 0;

          return (
            <div key={`${g.instrument}:${g.direction}`} className="rounded-lg bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <DirectionBadge direction={g.direction as "LONG" | "SHORT"} />
                <span className="font-mono font-semibold">{g.instrument}</span>
                <span className="text-muted-foreground">
                  {g.positions.length} {t("digest.insight.trades")} · {g.totalLots} {t("digest.insight.lots")}
                </span>
                <span className={cn("ms-auto font-mono font-bold", pnlColor(g.totalPnl))}>
                  {fmtCurrency(g.totalPnl)}
                </span>
              </div>
              {/* P/L contribution bar */}
              <div className="mt-1.5 h-1.5 rounded-full bg-muted/50">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    g.totalPnl >= 0 ? "bg-green-500/60" : "bg-red-500/60"
                  )}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              {g.avgEntry !== null && (
                <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
                  <span>{t("digest.posSummary.avgEntry")}: <span className="font-mono">{g.avgEntry}</span></span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2B. Risk Exposure Card ───

function RiskExposureCard({
  totalPnl,
  totalRisk,
  unprotectedCount,
  totalPositions,
  t,
}: {
  totalPnl: number | null;
  totalRisk: number | null;
  unprotectedCount: number;
  totalPositions: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
          {t("digest.riskExposure.title")}
        </p>
        <ShieldOff className="h-3.5 w-3.5 text-red-500/60" />
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {totalPnl !== null && totalPnl > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("digest.riskExposure.unprotectedPnl")}</span>
            <span className="font-mono font-semibold text-red-600 dark:text-red-400">{fmtCurrency(totalPnl)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t("digest.riskExposure.noSL")}</span>
          <span className="font-mono">{unprotectedCount}/{totalPositions} {t("digest.insight.trades")}</span>
        </div>
        {totalRisk !== null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("digest.cockpit.slRisk")}</span>
            <span className="font-mono text-orange-600 dark:text-orange-400">{fmtR(totalRisk)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 2C. Entry Quality Card ───

const ENTRY_QUALITY_STYLES: Record<EntryClusterInsight["qualityLabel"], { text: string; bg: string }> = {
  tight: { text: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
  spread: { text: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10" },
  wide: { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  unknown: { text: "text-muted-foreground", bg: "bg-muted/30" },
};

function EntryQualityCard({
  insights,
  t,
}: {
  insights: EntryClusterInsight[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div>
      <SectionHeader label={t("digest.insight.entryQuality")} />
      <div className="mt-1.5 space-y-1.5">
        {insights.slice(0, 3).map((ins) => {
          const qStyle = ENTRY_QUALITY_STYLES[ins.qualityLabel];
          return (
            <div key={`${ins.instrument}:${ins.direction}`} className="rounded-lg bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold">{ins.instrument}</span>
                <DirectionBadge direction={ins.direction as "LONG" | "SHORT"} />
                <span className={cn("ms-auto rounded-full px-2 py-0.5 text-[10px] font-semibold", qStyle.text, qStyle.bg)}>
                  {t(`digest.insight.quality.${ins.qualityLabel}`)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                {ins.weightedAvgEntry !== null && (
                  <span>{t("digest.insight.avgEntry")}: <span className="font-mono">{ins.weightedAvgEntry}</span></span>
                )}
                {ins.entrySpreadPct !== null && (
                  <span>{t("digest.insight.entrySpread")}: <span className="font-mono">{ins.entrySpreadPct}%</span></span>
                )}
                <span>{ins.tradeCount} {t("digest.insight.trades")}</span>
              </div>
              {/* Insight sentence */}
              {ins.qualityLabel === "wide" && ins.entrySpreadPct !== null && ins.entrySpreadPct > 5 && (
                <p className="mt-1 text-[10px] text-orange-600 dark:text-orange-400">
                  {t("digest.entryInsight.wideSpread", { pct: ins.entrySpreadPct })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2D. Scaling Pattern Card ───

const SCALING_PATTERN_STYLES: Record<ScalingInsight["pattern"], { text: string; bg: string }> = {
  balanced: { text: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
  increasing: { text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
  decreasing: { text: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
  spike: { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  unknown: { text: "text-muted-foreground", bg: "bg-muted/30" },
};

function ScalingPatternCard({
  insights,
  positions,
  t,
}: {
  insights: ScalingInsight[];
  positions: OpenPositionV2[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div>
      <SectionHeader label={t("digest.insight.scalingPattern")} />
      <div className="mt-1.5 space-y-1.5">
        {insights.slice(0, 3).map((ins) => {
          const pStyle = SCALING_PATTERN_STYLES[ins.pattern];
          const lastVsAvgPct = Math.round((ins.lastLegVsAvg - 1) * 100);
          const largestPct = Math.round(ins.largestLegShare * 100);

          // Get individual legs for this cluster
          const clusterPositions = positions
            .filter((p) => p.instrument === ins.instrument && p.direction === ins.direction && p.lots != null && p.lots > 0)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

          return (
            <div key={`${ins.instrument}:${ins.direction}`} className="rounded-lg bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono font-semibold">{ins.instrument}</span>
                <DirectionBadge direction={ins.direction as "LONG" | "SHORT"} />
                <span className={cn("ms-auto rounded-full px-2 py-0.5 text-[10px] font-semibold", pStyle.text, pStyle.bg)}>
                  {t(`digest.insight.pattern.${ins.pattern}`)}
                </span>
              </div>
              {/* Entry timeline */}
              {clusterPositions.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {clusterPositions.map((p) => {
                    const isLargest = p.lots === ins.largestLegLots;
                    return (
                      <div key={p.tradeId} className="flex items-center gap-2 text-[10px]">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isLargest ? "bg-orange-500" : "bg-muted-foreground/40")} />
                        <span className={cn("w-14 font-mono", isLargest ? "font-bold text-foreground" : "text-muted-foreground")}>
                          {p.lots} {t("digest.insight.lots")}
                        </span>
                        {p.openPrice != null && (
                          <span className="font-mono text-muted-foreground">@ {p.openPrice}</span>
                        )}
                        <span className="ms-auto text-muted-foreground/60">
                          {new Date(p.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                        {isLargest && (
                          <span className="text-[9px] text-orange-500">←</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                <span>{ins.legCount} {t("digest.insight.legs")} · {ins.totalLots} {t("digest.insight.lots")}</span>
                <span>{t("digest.insight.largestLeg")}: {largestPct}%</span>
                {lastVsAvgPct !== 0 && (
                  <span className={lastVsAvgPct > 50 ? "text-orange-600 dark:text-orange-400" : ""}>
                    {t("digest.insight.lastLeg")}: {lastVsAvgPct > 0 ? "+" : ""}{lastVsAvgPct}% {t("digest.insight.vsAvg")}
                  </span>
                )}
              </div>
              {/* Insight sentence for dangerous patterns */}
              {ins.pattern === "increasing" && ins.lastLegVsAvg > 1.4 && (
                <p className="mt-1 text-[10px] text-orange-600 dark:text-orange-400">
                  {t("digest.scalingInsight.increasing")}
                </p>
              )}
              {ins.pattern === "spike" && ins.largestLegShare > 0.5 && (
                <p className="mt-1 text-[10px] text-orange-600 dark:text-orange-400">
                  {t("digest.scalingInsight.spike", { pct: largestPct })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2E. Profit Attribution Card ───

function ProfitAttributionCard({
  positions,
  nowMs,
  t,
}: {
  positions: OpenPositionV2[];
  nowMs: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const sorted = [...positions]
    .filter((p) => p.floatingPnl !== null)
    .sort((a, b) => Math.abs(b.floatingPnl ?? 0) - Math.abs(a.floatingPnl ?? 0));

  if (sorted.length === 0) return null;

  const totalPnl = sorted.reduce((s, p) => s + (p.floatingPnl ?? 0), 0);
  const maxAbsPnl = Math.max(...sorted.map((p) => Math.abs(p.floatingPnl ?? 0)));

  return (
    <div>
      <SectionHeader label={t("digest.profitAttribution.title")} />
      <div className="mt-1.5 space-y-1">
        {sorted.slice(0, 6).map((p) => {
          const pnl = p.floatingPnl ?? 0;
          const pct = totalPnl !== 0 ? (pnl / totalPnl) * 100 : 0;
          const barWidth = maxAbsPnl > 0 ? (Math.abs(pnl) / maxAbsPnl) * 100 : 0;
          const days = Math.max(1, (nowMs - new Date(p.createdAt).getTime()) / 86400000);
          const perDay = pnl / days;

          return (
            <div key={p.tradeId} className="rounded-lg bg-muted/20 px-3 py-1.5">
              <div className="flex items-center gap-2 text-[11px]">
                <DirectionBadge direction={p.direction as "LONG" | "SHORT"} />
                <span className="font-mono text-xs">{p.instrument}</span>
                {p.lots != null && (
                  <span className="text-muted-foreground">{p.lots}L</span>
                )}
                {p.openPrice != null && (
                  <span className="text-muted-foreground">@{p.openPrice}</span>
                )}
                <span className={cn("ms-auto font-mono font-semibold", pnlColor(pnl))}>
                  {fmtCurrency(pnl)}
                </span>
                <span className="w-10 text-end text-[10px] text-muted-foreground">
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-muted/50">
                  <div
                    className={cn("h-full rounded-full", pnl >= 0 ? "bg-green-500/50" : "bg-red-500/50")}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="shrink-0 text-[9px] text-muted-foreground">
                  {fmtCurrency(perDay)}/{t("digest.profitAttribution.day")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 2G. Concentration Card ───

const CONCENTRATION_RISK_STYLES: Record<ConcentrationSummary["riskLevel"], { bg: string; text: string; border: string }> = {
  low: { bg: "bg-green-500/5", text: "text-green-600 dark:text-green-400", border: "border-green-500/20" },
  moderate: { bg: "bg-yellow-500/5", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/20" },
  high: { bg: "bg-orange-500/5", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" },
  critical: { bg: "bg-red-500/5", text: "text-red-600 dark:text-red-400", border: "border-red-500/20" },
};

function ConcentrationCard({
  summary,
  t,
}: {
  summary: ConcentrationSummary;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const style = CONCENTRATION_RISK_STYLES[summary.riskLevel];
  const topPct = Math.round(summary.topSymbolShare * 100);
  const longPct = Math.round(summary.longShare * 100);
  const shortPct = Math.round(summary.shortShare * 100);

  return (
    <div className={cn("rounded-xl border p-3", style.bg, style.border)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("digest.insight.concentrationRisk")}
        </p>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", style.text, style.bg)}>
          {t(`digest.insight.risk.${summary.riskLevel}`)}
        </span>
      </div>

      {/* Symbol bar */}
      {summary.topSymbol && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">{summary.topSymbol}</span>
            <span className={cn("font-mono font-semibold", style.text)}>{topPct}%</span>
          </div>
          <div className="mt-0.5 h-1.5 rounded-full bg-muted/30">
            <div className={cn("h-full rounded-full", style.text.replace("text-", "bg-").replace(" dark:text-", " dark:bg-").split(" ")[0] + "/40")} style={{ width: `${topPct}%` }} />
          </div>
        </div>
      )}

      {/* Direction bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">{t("digest.insight.directionBalance")}</span>
          {summary.singleDirectionExposure ? (
            <span className={style.text}>100% {longPct === 100 ? "LONG" : "SHORT"}</span>
          ) : (
            <span className="font-mono">
              <span className="text-green-600 dark:text-green-400">{longPct}%L</span>
              {" / "}
              <span className="text-red-600 dark:text-red-400">{shortPct}%S</span>
            </span>
          )}
        </div>
        <div className="mt-0.5 flex h-1.5 overflow-hidden rounded-full bg-muted/30">
          <div className="h-full bg-green-500/50" style={{ width: `${longPct}%` }} />
          <div className="h-full bg-red-500/50" style={{ width: `${shortPct}%` }} />
        </div>
      </div>

      {/* Warning */}
      {(summary.singleSymbolExposure || summary.singleDirectionExposure) && summary.riskLevel !== "low" && (
        <p className={cn("mt-2 text-[10px] leading-relaxed", style.text)}>
          {summary.singleSymbolExposure && summary.singleDirectionExposure
            ? t("digest.insight.concentrationWarnBoth", { symbol: summary.topSymbol ?? "?" })
            : summary.singleSymbolExposure
              ? t("digest.insight.concentrationWarnSymbol", { symbol: summary.topSymbol ?? "?" })
              : t("digest.insight.concentrationWarnDirection")}
        </p>
      )}
    </div>
  );
}

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

// ─── Hints Block ───

function HintsBlock({
  hints,
  t,
}: {
  hints: PredictiveHint[];
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-1.5">
      {hints.slice(0, 3).map((h) => (
        <div
          key={h.metric}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
            h.severity === "warning"
              ? "bg-orange-500/5 text-orange-600 dark:text-orange-400"
              : "bg-blue-500/5 text-blue-600 dark:text-blue-400"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{t(h.hintKey)}</span>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════
// ZONE 3 COMPONENTS
// ════════════════════════════════════════════

// ─── Period Results Card ───

function PeriodResultsCard({
  cockpit,
  summary,
  t,
}: {
  cockpit: DigestV2Response["cockpit"];
  summary: DigestV2Response["summary"];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div>
      <SectionHeader
        icon={<TrendingDown className="h-3.5 w-3.5" />}
        label={t("digest.cockpit.periodResults")}
      />
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/20 px-3 py-2 text-xs">
        <span>{cockpit.closedCount} {t("digest.cockpit.closed")}</span>
        {cockpit.realizedR !== null && (
          <span className={cn("font-mono font-semibold", pnlColor(cockpit.realizedR))}>
            {fmtR(cockpit.realizedR)}
          </span>
        )}
        {cockpit.officialWinRate !== null && (
          <span>WR: <span className="font-mono text-green-600 dark:text-green-400">{cockpit.officialWinRate}%</span></span>
        )}
        <span className="flex gap-1.5">
          <span className="text-green-600 dark:text-green-400">TP:{summary.tpHit}</span>
          <span className="text-red-600 dark:text-red-400">SL:{summary.slHit}</span>
          {summary.be > 0 && <span className="text-yellow-600 dark:text-yellow-400">BE:{summary.be}</span>}
        </span>
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
