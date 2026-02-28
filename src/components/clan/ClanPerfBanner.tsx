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
      className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 transition-colors hover:bg-accent"
    >
      <div className="flex flex-1 items-center gap-4 overflow-x-auto text-sm tabular-nums">
        <Stat label={t("clanPerf.totalSignals")} value={String(summary.totalSignals)} />
        <Separator />
        <Stat
          label={t("clanPerf.winRate")}
          value={`${summary.winRate}%`}
          color={summary.winRate >= 50 ? "text-green-500" : "text-red-500"}
        />
        <Separator />
        <Stat
          label={t("clanPerf.totalR")}
          value={`${summary.totalR >= 0 ? "+" : ""}${summary.totalR}R`}
          color={summary.totalR >= 0 ? "text-green-500" : "text-red-500"}
        />
        <Separator />
        <Stat
          label="PF"
          value={pf}
          color={summary.profitFactor >= 1 ? "text-green-500" : "text-red-500"}
        />
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold", color)}>{value}</span>
    </div>
  );
}

function Separator() {
  return <div className="h-4 w-px shrink-0 bg-border" />;
}
