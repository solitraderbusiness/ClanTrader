"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, TrendingDown, TrendingUp, Shield, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { EmptyState } from "@/components/shared/EmptyState";
import type { StatementPageData } from "@/types/trader-statement";

interface TraderStatementViewProps {
  userId: string;
  clanId: string;
}

function StatCard({
  label,
  value,
  subValue,
  positive,
  neutral,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  positive?: boolean;
  neutral?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-bold tabular-nums",
          neutral
            ? ""
            : positive === true
              ? "text-emerald-500"
              : positive === false
                ? "text-red-500"
                : ""
        )}
      >
        {value}
      </p>
      {subValue && (
        <p className="text-[10px] text-muted-foreground">{subValue}</p>
      )}
    </div>
  );
}

export function TraderStatementView({ userId, clanId }: TraderStatementViewProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<StatementPageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/users/${userId}/trader-statement?clanId=${clanId}`
      );
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [userId, clanId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon={Shield}
        title={t("statement.noData")}
        description={t("statement.noDataDesc")}
      />
    );
  }

  const { closedPerformance: cp, liveOpenRisk: lr, effectiveRank: er } = data;
  const hasClosedTrades = cp.signalCount > 0;

  return (
    <div className="space-y-4">
      {/* Block A: Official Closed Performance */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {t("statement.closedPerformance")}
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {t("statement.closedPerformanceDesc")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!hasClosedTrades ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("statement.noData")}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              <StatCard
                label={t("statement.tradeCount")}
                value={cp.signalCount}
                neutral
              />
              <StatCard
                label={t("statement.winRate")}
                value={`${Math.round(cp.winRate * 100)}%`}
                positive={cp.winRate >= 0.5}
              />
              <StatCard
                label={t("statement.avgR")}
                value={`${cp.avgRMultiple > 0 ? "+" : ""}${cp.avgRMultiple.toFixed(2)}R`}
                positive={cp.avgRMultiple > 0}
              />
              <StatCard
                label={t("statement.totalR")}
                value={`${cp.totalRMultiple > 0 ? "+" : ""}${cp.totalRMultiple.toFixed(2)}R`}
                positive={cp.totalRMultiple > 0}
              />
              <StatCard
                label={t("statement.profitFactor")}
                value={
                  cp.profitFactor === Infinity
                    ? "∞"
                    : cp.profitFactor.toFixed(2)
                }
                positive={cp.profitFactor > 1}
              />
              <StatCard
                label={t("statement.bestR")}
                value={`+${cp.bestRMultiple.toFixed(2)}R`}
                positive
              />
              <StatCard
                label={t("statement.worstR")}
                value={`${cp.worstRMultiple.toFixed(2)}R`}
                positive={cp.worstRMultiple >= 0}
              />
              <StatCard
                label={`W / L / BE`}
                value={`${cp.wins} / ${cp.losses} / ${cp.breakEven}`}
                neutral
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block B: Live Open Risk */}
      <Card className={cn(lr.staleWarning && "border-yellow-500/50")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {t("statement.liveOpenRisk")}
              {lr.staleWarning && (
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
              )}
            </CardTitle>
            {lr.openOfficialCount > 0 && (
              <Badge
                variant={lr.liveFloatingR < 0 ? "destructive" : "secondary"}
                className="text-[10px]"
              >
                {lr.openOfficialCount} {t("statement.openTrades").toLowerCase()}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {lr.openOfficialCount === 0 ? (
            <p className="text-sm text-muted-foreground py-2 text-center">
              {t("statement.noData")}
            </p>
          ) : (
            <>
              {lr.staleWarning && (
                <div className="mb-3 rounded-md bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
                  {t("statement.staleWarning")}
                </div>
              )}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                <StatCard
                  label={t("statement.floatingR")}
                  value={`${lr.liveFloatingR > 0 ? "+" : ""}${lr.liveFloatingR.toFixed(2)}R`}
                  positive={lr.liveFloatingR > 0}
                />
                <StatCard
                  label={t("statement.floatingPnl")}
                  value={`$${lr.liveFloatingPnl.toFixed(2)}`}
                  positive={lr.liveFloatingPnl > 0}
                />
                <StatCard
                  label={t("statement.performanceDrawdown")}
                  value={`${lr.currentNavDrawdownPct.toFixed(1)}%`}
                  positive={lr.currentNavDrawdownPct < 5}
                />
                <StatCard
                  label={t("statement.maxPerformanceDrawdown")}
                  value={`${lr.maxNavDrawdownPct.toFixed(1)}%`}
                  positive={lr.maxNavDrawdownPct < 10}
                />
                {lr.biggestOpenLoserR < 0 && (
                  <StatCard
                    label={t("statement.biggestLoser")}
                    value={`${lr.biggestOpenLoserR.toFixed(2)}R`}
                    positive={false}
                  />
                )}
                {lr.unprotectedCount > 0 && (
                  <StatCard
                    label={t("statement.unprotected")}
                    value={lr.unprotectedCount}
                    positive={false}
                  />
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Block C: Effective Rank View */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {t("statement.effectiveRank")}
            </CardTitle>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {t("statement.effectiveRankDesc")}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {/* Closed R */}
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {t("statement.closedR")}
                </span>
              </div>
              <p
                className={cn(
                  "text-xl font-bold tabular-nums",
                  er.closedOfficialR > 0
                    ? "text-emerald-500"
                    : er.closedOfficialR < 0
                      ? "text-red-500"
                      : ""
                )}
              >
                {er.closedOfficialR > 0 ? "+" : ""}
                {er.closedOfficialR.toFixed(2)}R
              </p>
            </div>

            {/* Penalty */}
            {er.openRiskPenalty < 0 && (
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1">
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs text-muted-foreground">
                    {t("statement.openPenalty")}
                  </span>
                </div>
                <p className="text-xl font-bold tabular-nums text-red-500">
                  {er.openRiskPenalty.toFixed(2)}R
                </p>
              </div>
            )}

            {/* Effective R */}
            <div className="flex-1 text-center">
              <div className="flex items-center justify-center gap-1">
                {er.openRiskPenalty < 0 ? (
                  <ShieldAlert className="h-3.5 w-3.5 text-yellow-500" />
                ) : (
                  <Shield className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span className="text-xs font-medium">
                  {t("statement.effectiveR")}
                </span>
              </div>
              <p
                className={cn(
                  "text-xl font-bold tabular-nums",
                  er.effectiveRankR > 0
                    ? "text-emerald-500"
                    : er.effectiveRankR < 0
                      ? "text-red-500"
                      : ""
                )}
              >
                {er.effectiveRankR > 0 ? "+" : ""}
                {er.effectiveRankR.toFixed(2)}R
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
