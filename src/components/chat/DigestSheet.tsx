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
import { ClipboardList, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ClanDigestData, DigestPeriod } from "@/types/clan-digest";

interface DigestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clanId: string;
}

const PERIODS: { value: DigestPeriod; labelKey: string }[] = [
  { value: "today", labelKey: "digest.today" },
  { value: "week", labelKey: "digest.thisWeek" },
  { value: "month", labelKey: "digest.thisMonth" },
];

export function DigestSheet({ open, onOpenChange, clanId }: DigestSheetProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<DigestPeriod>("today");
  const [data, setData] = useState<ClanDigestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  const fetchDigest = useCallback(
    async (p: DigestPeriod) => {
      setLoading(true);
      setData(null);
      try {
        const res = await fetch(`/api/clans/${clanId}/digest?period=${p}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
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

          {!loading && (!data || data.summary.totalCards === 0) && (
            <EmptyState
              icon={ClipboardList}
              title={t("digest.empty")}
              description={t("digest.emptyDesc")}
            />
          )}

          {!loading && data && data.summary.totalCards > 0 && (
            <div className="space-y-4">
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
                    return (
                      <div key={member.userId} className="rounded-lg border">
                        {/* Collapsed row */}
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

                        {/* Expanded details */}
                        {expanded && (
                          <div className="border-t px-3 pb-3 pt-2">
                            {/* Status badges */}
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

                            {/* Trade list */}
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
          )}
        </div>
      </SheetContent>
    </Sheet>
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
