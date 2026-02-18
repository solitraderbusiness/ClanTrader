"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Label } from "@/components/ui/label";

const TRADING_STYLES = [
  "Scalping",
  "Day Trading",
  "Swing",
  "Position",
  "Algorithmic",
];

const SESSIONS = ["Asian", "London", "New York", "All Sessions"];

const SORT_OPTIONS_AGENTS = [
  { value: "winRate", label: "Win Rate" },
  { value: "profitFactor", label: "Profit Factor" },
  { value: "totalTrades", label: "Total Trades" },
];

const SORT_OPTIONS_CLANS = [
  { value: "memberCount", label: "Members" },
  { value: "followerCount", label: "Followers" },
  { value: "createdAt", label: "Newest" },
];

const TRADING_FOCUSES = ["Forex", "Crypto", "Gold & Metals", "Indices", "Mixed"];

interface FilterBarProps {
  mode: "agents" | "clans";
}

export function FilterBar({ mode }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // Reset to page 1
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (mode === "agents") {
    return (
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Style</Label>
          <select
            className={selectClass}
            value={searchParams.get("tradingStyle") || ""}
            onChange={(e) => updateParam("tradingStyle", e.target.value)}
          >
            <option value="">All styles</option>
            {TRADING_STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Session</Label>
          <select
            className={selectClass}
            value={searchParams.get("sessionPreference") || ""}
            onChange={(e) => updateParam("sessionPreference", e.target.value)}
          >
            <option value="">All sessions</option>
            {SESSIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Sort by</Label>
          <select
            className={selectClass}
            value={searchParams.get("sort") || "winRate"}
            onChange={(e) => updateParam("sort", e.target.value)}
          >
            {SORT_OPTIONS_AGENTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label className="text-xs">Focus</Label>
        <select
          className={selectClass}
          value={searchParams.get("tradingFocus") || ""}
          onChange={(e) => updateParam("tradingFocus", e.target.value)}
        >
          <option value="">All focuses</option>
          {TRADING_FOCUSES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Sort by</Label>
        <select
          className={selectClass}
          value={searchParams.get("sort") || "createdAt"}
          onChange={(e) => updateParam("sort", e.target.value)}
        >
          {SORT_OPTIONS_CLANS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
