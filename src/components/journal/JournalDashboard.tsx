"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { BookOpen } from "lucide-react";
import type { JournalData } from "@/types/journal";
import { PeriodSelector } from "./PeriodSelector";
import { SummaryCards } from "./SummaryCards";
import { EquityCurve } from "./EquityCurve";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { InstrumentTable } from "./InstrumentTable";
import { DirectionComparison } from "./DirectionComparison";
import { TagAnalysis } from "./TagAnalysis";
import { TimeAnalysis } from "./TimeAnalysis";
import { StreakDisplay } from "./StreakDisplay";
import { PeriodComparison } from "./PeriodComparison";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  clans: { id: string; name: string }[];
}

export function JournalDashboard({ clans }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<JournalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clanId, setClanId] = useState<string>("");
  const [trackedOnly, setTrackedOnly] = useState(true);
  const [period, setPeriod] = useState<string>("all");
  const [journalTab, setJournalTab] = useState<"signals" | "analysis">("signals");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (clanId) params.set("clanId", clanId);

      if (journalTab === "analysis") {
        params.set("cardType", "ANALYSIS");
        params.set("tracked", "false");
      } else {
        if (!trackedOnly) params.set("tracked", "false");
      }

      if (period !== "all") {
        const now = new Date();
        let from: Date;
        if (period === "month") {
          from = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (period === "3months") {
          from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        } else if (period === "6months") {
          from = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        } else {
          from = new Date(now.getFullYear(), 0, 1);
        }
        params.set("from", from.toISOString());
        params.set("to", now.toISOString());
      }

      const res = await fetch(`/api/me/journal?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [clanId, trackedOnly, period, journalTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isEmpty = !data || data.summary.totalTrades === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold">{t("journal.title")}</h1>
        <PeriodSelector
          clans={clans}
          clanId={clanId}
          onClanChange={setClanId}
          trackedOnly={trackedOnly}
          onTrackedChange={setTrackedOnly}
          period={period}
          onPeriodChange={setPeriod}
        />
      </div>

      {/* Signals / Analysis top-level toggle */}
      <Tabs value={journalTab} onValueChange={(v) => setJournalTab(v as "signals" | "analysis")}>
        <TabsList>
          <TabsTrigger value="signals">{t("journal.signals")}</TabsTrigger>
          <TabsTrigger value="analysis" className="data-[state=active]:text-blue-600">{t("journal.analysis")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {journalTab === "analysis" && (
        <p className="text-xs text-muted-foreground">{t("journal.analysisDisclaimer")}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {t("journal.empty")}
          </p>
        </div>
      ) : (
      <>
      {/* Summary */}
      <SummaryCards summary={data.summary} />

      {/* Equity Curve */}
      {data.equityCurve.length > 1 && (
        <EquityCurve data={data.equityCurve} />
      )}

      {/* Period Comparison */}
      {data.periodComparison && (
        <PeriodComparison data={data.periodComparison} />
      )}

      {/* Calendar */}
      {data.calendarData.length > 0 && (
        <CalendarHeatmap data={data.calendarData} />
      )}

      {/* Analysis Tabs */}
      <Tabs defaultValue="instruments">
        <TabsList variant="line" className="w-full">
          <TabsTrigger value="instruments">
            {t("journal.instruments")}
          </TabsTrigger>
          <TabsTrigger value="direction">
            {t("journal.direction")}
          </TabsTrigger>
          <TabsTrigger value="tags">{t("journal.tags")}</TabsTrigger>
          <TabsTrigger value="time">{t("journal.time")}</TabsTrigger>
          <TabsTrigger value="streaks">{t("journal.streaks")}</TabsTrigger>
        </TabsList>

        <TabsContent value="instruments" className="mt-4">
          <InstrumentTable data={data.instrumentBreakdown} />
        </TabsContent>
        <TabsContent value="direction" className="mt-4">
          <DirectionComparison data={data.directionBreakdown} />
        </TabsContent>
        <TabsContent value="tags" className="mt-4">
          <TagAnalysis data={data.tagBreakdown} />
        </TabsContent>
        <TabsContent value="time" className="mt-4">
          <TimeAnalysis
            dayOfWeek={data.dayOfWeekAnalysis}
            monthly={data.monthAnalysis}
          />
        </TabsContent>
        <TabsContent value="streaks" className="mt-4">
          <StreakDisplay data={data.streaks} />
        </TabsContent>
      </Tabs>
      </>
      )}
    </div>
  );
}
