"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ClanPerfSummary } from "@/types/clan-performance";

interface Props {
  clanId: string;
}

export function ClanPerfBanner({ clanId }: Props) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<ClanPerfSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/clans/${clanId}/performance?period=all`);
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [clanId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
    );
  }

  if (!summary || summary.totalSignals === 0) return null;

  const pf = summary.profitFactor >= 9999 ? "∞" : String(summary.profitFactor);

  return (
    <Link
      href={`/clans/${clanId}/performance`}
      className="group inline-flex flex-wrap items-center gap-1.5 tabular-nums"
    >
      <Stat label={t("clanPerf.totalSignals")} value={String(summary.totalSignals)} />
      <Stat
        label={t("clanPerf.winRate")}
        value={`${summary.winRate}%`}
        color={summary.winRate >= 50 ? "text-green-500" : "text-red-500"}
      />
      <Stat
        label={t("clanPerf.totalR")}
        value={`${summary.totalR >= 0 ? "+" : ""}${summary.totalR}R`}
        color={summary.totalR >= 0 ? "text-green-500" : "text-red-500"}
      />
      <span className="inline-flex items-center gap-0.5">
        <Stat
          label="PF"
          value={pf}
          color={summary.profitFactor >= 1 ? "text-green-500" : "text-red-500"}
        />
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/50 px-2 py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", color)}>{value}</span>
    </span>
  );
}
