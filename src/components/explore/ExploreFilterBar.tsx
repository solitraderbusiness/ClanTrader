"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const TRADING_FOCUSES = ["Forex", "Crypto", "Gold & Metals", "Indices", "Mixed"];
const MIN_WIN_RATES = [40, 50, 60, 70];

export function ExploreFilterBar() {
  const { t } = useTranslation();
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
      params.delete("page");
      router.push(`?${params.toString()}`);
    },
    [router, searchParams, t]
  );

  const selectClass =
    "h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-wrap items-end gap-4">
      {/* Sort */}
      <div className="space-y-1">
        <Label className="text-xs">{t("explore.sortBy")}</Label>
        <select
          className={selectClass}
          value={searchParams.get("sort") || "totalR"}
          onChange={(e) => updateParam("sort", e.target.value)}
        >
          <option value="totalR">{t("explore.sortTotalR")}</option>
          <option value="winRate">{t("explore.sortWinRate")}</option>
          <option value="avgTradesPerWeek">{t("explore.sortAvgTrades")}</option>
          <option value="followers">{t("explore.sortFollowers")}</option>
        </select>
      </div>

      {/* Trading Focus */}
      <div className="space-y-1">
        <Label className="text-xs">{t("explore.tradingFocus")}</Label>
        <select
          className={selectClass}
          value={searchParams.get("tradingFocus") || ""}
          onChange={(e) => updateParam("tradingFocus", e.target.value)}
        >
          <option value="">{t("explore.allFocuses")}</option>
          {TRADING_FOCUSES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Min Win Rate */}
      <div className="space-y-1">
        <Label className="text-xs">{t("explore.minWinRate")}</Label>
        <select
          className={selectClass}
          value={searchParams.get("minWinRate") || ""}
          onChange={(e) => updateParam("minWinRate", e.target.value)}
        >
          <option value="">{t("explore.any")}</option>
          {MIN_WIN_RATES.map((r) => (
            <option key={r} value={r}>
              {r}%+
            </option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="space-y-1">
        <Label className="text-xs">{t("common.search")}</Label>
        <div className="relative">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            className={`${selectClass} ps-8`}
            placeholder={t("explore.searchPlaceholder")}
            value={searchParams.get("q") || ""}
            onChange={(e) => updateParam("q", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
