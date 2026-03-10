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
  ShieldAlert,
  ShieldCheck,
  Activity,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ClanDigestData, DigestPeriod } from "@/types/clan-digest";
import type {
  DigestV2Response,
  OpenPositionV2,
  ClosedTradeV2,
} from "@/lib/digest-v2-schema";
import type {
  OverallHealth,
  AttentionSeverity,
} from "@/lib/open-trade-health";

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

// Health badge color mappings
const HEALTH_COLORS: Record<OverallHealth, { bg: string; text: string; border: string }> = {
  HEALTHY: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/30" },
  NEEDS_REVIEW: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" },
  AT_RISK: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/30" },
  BROKEN_PLAN: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30" },
  LOW_CONFIDENCE: { bg: "bg-gray-500/10", text: "text-gray-500 dark:text-gray-400", border: "border-gray-500/30" },
};

const SEVERITY_COLORS: Record<AttentionSeverity, { bg: string; text: string; border: string; icon: string }> = {
  CRITICAL: { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/30", icon: "text-red-500" },
  WARNING: { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30", icon: "text-yellow-500" },
  INFO: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30", icon: "text-blue-500" },
};

export function DigestSheetV2({ open, onOpenChange, clanId }: DigestSheetV2Props) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<DigestPeriod>("today");
  const [v1Data, setV1Data] = useState<ClanDigestData | null>(null);
  const [v2Data, setV2Data] = useState<DigestV2Response | null>(null);
  const [isV2, setIsV2] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

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

  const hasData = isV2
    ? v2Data && v2Data.summary.totalCards > 0
    : v1Data && v1Data.summary.totalCards > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{t("digest.title")}</SheetTitle>
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

          {/* V2 Content */}
          {!loading && isV2 && v2Data && hasData && (
            <V2Content
              data={v2Data}
              expandedMembers={expandedMembers}
              toggleMember={toggleMember}
              t={t}
            />
          )}

          {/* V1 Fallback */}
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

// ─── V2 Health-First Content ───

function V2Content({
  data,
  expandedMembers,
  toggleMember,
  t,
}: {
  data: DigestV2Response;
  expandedMembers: Set<string>;
  toggleMember: (id: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Attention Queue — highest priority, shown first */}
      {data.attentionQueue.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            {t("digest.attention.title")}
          </h4>
          <div className="space-y-1.5">
            {data.attentionQueue.map((item, i) => {
              const colors = SEVERITY_COLORS[item.severity as AttentionSeverity];
              return (
                <div
                  key={`${item.tradeId ?? item.userId}-${i}`}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                    colors.bg,
                    colors.border
                  )}
                >
                  <ShieldAlert className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", colors.icon)} />
                  <div className="min-w-0 flex-1">
                    <span className={cn("font-medium", colors.text)}>
                      {item.username}
                    </span>
                    {item.instrument && (
                      <span className="ms-1 font-mono text-muted-foreground">
                        {item.instrument}
                      </span>
                    )}
                    <p className={cn("mt-0.5", colors.text)}>
                      {t(item.messageKey, item.messageParams as Record<string, string | number>)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 text-[10px]", colors.text, colors.border)}
                  >
                    {t(`digest.severity.${item.severity.toLowerCase()}`)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Health Summary Chips */}
      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Activity className="h-4 w-4 text-blue-500" />
          {t("digest.liveHealth.title")}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          <HealthChip
            count={data.liveHealthSummary.healthyPositions}
            label={t("digest.health.healthy")}
            health="HEALTHY"
          />
          <HealthChip
            count={data.liveHealthSummary.needsReviewPositions}
            label={t("digest.health.needsReview")}
            health="NEEDS_REVIEW"
          />
          <HealthChip
            count={data.liveHealthSummary.atRiskPositions}
            label={t("digest.health.atRisk")}
            health="AT_RISK"
          />
          <HealthChip
            count={data.liveHealthSummary.brokenPlanPositions}
            label={t("digest.health.brokenPlan")}
            health="BROKEN_PLAN"
          />
          <HealthChip
            count={data.liveHealthSummary.lowConfidencePositions}
            label={t("digest.health.lowConfidence")}
            health="LOW_CONFIDENCE"
          />
          {data.liveHealthSummary.unprotectedPositions > 0 && (
            <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-600 dark:text-red-400">
              {data.liveHealthSummary.unprotectedPositions} {t("digest.liveHealth.unprotected")}
            </span>
          )}
          {data.liveHealthSummary.fragileWinnerPositions > 0 && (
            <span className="rounded border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-600 dark:text-orange-400">
              {data.liveHealthSummary.fragileWinnerPositions} {t("digest.liveHealth.fragileWinners")}
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryCard label={t("digest.signals")} value={data.summary.totalSignals} />
        <SummaryCard label={t("digest.analysis")} value={data.summary.totalAnalysis} />
        <SummaryCard
          label={t("digest.winRate")}
          value={`${data.summary.winRate}%`}
        />
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

      {/* Status Line */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-green-600 dark:text-green-400">
          TP: {data.summary.tpHit}
        </span>
        <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400">
          SL: {data.summary.slHit}
        </span>
        <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-600 dark:text-yellow-400">
          BE: {data.summary.be}
        </span>
        <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-400">
          {t("digest.open")}: {data.summary.openCount}
        </span>
      </div>

      {/* Member Breakdown */}
      <div>
        <h4 className="mb-2 text-sm font-medium">{t("digest.memberBreakdown")}</h4>
        <div className="space-y-1">
          {data.members.map((member) => {
            const expanded = expandedMembers.has(member.userId);
            const worstHealth = getWorstOpenHealth(member.openPositions);
            return (
              <div key={member.userId} className="rounded-lg border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start"
                  onClick={() => toggleMember(member.userId)}
                >
                  <Avatar className="h-7 w-7">
                    {member.avatar && <AvatarImage src={member.avatar} />}
                    <AvatarFallback className="text-xs">
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{member.name}</span>
                    <span className="ms-2 text-xs text-muted-foreground">
                      {member.signalCount}S / {member.analysisCount}A
                    </span>
                  </div>
                  {/* Show worst open health badge if they have open positions */}
                  {member.openCount > 0 && worstHealth && (
                    <HealthBadge health={worstHealth} t={t} />
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      member.totalR >= 0
                        ? "border-green-500/50 text-green-600 dark:text-green-400"
                        : "border-red-500/50 text-red-600 dark:text-red-400"
                    )}
                  >
                    {member.totalR >= 0 ? "+" : ""}
                    {member.totalR}R
                  </Badge>
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {expanded && (
                  <div className="border-t px-3 pb-3 pt-2">
                    {/* Member stats */}
                    <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400">
                        TP: {member.tpHit}
                      </span>
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-600 dark:text-red-400">
                        SL: {member.slHit}
                      </span>
                      <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-600 dark:text-yellow-400">
                        BE: {member.be}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                        WR: {member.winRate}%
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                        {t("digest.avgR")}: {member.avgR}
                      </span>
                    </div>

                    {/* Open Positions — health-first */}
                    {member.openPositions.length > 0 && (
                      <div className="mb-2">
                        <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
                          {t("digest.openPositions")} ({member.openPositions.length})
                        </p>
                        <div className="space-y-1">
                          {member.openPositions.map((pos) => (
                            <OpenPositionRow key={pos.tradeId} position={pos} t={t} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Closed Trades — R-centric */}
                    {member.closedTrades.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">
                          {t("digest.closedTrades")} ({member.closedTrades.length})
                        </p>
                        <div className="space-y-1">
                          {member.closedTrades.map((trade) => (
                            <ClosedTradeRow key={trade.tradeId} trade={trade} />
                          ))}
                        </div>
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

// ─── V1 Fallback Content (same as original DigestSheet) ───

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
        <span className="rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-green-600 dark:text-green-400">
          TP: {data.summary.tpHit}
        </span>
        <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400">
          SL: {data.summary.slHit}
        </span>
        <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-600 dark:text-yellow-400">
          BE: {data.summary.be}
        </span>
        <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-400">
          {t("digest.open")}: {data.summary.openCount}
        </span>
      </div>

      <div>
        <h4 className="mb-2 text-sm font-medium">{t("digest.memberBreakdown")}</h4>
        <div className="space-y-1">
          {data.members.map((member) => {
            const expanded = expandedMembers.has(member.userId);
            return (
              <div key={member.userId} className="rounded-lg border">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-start"
                  onClick={() => toggleMember(member.userId)}
                >
                  <Avatar className="h-7 w-7">
                    {member.avatar && <AvatarImage src={member.avatar} />}
                    <AvatarFallback className="text-xs">
                      {member.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{member.name}</span>
                    <span className="ms-2 text-xs text-muted-foreground">
                      {member.signalCount}S / {member.analysisCount}A
                      {" · "}
                      {member.winRate}% WR
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      member.totalR >= 0
                        ? "border-green-500/50 text-green-600 dark:text-green-400"
                        : "border-red-500/50 text-red-600 dark:text-red-400"
                    )}
                  >
                    {member.totalR >= 0 ? "+" : ""}
                    {member.totalR}R
                  </Badge>
                  {expanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {expanded && (
                  <div className="border-t px-3 pb-3 pt-2">
                    <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-600 dark:text-green-400">
                        TP: {member.tpHit}
                      </span>
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-red-600 dark:text-red-400">
                        SL: {member.slHit}
                      </span>
                      <span className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-yellow-600 dark:text-yellow-400">
                        BE: {member.be}
                      </span>
                      <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-600 dark:text-blue-400">
                        {t("digest.open")}: {member.openCount}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                        {t("digest.avgR")}: {member.avgR}
                      </span>
                    </div>

                    {member.trades.length > 0 && (
                      <div className="space-y-1">
                        {member.trades.map((trade) => (
                          <div
                            key={trade.tradeId}
                            className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1.5 text-xs"
                          >
                            <DirectionBadge direction={trade.direction as "LONG" | "SHORT"} />
                            <span className="font-mono font-medium">{trade.instrument}</span>
                            <StatusBadge status={trade.status} />
                            {trade.r !== null && (
                              <span
                                className={cn(
                                  "ms-auto font-mono font-medium",
                                  trade.r >= 0
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                )}
                              >
                                {trade.r >= 0 ? "+" : ""}
                                {trade.r}R
                              </span>
                            )}
                            {trade.r === null && (
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

// ─── V2 Sub-Components ───

function OpenPositionRow({
  position,
  t,
}: {
  position: OpenPositionV2;
  t: (key: string) => string;
}) {
  const healthColors = HEALTH_COLORS[position.health.overall as OverallHealth];
  return (
    <div className="flex items-center gap-1.5 rounded bg-muted/50 px-2 py-1.5 text-xs">
      <DirectionBadge direction={position.direction as "LONG" | "SHORT"} />
      <span className="font-mono font-medium">{position.instrument}</span>

      {/* Primary: Health badge */}
      <span
        className={cn(
          "rounded border px-1.5 py-0.5 text-[10px] font-medium",
          healthColors.bg,
          healthColors.text,
          healthColors.border
        )}
      >
        {t(`digest.health.${position.health.overall.toLowerCase()}`)}
      </span>

      {/* Protection indicator */}
      {position.health.protectionStatus === "UNPROTECTED" && (
        <ShieldAlert className="h-3 w-3 text-red-500" />
      )}
      {(position.health.protectionStatus === "BREAKEVEN_LOCKED" ||
        position.health.protectionStatus === "PARTIALLY_PROTECTED") && (
        <ShieldCheck className="h-3 w-3 text-green-500" />
      )}

      {/* Secondary: floating R */}
      <span className="ms-auto font-mono">
        {position.rComputable && position.floatingR !== null ? (
          <span
            className={cn(
              "font-medium",
              position.floatingR >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            )}
          >
            {position.floatingR >= 0 ? "+" : ""}
            {position.floatingR}R
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </div>
  );
}

function ClosedTradeRow({ trade }: { trade: ClosedTradeV2 }) {
  return (
    <div className="flex items-center gap-2 rounded bg-muted/50 px-2 py-1.5 text-xs">
      <DirectionBadge direction={trade.direction as "LONG" | "SHORT"} />
      <span className="font-mono font-medium">{trade.instrument}</span>
      <StatusBadge status={trade.status} />
      {trade.r !== null ? (
        <span
          className={cn(
            "ms-auto font-mono font-medium",
            trade.r >= 0
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          )}
        >
          {trade.r >= 0 ? "+" : ""}
          {trade.r}R
        </span>
      ) : (
        <span className="ms-auto text-muted-foreground">—</span>
      )}
    </div>
  );
}

function HealthBadge({
  health,
  t,
}: {
  health: OverallHealth;
  t: (key: string) => string;
}) {
  const colors = HEALTH_COLORS[health];
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[10px] font-medium",
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {t(`digest.health.${health.toLowerCase()}`)}
    </span>
  );
}

function HealthChip({
  count,
  label,
  health,
}: {
  count: number;
  label: string;
  health: OverallHealth;
}) {
  if (count === 0) return null;
  const colors = HEALTH_COLORS[health];
  return (
    <span
      className={cn(
        "rounded border px-2 py-0.5 text-[10px]",
        colors.bg,
        colors.text,
        colors.border
      )}
    >
      {count} {label}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <p className={cn("text-lg font-bold", color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ─── Helpers ───

const HEALTH_SEVERITY_ORDER: OverallHealth[] = [
  "BROKEN_PLAN",
  "AT_RISK",
  "LOW_CONFIDENCE",
  "NEEDS_REVIEW",
  "HEALTHY",
];

function getWorstOpenHealth(positions: OpenPositionV2[]): OverallHealth | null {
  if (positions.length === 0) return null;
  let worst = HEALTH_SEVERITY_ORDER.length - 1;
  for (const pos of positions) {
    const idx = HEALTH_SEVERITY_ORDER.indexOf(pos.health.overall as OverallHealth);
    if (idx !== -1 && idx < worst) worst = idx;
  }
  return HEALTH_SEVERITY_ORDER[worst];
}
