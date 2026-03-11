"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import type {
  SafetyBand,
  ConfidenceBand,
  DigestDelta,
  ActionItem,
  ConcentrationCluster,
  RiskBudget,
  RiskBudgetBand,
  MemberTrend,
  PredictiveHint,
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

const HEALTH_COLORS: Record<OverallHealth, { bg: string; text: string; border: string }> = {
  HEALTHY: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30" },
  NEEDS_REVIEW: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" },
  AT_RISK: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  BROKEN_PLAN: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
  LOW_CONFIDENCE: { bg: "bg-gray-500/10", text: "text-gray-500 dark:text-gray-400", border: "border-gray-500/30" },
};

const SEVERITY_COLORS: Record<AttentionSeverity, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
  WARNING: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" },
  INFO: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
};

// ─── Formatting helpers ───

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

// ─── Recommended action from health reasons ───

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

// ─── Group attention items: collapse tracking-lost by member ───

interface GroupedItem {
  type: "single" | "trackingGroup";
  severity: AttentionSeverity;
  userId: string;
  username: string;
  // single
  tradeId?: string;
  instrument?: string;
  messageKey?: string;
  messageParams?: Record<string, string | number>;
  kind?: string;
  // trackingGroup
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

  const hasData = isV2
    ? v2Data && (v2Data.summary.totalCards > 0 || v2Data.summary.openCount > 0)
    : v1Data && v1Data.summary.totalCards > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>{t("digest.title")}</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => fetchDigest(period)}
              disabled={loading}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </Button>
          </div>
        </SheetHeader>

        {/* Period Selector */}
        <div className="mt-4 flex gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(p.value)}
              disabled={loading}
            >
              {t(p.labelKey)}
            </Button>
          ))}
        </div>

        <div className="mt-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!loading && !hasData && (
            <EmptyState
              icon={ClipboardList}
              title={t("digest.empty")}
              description={t("digest.emptyDesc")}
            />
          )}

          {!loading && isV2 && v2Data && hasData && (
            <V2Content
              data={v2Data}
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

// ─── V2 Cockpit Content ───

function V2Content({
  data,
  expandedMembers,
  expandedTrades,
  toggleMember,
  toggleTrade,
  t,
}: {
  data: DigestV2Response;
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

  return (
    <div className="space-y-3">
      {/* ─── STATE STATUS BAR — safety + confidence ─── */}
      <StateStatusBar assessment={sa} t={t} />

      {/* ─── DELTA STRIP — what changed since last check ─── */}
      <DeltaStrip deltas={data.deltas} t={t} />

      {/* ─── TOP ACTIONS NOW ─── */}
      {data.actions.length > 0 && (
        <TopActionsBlock actions={data.actions} t={t} />
      )}

      {/* ─── PREDICTIVE HINTS (Phase 3) ─── */}
      {data.hints && data.hints.length > 0 && (
        <HintsBlock hints={data.hints} t={t} />
      )}

      {/* ─── RISK BUDGET (Phase 2+3) ─── */}
      {data.riskBudget && (
        <RiskBudgetBar budget={data.riskBudget} t={t} />
      )}

      {/* ─── CONCENTRATION CLUSTERS (Phase 2) ─── */}
      {data.concentration && data.concentration.length > 0 && (
        <ConcentrationBlock clusters={data.concentration} t={t} />
      )}

      {/* ─── Tracking bar (compact, only if issues or accounts exist) ─── */}
      {(ts.activeAccounts + ts.staleAccounts + ts.lostAccounts) > 0 && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
          hasTrackingIssue
            ? "border-yellow-500/30 bg-yellow-500/5"
            : "border-green-500/30 bg-green-500/5"
        )}>
          {hasTrackingIssue ? (
            <WifiOff className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          ) : (
            <Wifi className="h-3.5 w-3.5 shrink-0 text-green-500" />
          )}
          <div className="flex flex-wrap gap-2">
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

      {/* ─── RIGHT NOW — live open trade cockpit ─── */}
      {data.summary.openCount > 0 && (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            {t("digest.cockpit.rightNow")}
          </h4>
          <div className="grid grid-cols-3 gap-1.5">
            <CockpitCard
              label={t("digest.cockpit.openPnl")}
              value={fmtPnl(c.totalFloatingPnl)}
              color={pnlColor(c.totalFloatingPnl)}
            />
            <CockpitCard
              label={t("digest.cockpit.openR")}
              value={fmtR(c.totalFloatingR)}
              color={pnlColor(c.totalFloatingR)}
            />
            <CockpitCard
              label={t("digest.cockpit.slRisk")}
              value={fmtR(c.currentOpenRiskR)}
              color="text-orange-600 dark:text-orange-400"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
            {c.tradesNeedingAction > 0 && (
              <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-red-600 dark:text-red-400">
                {c.tradesNeedingAction} {t("digest.cockpit.needAction")}
              </span>
            )}
            <span className={cn(
              "rounded border px-1.5 py-0.5",
              c.liveConfidence === "HIGH"
                ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
                : c.liveConfidence === "PARTIAL"
                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
            )}>
              {t(`digest.cockpit.conf.${c.liveConfidence.toLowerCase()}`)}
            </span>
            {c.unknownRiskCount > 0 && (
              <span className="rounded border border-gray-500/30 bg-gray-500/10 px-1.5 py-0.5 text-muted-foreground">
                {c.unknownRiskCount} {t("digest.cockpit.unknownRisk")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── PERIOD RESULTS — realized closed metrics ─── */}
      {(c.closedCount > 0 || data.summary.totalCards > 0) && (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground">
            <TrendingDown className="h-3.5 w-3.5" />
            {t("digest.cockpit.periodResults")}
          </h4>
          <div className="grid grid-cols-3 gap-1.5">
            <CockpitCard
              label={t("digest.cockpit.realizedPnl")}
              value={fmtPnl(c.realizedPnl)}
              color={pnlColor(c.realizedPnl)}
            />
            <CockpitCard
              label={t("digest.cockpit.realizedR")}
              value={fmtR(c.realizedR)}
              color={pnlColor(c.realizedR)}
            />
            <CockpitCard
              label={t("digest.cockpit.closed")}
              value={String(c.closedCount)}
              color=""
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
            {c.officialWinRate !== null && (
              <span className="rounded border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400">
                WR: {c.officialWinRate}%
              </span>
            )}
            {c.officialCount > 0 && (
              <span className="rounded border px-1.5 py-0.5 text-muted-foreground">
                {c.officialCount} {t("digest.official")} / {c.unofficialCount} {t("digest.cockpit.unofficial")}
              </span>
            )}
            {/* Status breakdown */}
            <span className="rounded border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400">
              TP: {data.summary.tpHit}
            </span>
            <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-red-600 dark:text-red-400">
              SL: {data.summary.slHit}
            </span>
            {data.summary.be > 0 && (
              <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-yellow-600 dark:text-yellow-400">
                BE: {data.summary.be}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── NEEDS ATTENTION — grouped, deduplicated ─── */}
      {grouped.length > 0 && (
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
            {t("digest.attention.title")} ({grouped.length})
          </h4>
          <div className="space-y-1">
            {grouped.map((item, i) => {
              const colors = SEVERITY_COLORS[item.severity];
              return (
                <div
                  key={`${item.userId}-${i}`}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs",
                    colors.bg,
                    colors.border
                  )}
                >
                  {item.type === "trackingGroup" ? (
                    <div className="flex items-center gap-1.5">
                      <WifiOff className="h-3 w-3 shrink-0 text-red-400" />
                      <span className={cn("font-medium", colors.text)}>
                        {item.username}
                      </span>
                      <span className="text-muted-foreground">
                        — {t("digest.cockpit.trackingLostGroup", {
                          count: item.count ?? 0,
                        })}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span className={cn("font-medium", colors.text)}>
                        {item.username}
                      </span>
                      {item.instrument && (
                        <span className="ms-1 font-mono text-muted-foreground">
                          {item.instrument}
                        </span>
                      )}
                      {item.messageKey && (
                        <span className="ms-1 text-[11px] text-muted-foreground">
                          — {t(item.messageKey, item.messageParams)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── MEMBERS ─── */}
      <div>
        <h4 className="mb-1.5 text-xs font-semibold uppercase text-muted-foreground">
          {t("digest.memberBreakdown")}
        </h4>
        <div className="space-y-1">
          {data.members.map((member) => (
            <MemberCockpitRow
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
    </div>
  );
}

// ─── Member Row — numbers-first ───

function MemberCockpitRow({
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
    <div className="rounded-lg border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-start"
        onClick={onToggle}
      >
        <Avatar className="h-7 w-7 shrink-0">
          {member.avatar && <AvatarImage src={member.avatar} />}
          <AvatarFallback className="text-xs">
            {member.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate">{member.name}</span>
            {member.openCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {member.openCount} {t("digest.open")}
              </span>
            )}
            {member.memberImpactLabel && (
              <span className="rounded bg-orange-500/10 px-1 text-[9px] font-medium text-orange-600 dark:text-orange-400">
                {t(`digest.${member.memberImpactLabel.replace("digest.", "")}`)}
              </span>
            )}
            {member.memberTrend && member.memberTrend !== "new" && member.memberTrend !== "stable" && (
              <MemberTrendBadge trend={member.memberTrend} t={t} />
            )}
          </div>
          {/* Primary cockpit row: numbers */}
          {member.openCount > 0 && (
            <div className="flex flex-wrap gap-1.5 text-[10px] font-mono mt-0.5">
              {member.memberFloatingPnl !== null && (
                <span className={pnlColor(member.memberFloatingPnl)}>
                  {fmtPnl(member.memberFloatingPnl)}
                </span>
              )}
              {member.memberFloatingR !== null && (
                <span className={pnlColor(member.memberFloatingR)}>
                  {fmtR(member.memberFloatingR)}
                </span>
              )}
              {member.memberRiskToSLR !== null && (
                <span className="text-orange-600 dark:text-orange-400">
                  SL: {fmtR(member.memberRiskToSLR)}
                </span>
              )}
              {member.memberActionsNeeded > 0 && (
                <span className="rounded bg-red-500/10 px-1 text-red-600 dark:text-red-400">
                  {member.memberActionsNeeded} ⚠
                </span>
              )}
            </div>
          )}
        </div>
        {/* Period R badge */}
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-xs",
            member.totalR >= 0
              ? "border-green-500/50 text-green-600 dark:text-green-400"
              : "border-red-500/50 text-red-600 dark:text-red-400"
          )}
        >
          {member.totalR >= 0 ? "+" : ""}{member.totalR}R
        </Badge>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-2">
          {/* Period stats */}
          <div className="flex flex-wrap gap-1 text-xs">
            <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400">TP: {member.tpHit}</span>
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-600 dark:text-red-400">SL: {member.slHit}</span>
            <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-600 dark:text-yellow-400">BE: {member.be}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">WR: {member.winRate}%</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{t("digest.avgR")}: {member.avgR}</span>
          </div>

          {/* Open Positions */}
          {member.openPositions.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                {t("digest.openPositions")} ({member.openPositions.length})
              </p>
              <div className="space-y-1">
                {member.openPositions.map((pos) => (
                  <OpenTradeCockpitRow
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

          {/* Closed Trades */}
          {member.closedTrades.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
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

// ─── Open Trade Row — P/L first, health secondary ───

function OpenTradeCockpitRow({
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
  const action = getAction(
    position.health.reasons as string[],
    position.health.overall,
    t
  );

  return (
    <div className={cn(
      "rounded border",
      position.health.overall === "BROKEN_PLAN" && "border-red-500/30",
      position.health.overall === "AT_RISK" && "border-orange-500/30",
    )}>
      {/* Main row */}
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-xs text-start"
        onClick={onToggle}
      >
        <DirectionBadge direction={position.direction as "LONG" | "SHORT"} />
        <span className="font-mono font-medium">{position.instrument}</span>

        {/* Primary: P/L and R */}
        <span className="ms-auto flex items-center gap-1.5 font-mono">
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
            <span className="text-muted-foreground text-[10px]">R?</span>
          )}
        </span>

        {expanded ? (
          <ChevronUp className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t bg-muted/30 px-2 py-1.5 space-y-1">
          {/* Risk to SL */}
          <div className="flex flex-wrap gap-2 text-[10px]">
            {position.riskToSLR !== null && (
              <span className="text-orange-600 dark:text-orange-400">
                {t("digest.cockpit.slRisk")}: {fmtR(position.riskToSLR)}
              </span>
            )}
            {/* Health badge — secondary */}
            <span className={cn(
              "rounded border px-1 py-0.5 text-[9px] font-semibold",
              healthColors.bg, healthColors.text, healthColors.border
            )}>
              {t(`digest.health.${position.health.overall.toLowerCase()}`)}
            </span>
            {/* Protection — secondary */}
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
              <span className="flex items-center gap-0.5 text-muted-foreground">
                {t("digest.protection.unknownRisk")}
              </span>
            )}
            {/* Tracking */}
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
          {/* Recommended action */}
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
    <div className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1.5 text-xs">
      <DirectionBadge direction={trade.direction as "LONG" | "SHORT"} />
      <span className="font-mono font-medium">{trade.instrument}</span>
      <StatusBadge status={trade.status} />
      {trade.isOfficial && (
        <span title={t("digest.official")}>
          <Shield className="h-3 w-3 text-blue-500" />
        </span>
      )}
      {trade.r !== null ? (
        <span className={cn(
          "ms-auto font-mono font-medium",
          pnlColor(trade.r)
        )}>
          {trade.r >= 0 ? "+" : ""}{trade.r}R
        </span>
      ) : (
        <span className="ms-auto text-muted-foreground">—</span>
      )}
    </div>
  );
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
            const expanded = expandedMembers.has(member.userId);
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
                  <Badge variant="outline" className={cn("text-xs", member.totalR >= 0 ? "border-green-500/50 text-green-600 dark:text-green-400" : "border-red-500/50 text-red-600 dark:text-red-400")}>
                    {member.totalR >= 0 ? "+" : ""}{member.totalR}R
                  </Badge>
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {expanded && (
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

// ─── State Status Bar ───

const SAFETY_STYLES: Record<SafetyBand, { bg: string; text: string; border: string }> = {
  SAFE: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30" },
  WATCH: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" },
  AT_RISK: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  CRITICAL: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
};

const CONFIDENCE_STYLES: Record<ConfidenceBand, { text: string }> = {
  HIGH: { text: "text-green-600 dark:text-green-400" },
  MODERATE: { text: "text-yellow-600 dark:text-yellow-400" },
  LOW: { text: "text-orange-600 dark:text-orange-400" },
  DEGRADED: { text: "text-red-600 dark:text-red-400" },
};

function StateStatusBar({
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

  // Build explanation reasons
  const reasons: string[] = [];
  if (m.unprotectedCount > 0) reasons.push(t("digest.state.reason.unprotected", { count: m.unprotectedCount }));
  if (m.unknownRiskCount > 0) reasons.push(t("digest.state.reason.unknownRisk", { count: m.unknownRiskCount }));
  if (m.trackingLostTradeCount > 0) reasons.push(t("digest.confidence.reason.trackingLost", { count: m.trackingLostTradeCount }));
  if (m.needActionCount > 0) reasons.push(t("digest.state.reason.needAction", { count: m.needActionCount }));

  return (
    <div className={cn("rounded-lg border px-3 py-2", safety.bg, safety.border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold", safety.text)}>
            {t(`digest.state.${assessment.safetyBand.toLowerCase()}`)}
          </span>
          <span className="text-[10px] text-muted-foreground">({assessment.safetyScore})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn("text-xs font-medium", conf.text)}>
            {t(`digest.confidence.${assessment.confidenceBand.toLowerCase()}`)}
          </span>
          <span className="text-[10px] text-muted-foreground">({assessment.confidenceScore})</span>
        </div>
      </div>
      {reasons.length > 0 && assessment.safetyBand !== "SAFE" && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {reasons.slice(0, 3).join(" · ")}
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
      <div className="rounded-lg border border-dashed px-3 py-1.5 text-center text-[10px] text-muted-foreground">
        {t("digest.delta.baseline")}
      </div>
    );
  }

  if (deltas.length === 0) return null;

  // Show most impactful deltas first (by absolute delta value)
  const sorted = [...deltas].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);

  return (
    <div>
      <h4 className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
        {t("digest.delta.title")}
      </h4>
      <div className="flex flex-wrap gap-1">
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
                "rounded border px-1.5 py-0.5 text-[10px] font-mono",
                isGood && "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400",
                isBad && "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400",
                !isGood && !isBad && "border-gray-500/30 bg-gray-500/10 text-muted-foreground"
              )}
            >
              {label} {sign}{val}
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
    <div>
      <h4 className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
        <AlertTriangle className="h-3 w-3 text-orange-500" />
        {t("digest.actions.title")}
      </h4>
      <div className="space-y-1">
        {actions.map((action, i) => {
          const alertKey = `digest.actions.${action.alertType}`;
          const params: Record<string, string | number> = { count: action.issueCount };
          if (action.affectedMember) params.member = action.affectedMember;

          return (
            <div
              key={`${action.alertId}-${i}`}
              className="flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
            >
              <span className="shrink-0 text-sm font-bold text-muted-foreground">
                {i + 1}.
              </span>
              <span>{t(alertKey, params)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Concentration Block (Phase 2) ───

function ConcentrationBlock({
  clusters,
  t,
}: {
  clusters: ConcentrationCluster[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div>
      <h4 className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
        {t("digest.concentration.title")}
      </h4>
      <div className="space-y-1">
        {clusters.slice(0, 5).map((c) => (
          <div
            key={`${c.instrument}:${c.direction}`}
            className="flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-2.5 py-1.5 text-xs"
          >
            <span className="font-mono font-medium">{c.instrument}</span>
            <span className={cn(
              "rounded px-1 py-0.5 text-[9px] font-semibold",
              c.direction === "LONG"
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
            )}>
              {c.direction}
            </span>
            <span className="text-muted-foreground">
              {t("digest.concentration.trades", { count: c.tradeCount })}
            </span>
            {c.memberCount > 1 && (
              <span className="text-muted-foreground">
                · {t("digest.concentration.members", { count: c.memberCount })}
              </span>
            )}
            {c.totalRiskToSLR !== null && (
              <span className="ms-auto font-mono text-orange-600 dark:text-orange-400">
                {fmtR(c.totalRiskToSLR)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Risk Budget Bar (Phase 2+3) ───

const RISK_BUDGET_STYLES: Record<RiskBudgetBand, { bg: string; bar: string; text: string }> = {
  LOW: { bg: "bg-green-500/10", bar: "bg-green-500", text: "text-green-600 dark:text-green-400" },
  MODERATE: { bg: "bg-yellow-500/10", bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" },
  HIGH: { bg: "bg-orange-500/10", bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" },
  CRITICAL: { bg: "bg-red-500/10", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
};

function RiskBudgetBar({
  budget,
  t,
}: {
  budget: RiskBudget;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const style = RISK_BUDGET_STYLES[budget.riskBudgetBand];
  // Normalize risk to a 0-100 bar (10R = 100%)
  const barWidth = Math.min(Math.abs(budget.totalOpenRiskR) * 10, 100);

  return (
    <div className={cn("rounded-lg border px-3 py-2", style.bg)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{t("digest.riskBudget.title")}</span>
        <span className={cn("font-mono font-bold", style.text)}>
          {fmtR(budget.totalOpenRiskR)}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted/50">
        <div
          className={cn("h-full rounded-full transition-all", style.bar)}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground">
        <span>{t(`digest.riskBudget.${budget.riskBudgetBand.toLowerCase()}`)}</span>
        {budget.riskPctOfEquity !== null && (
          <span>{t("digest.riskBudget.equityImpact", { pct: budget.riskPctOfEquity })}</span>
        )}
      </div>
    </div>
  );
}

// ─── Predictive Hints Block (Phase 3) ───

function HintsBlock({
  hints,
  t,
}: {
  hints: PredictiveHint[];
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-1">
      {hints.slice(0, 3).map((h) => (
        <div
          key={h.metric}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px]",
            h.severity === "warning"
              ? "border-orange-500/30 bg-orange-500/5 text-orange-600 dark:text-orange-400"
              : "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400"
          )}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          <span>{t(h.hintKey)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Member Trend Badge (Phase 2) ───

function MemberTrendBadge({
  trend,
  t,
}: {
  trend: MemberTrend;
  t: (key: string) => string;
}) {
  if (trend === "improving") {
    return (
      <span className="rounded bg-green-500/10 px-1 text-[9px] font-medium text-green-600 dark:text-green-400">
        {t("digest.trend.improving")}
      </span>
    );
  }
  if (trend === "declining") {
    return (
      <span className="rounded bg-red-500/10 px-1 text-[9px] font-medium text-red-600 dark:text-red-400">
        {t("digest.trend.declining")}
      </span>
    );
  }
  return null;
}

// ─── Shared Components ───

function CockpitCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <p className={cn("text-base font-bold", color)}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
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
