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
  TrendingUp,
  TrendingDown,
  User,
  Users,
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
  type SafetyBand,
  type ConfidenceBand,
  type DigestDelta,
  type ActionItem,
  type AlertMemberInput,
  type ConcentrationCluster,
  type RiskBudget,
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

const SAFETY_STYLES: Record<SafetyBand, { text: string; border: string; bar: string; heroBg: string }> = {
  SAFE: { text: "text-green-600 dark:text-green-400", border: "border-green-500/30", bar: "bg-green-500", heroBg: "bg-green-500/15 dark:bg-green-500/10" },
  WATCH: { text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30", bar: "bg-yellow-500", heroBg: "bg-yellow-500/15 dark:bg-yellow-500/10" },
  AT_RISK: { text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30", bar: "bg-orange-500", heroBg: "bg-orange-500/15 dark:bg-orange-500/10" },
  CRITICAL: { text: "text-red-600 dark:text-red-400", border: "border-red-500/30", bar: "bg-red-500", heroBg: "bg-red-500/15 dark:bg-red-500/10" },
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

function pnlColor(v: number | null): string {
  if (v === null) return "text-muted-foreground";
  return v >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
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

// ─── Group attention items ───

interface GroupedItem {
  type: "single" | "trackingGroup";
  severity: AttentionSeverity;
  userId: string;
  username: string;
  tradeId?: string;
  instrument?: string;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
  kind?: string;
  count?: number;
  instruments?: string[];
}

function groupAttentionItems(
  items: DigestV2Response["attentionQueue"]
): GroupedItem[] {
  const trackingByMember = new Map<
    string,
    { username: string; count: number; instruments: string[]; severity: AttentionSeverity }
  >();
  const others: GroupedItem[] = [];

  for (const item of items) {
    if (item.kind === "TRACKING_LOST_OPEN_RISK") {
      const existing = trackingByMember.get(item.userId);
      if (existing) {
        existing.count++;
        if (item.instrument) existing.instruments.push(item.instrument);
      } else {
        trackingByMember.set(item.userId, {
          username: item.username,
          count: 1,
          instruments: item.instrument ? [item.instrument] : [],
          severity: item.severity as AttentionSeverity,
        });
      }
    } else {
      others.push({
        type: "single",
        severity: item.severity as AttentionSeverity,
        userId: item.userId,
        username: item.username,
        tradeId: item.tradeId,
        instrument: item.instrument,
        messageKey: item.messageKey,
        messageParams: item.messageParams as Record<string, string | number>,
        kind: item.kind,
      });
    }
  }

  const result: GroupedItem[] = [];
  for (const [userId, data] of trackingByMember) {
    result.push({
      type: "trackingGroup",
      severity: data.severity,
      userId,
      username: data.username,
      count: data.count,
      instruments: data.instruments,
    });
  }
  result.push(...others);
  return result;
}

// ─── Scope Types ───

type DigestScope = "trader" | "clan";

function buildTraderView(data: DigestV2Response): DigestV2Response | null {
  const myId = data.currentUserId;
  if (!myId) return null;

  const myMember = data.members.find((m) => m.userId === myId);
  if (!myMember) return null;

  // Trader state assessment from own positions only
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

  // Trader cockpit from member-level aggregates
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
    realizedPnl: null, // per-member realized PnL not available
    realizedR: myMember.closedTrades.length > 0 ? myMember.totalR : null,
    closedCount: myMember.closedTrades.length,
    officialWinRate: myMember.winRate > 0 ? myMember.winRate : null,
    officialCount: myMember.closedTrades.filter((t) => t.isOfficial).length,
    unofficialCount: myMember.closedTrades.filter((t) => !t.isOfficial).length,
  };

  // Trader concentration from own positions only
  const traderConcentration = computeConcentration(
    myMember.openPositions.map((p) => ({
      instrument: p.instrument,
      direction: p.direction,
      memberName: myMember.name,
      floatingR: p.floatingR,
      riskToSLR: p.riskToSLR,
    }))
  );

  // Trader alerts from own issues only
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

  // Trader risk budget
  const traderRiskBudget = computeRiskBudget({
    currentOpenRiskR: myMember.memberRiskToSLR,
    totalEquity: null,
    totalBalance: null,
    openTradeCount: myMember.openCount,
  });

  // Trader attention queue (own items only)
  const traderAttention = data.attentionQueue.filter((a) => a.userId === myId);

  // Trader tracking summary
  const traderTracking = {
    activeAccounts: hasActive ? 1 : 0,
    staleAccounts: hasStale ? 1 : 0,
    lostAccounts: hasLost ? 1 : 0,
  };

  // Trader live health summary
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

  // Trader summary
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
          <div className="flex items-center justify-between">
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

        <div className="mt-4 flex-1 overflow-y-auto pb-4">
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

// ─── V2 Content — Modern Dashboard Layout ───

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
  const hasTrackingIssue = ts.staleAccounts > 0 || ts.lostAccounts > 0;
  const grouped = groupAttentionItems(data.attentionQueue);
  const sa = data.stateAssessment;
  const hasOpenPositions = data.summary.openCount > 0;
  const hasClosedResults = c.closedCount > 0 || data.summary.totalCards > 0;

  return (
    <div className="space-y-6">
      {/* ═══ ZONE 1: State Overview ═══ */}
      <div className="space-y-3">
        <HeroStatusCard assessment={sa} t={t} />
        <DeltaStrip deltas={data.deltas} t={t} />
      </div>

      {/* ═══ ZONE 2: Actions & Warnings ═══ */}
      {(data.actions.length > 0 || (data.hints && data.hints.length > 0)) && (
        <div className="space-y-3">
          {data.actions.length > 0 && (
            <TopActionsBlock actions={data.actions} t={t} />
          )}
          {data.hints && data.hints.length > 0 && (
            <HintsBlock hints={data.hints} t={t} />
          )}
        </div>
      )}

      {/* ═══ ZONE 3: Key Metrics ═══ */}
      {(hasOpenPositions || hasClosedResults) && (
        <div className="space-y-3">
          {hasOpenPositions && (
            <div>
              <SectionHeader
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label={t("digest.cockpit.rightNow")}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <MetricCard
                  label={t("digest.cockpit.openPnl")}
                  value={fmtPnl(c.totalFloatingPnl)}
                  color={pnlColor(c.totalFloatingPnl)}
                />
                <MetricCard
                  label={t("digest.cockpit.openR")}
                  value={fmtR(c.totalFloatingR)}
                  color={pnlColor(c.totalFloatingR)}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t("digest.cockpit.slRisk")}:{" "}
                  <span className="font-mono text-orange-600 dark:text-orange-400">{fmtR(c.currentOpenRiskR)}</span>
                </span>
                {c.tradesNeedingAction > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {c.tradesNeedingAction} {t("digest.cockpit.needAction")}
                  </span>
                )}
                {c.unknownRiskCount > 0 && (
                  <span>{c.unknownRiskCount} {t("digest.cockpit.unknownRisk")}</span>
                )}
              </div>
            </div>
          )}

          {hasClosedResults && (
            <div>
              <SectionHeader
                icon={<TrendingDown className="h-3.5 w-3.5" />}
                label={t("digest.cockpit.periodResults")}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <MetricCard
                  label={t("digest.cockpit.realizedPnl")}
                  value={fmtPnl(c.realizedPnl)}
                  color={pnlColor(c.realizedPnl)}
                />
                <MetricCard
                  label={t("digest.cockpit.realizedR")}
                  value={fmtR(c.realizedR)}
                  color={pnlColor(c.realizedR)}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{c.closedCount} {t("digest.cockpit.closed")}</span>
                {c.officialWinRate !== null && (
                  <span>WR: <span className="font-mono text-green-600 dark:text-green-400">{c.officialWinRate}%</span></span>
                )}
                <span className="flex gap-1.5">
                  <span className="text-green-600 dark:text-green-400">TP:{data.summary.tpHit}</span>
                  <span className="text-red-600 dark:text-red-400">SL:{data.summary.slHit}</span>
                  {data.summary.be > 0 && (
                    <span className="text-yellow-600 dark:text-yellow-400">BE:{data.summary.be}</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {data.riskBudget && (
            <RiskBudgetBar budget={data.riskBudget} t={t} />
          )}
        </div>
      )}

      {/* ═══ ZONE 4: Position Overview ═══ */}
      {(data.concentration.length > 0 || (ts.activeAccounts + ts.staleAccounts + ts.lostAccounts) > 0) && (
        <div className="space-y-3">
          {data.concentration.length > 0 && (
            <ConcentrationBlock clusters={data.concentration} t={t} />
          )}

          {(ts.activeAccounts + ts.staleAccounts + ts.lostAccounts) > 0 && (
            <div className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
              hasTrackingIssue ? "bg-yellow-500/5" : "bg-green-500/5"
            )}>
              {hasTrackingIssue ? (
                <WifiOff className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
              ) : (
                <Wifi className="h-3.5 w-3.5 shrink-0 text-green-500" />
              )}
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {ts.activeAccounts > 0 && (
                  <span className="text-green-600 dark:text-green-400">
                    {ts.activeAccounts} {t("digest.tracking.active")}
                  </span>
                )}
                {ts.staleAccounts > 0 && (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    {ts.staleAccounts} {t("digest.tracking.stale")}
                  </span>
                )}
                {ts.lostAccounts > 0 && (
                  <span className="text-red-600 dark:text-red-400">
                    {ts.lostAccounts} {t("digest.tracking.lost")}
                  </span>
                )}
              </div>
              <span className="ms-auto text-[10px] text-muted-foreground">
                <Clock className="me-0.5 inline h-2.5 w-2.5" />
                {new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══ ZONE 5: Attention Queue ═══ */}
      {grouped.length > 0 && (
        <div>
          <SectionHeader
            icon={<AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
            label={`${t("digest.attention.title")} (${grouped.length})`}
          />
          <div className="mt-2 space-y-1.5">
            {grouped.map((item, i) => (
              <div
                key={`${item.userId}-${i}`}
                className={cn(
                  "rounded-lg border-s-2 bg-muted/30 px-3 py-2 text-xs",
                  SEVERITY_ACCENT[item.severity]
                )}
              >
                {item.type === "trackingGroup" ? (
                  <div className="flex items-center gap-2">
                    <WifiOff className="h-3 w-3 shrink-0 text-red-400" />
                    <span className="font-semibold">{item.username}</span>
                    <span className="text-muted-foreground">
                      {t("digest.cockpit.trackingLostGroup", { count: item.count ?? 0 })}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{item.username}</span>
                    {item.instrument && (
                      <span className="font-mono text-muted-foreground">{item.instrument}</span>
                    )}
                    {item.messageKey && (
                      <span className="text-muted-foreground">
                        — {t(item.messageKey, item.messageParams)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ZONE 6: Member Breakdown / My Positions ═══ */}
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
    </div>
  );
}

// ─── Hero Status Card ───

function HeroStatusCard({
  assessment,
  t,
}: {
  assessment: DigestV2Response["stateAssessment"];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const m = assessment.metrics;
  if (m.openTradeCount === 0) return null;

  const safety = SAFETY_STYLES[assessment.safetyBand as SafetyBand];
  const conf = CONFIDENCE_STYLES[assessment.confidenceBand as ConfidenceBand];

  const reasons: string[] = [];
  if (m.unprotectedCount > 0) reasons.push(t("digest.state.reason.unprotected", { count: m.unprotectedCount }));
  if (m.unknownRiskCount > 0) reasons.push(t("digest.state.reason.unknownRisk", { count: m.unknownRiskCount }));
  if (m.trackingLostTradeCount > 0) reasons.push(t("digest.confidence.reason.trackingLost", { count: m.trackingLostTradeCount }));
  if (m.needActionCount > 0) reasons.push(t("digest.state.reason.needAction", { count: m.needActionCount }));

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border p-4",
      safety.heroBg, safety.border
    )}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className={cn("text-xl font-black tracking-tight sm:text-2xl", safety.text)}>
            {t(`digest.state.${assessment.safetyBand.toLowerCase()}`)}
          </p>
          {reasons.length > 0 && assessment.safetyBand !== "SAFE" && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {reasons.slice(0, 3).join(" · ")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-end ps-4">
          <p className={cn("text-3xl font-black tabular-nums leading-none", safety.text)}>
            {assessment.safetyScore}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            {t("digest.state.title")}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 rounded-full bg-black/10 dark:bg-white/10">
          <div
            className={cn("h-full rounded-full transition-all", safety.bar)}
            style={{ width: `${Math.min(assessment.safetyScore, 100)}%` }}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={cn("text-sm font-bold tabular-nums", conf.text)}>
            {assessment.confidenceScore}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {t(`digest.confidence.${assessment.confidenceBand.toLowerCase()}`)}
          </span>
        </div>
      </div>
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

// ─── Top Actions Block ───

function TopActionsBlock({
  actions,
  t,
}: {
  actions: ActionItem[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
        {t("digest.actions.title")}
      </p>
      <div className="mt-2 space-y-2">
        {actions.map((action, i) => {
          const alertKey = `digest.actions.${action.alertType}`;
          const params: Record<string, string | number> = { count: action.issueCount };
          if (action.affectedMember) params.member = action.affectedMember;

          return (
            <div key={`${action.alertId}-${i}`} className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                {i + 1}
              </span>
              <span className="text-xs leading-relaxed text-foreground/90">
                {t(alertKey, params)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Metric Card ───

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl bg-muted/30 p-3">
      <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Risk Budget Bar ───

function RiskBudgetBar({
  budget,
  t,
}: {
  budget: RiskBudget;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const style = RISK_BUDGET_STYLES[budget.riskBudgetBand];
  const barWidth = Math.min(Math.abs(budget.totalOpenRiskR) * 10, 100);

  return (
    <div className="rounded-xl bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{t("digest.riskBudget.title")}</span>
        <span className={cn("font-mono font-bold", style.text)}>
          {fmtR(budget.totalOpenRiskR)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all", style.bar)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        <span>{t(`digest.riskBudget.${budget.riskBudgetBand.toLowerCase()}`)}</span>
        {budget.riskPctOfEquity !== null && (
          <span>{t("digest.riskBudget.equityImpact", { pct: budget.riskPctOfEquity })}</span>
        )}
      </div>
    </div>
  );
}

// ─── Concentration Block ───

function ConcentrationBlock({
  clusters,
  t,
}: {
  clusters: ConcentrationCluster[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const maxTrades = Math.max(...clusters.map((c) => c.tradeCount), 1);

  return (
    <div>
      <SectionHeader label={t("digest.concentration.title")} />
      <div className="mt-2 space-y-1.5">
        {clusters.slice(0, 5).map((c) => (
          <div
            key={`${c.instrument}:${c.direction}`}
            className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2"
          >
            <span className="w-16 shrink-0 font-mono text-sm font-semibold">{c.instrument}</span>
            <DirectionBadge direction={c.direction as "LONG" | "SHORT"} />
            <div className="flex-1 px-1">
              <div className="h-1 rounded-full bg-orange-500/15">
                <div
                  className="h-full rounded-full bg-orange-500/60"
                  style={{ width: `${(c.tradeCount / maxTrades) * 100}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {t("digest.concentration.trades", { count: c.tradeCount })}
              {c.memberCount > 1 && ` · ${t("digest.concentration.members", { count: c.memberCount })}`}
            </span>
            {c.totalRiskToSLR !== null && (
              <span className="shrink-0 font-mono text-xs text-orange-600 dark:text-orange-400">
                {fmtR(c.totalRiskToSLR)}
              </span>
            )}
          </div>
        ))}
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

// ─── Section Header ───

function SectionHeader({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {label}
    </h4>
  );
}

// ─── Member Card ───

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
    <div className={cn(
      "rounded-xl transition-colors",
      expanded ? "bg-muted/30" : "bg-muted/20"
    )}>
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-start"
        onClick={onToggle}
      >
        <Avatar className="h-9 w-9 shrink-0">
          {member.avatar && <AvatarImage src={member.avatar} />}
          <AvatarFallback className="text-sm font-medium">
            {member.name.charAt(0).toUpperCase()}
          </AvatarFallback>
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
            {member.openCount > 0 && (
              <span>{member.openCount} {t("digest.open")}</span>
            )}
            {member.openCount > 0 && member.memberFloatingR !== null && (
              <span className={cn("font-mono", pnlColor(member.memberFloatingR))}>
                {fmtR(member.memberFloatingR)}
              </span>
            )}
            {member.memberActionsNeeded > 0 && (
              <span className="text-red-600 dark:text-red-400">
                {member.memberActionsNeeded} {t("digest.cockpit.needAction")}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-end">
          <p className={cn(
            "text-base font-bold tabular-nums",
            member.totalR >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}>
            {member.totalR >= 0 ? "+" : ""}{member.totalR}R
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
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
                <span className={pnlColor(member.memberFloatingPnl)}>
                  P/L: {fmtPnl(member.memberFloatingPnl)}
                </span>
              )}
              {member.memberRiskToSLR !== null && (
                <span className="text-orange-600 dark:text-orange-400">
                  SL: {fmtR(member.memberRiskToSLR)}
                </span>
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
                  <OpenTradeRow
                    key={pos.tradeId}
                    position={pos}
                    expanded={expandedTrades.has(pos.tradeId)}
                    onToggle={() => onToggleTrade(pos.tradeId)}
                    t={t}
                  />
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
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs text-start"
        onClick={onToggle}
      >
        <DirectionBadge direction={position.direction as "LONG" | "SHORT"} />
        <span className="font-mono font-medium">{position.instrument}</span>
        <span className="ms-auto flex items-center gap-2 font-mono">
          {position.floatingPnl !== null && (
            <span className={cn("font-medium", pnlColor(position.floatingPnl))}>
              {fmtPnl(position.floatingPnl)}
            </span>
          )}
          {position.rComputable && position.floatingR !== null ? (
            <span className={cn("font-medium", pnlColor(position.floatingR))}>
              {fmtR(position.floatingR)}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">R?</span>
          )}
        </span>
        {expanded ? (
          <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-border/30 px-2.5 py-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]">
            {position.riskToSLR !== null && (
              <span className="text-orange-600 dark:text-orange-400">
                {t("digest.cockpit.slRisk")}: {fmtR(position.riskToSLR)}
              </span>
            )}
            <span className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
              healthColors.bg, healthColors.text
            )}>
              {t(`digest.health.${position.health.overall.toLowerCase()}`)}
            </span>
            {position.health.protectionStatus === "UNPROTECTED" && (
              <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                <ShieldOff className="h-2.5 w-2.5" />
                {t("digest.protection.unprotected")}
              </span>
            )}
            {position.health.protectionStatus === "BREAKEVEN_LOCKED" && (
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                <Shield className="h-2.5 w-2.5" />
                {t("digest.protection.breakevenLocked")}
              </span>
            )}
            {position.health.protectionStatus === "PROTECTED" && (
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                <Shield className="h-2.5 w-2.5" />
                {t("digest.protection.protected")}
              </span>
            )}
            {position.health.protectionStatus === "UNKNOWN_RISK" && (
              <span className="text-muted-foreground">
                {t("digest.protection.unknownRisk")}
              </span>
            )}
            {position.trackingStatus === "TRACKING_LOST" && (
              <span className="flex items-center gap-0.5 text-red-400">
                <WifiOff className="h-2.5 w-2.5" />
                {t("digest.tracking.lost")}
              </span>
            )}
            {position.trackingStatus === "STALE" && (
              <span className="flex items-center gap-0.5 text-yellow-400">
                <Clock className="h-2.5 w-2.5" />
                {t("digest.tracking.stale")}
              </span>
            )}
          </div>
          {action && (
            <div className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-2.5 w-2.5" />
              {action}
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
        <span title={t("digest.official")}>
          <Shield className="h-3 w-3 text-blue-500" />
        </span>
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

// ─── V1 Fallback Content ───

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
        <SummaryCard
          label={t("digest.totalR")}
          value={data.summary.totalR}
          color={data.summary.totalR >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
        />
        <SummaryCard
          label={t("digest.avgR")}
          value={data.summary.avgR}
          color={data.summary.avgR >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
        />
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

// ─── Shared Components ───

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <p className={cn("text-lg font-bold", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
