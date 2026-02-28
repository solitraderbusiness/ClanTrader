"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ClanPerfSummaryCards } from "./ClanPerfSummaryCards";
import { TopProvidersList } from "./TopProvidersList";
import { RecentSignalsList } from "./RecentSignalsList";
import { ClanInstrumentTable } from "./ClanInstrumentTable";
import type { ClanPerformanceData } from "@/types/clan-performance";

interface Props {
  clanId: string;
}

type Period = "all" | "month" | "30d";

const PERIODS: { value: Period; labelKey: string }[] = [
  { value: "all", labelKey: "clanPerf.allTime" },
  { value: "month", labelKey: "clanPerf.thisMonth" },
  { value: "30d", labelKey: "clanPerf.last30Days" },
];

export function ClanPerformanceTab({ clanId }: Props) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("all");
  const [data, setData] = useState<ClanPerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/performance?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [clanId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-1 rounded-lg border p-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              period === p.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !data || data.summary.totalSignals === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t("clanPerf.noSignals")}
        </div>
      ) : (
        <>
          <ClanPerfSummaryCards summary={data.summary} />
          <TopProvidersList providers={data.topProviders} />
          <RecentSignalsList signals={data.recentSignals} />
          <ClanInstrumentTable data={data.instrumentBreakdown} />
        </>
      )}
    </div>
  );
}
