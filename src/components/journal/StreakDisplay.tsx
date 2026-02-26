"use client";

import { useTranslation } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { StreakInfo } from "@/types/journal";
import { cn } from "@/lib/utils";
import { Flame, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  data: StreakInfo;
}

export function StreakDisplay({ data }: Props) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {/* Current streak */}
      <Card>
        <CardContent className="flex flex-col items-center px-4 py-4 text-center">
          <Flame
            className={cn(
              "h-8 w-8 mb-2",
              data.currentStreakType === "win"
                ? "text-green-500"
                : data.currentStreakType === "loss"
                  ? "text-red-500"
                  : "text-muted-foreground"
            )}
          />
          <p className="text-2xl font-bold tabular-nums">
            {data.currentStreak}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.currentStreakType === "win"
              ? t("journal.currentWinStreak")
              : data.currentStreakType === "loss"
                ? t("journal.currentLossStreak")
                : t("journal.noStreak")}
          </p>
        </CardContent>
      </Card>

      {/* Max win streak */}
      <Card>
        <CardContent className="flex flex-col items-center px-4 py-4 text-center">
          <TrendingUp className="h-8 w-8 mb-2 text-green-500" />
          <p className="text-2xl font-bold tabular-nums text-green-500">
            {data.maxWinStreak}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("journal.maxWinStreak")}
          </p>
        </CardContent>
      </Card>

      {/* Max loss streak */}
      <Card>
        <CardContent className="flex flex-col items-center px-4 py-4 text-center">
          <TrendingDown className="h-8 w-8 mb-2 text-red-500" />
          <p className="text-2xl font-bold tabular-nums text-red-500">
            {data.maxLossStreak}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("journal.maxLossStreak")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
