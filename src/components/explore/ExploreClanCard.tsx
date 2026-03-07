"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getInitials } from "@/lib/utils";
import { SparklineChart } from "./SparklineChart";
import type { ExploreClanItem } from "@/types/explore";

interface Props {
  clan: ExploreClanItem;
}

export function ExploreClanCard({ clan }: Props) {
  const { t } = useTranslation();
  const { perf } = clan;
  const hasTrades = perf.totalSignals > 0;

  return (
    <Link href={`/clans/${clan.id}`}>
      <Card className="glass-card transition-all hover:shadow-lg hover:border-primary/20">
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-12 w-12 shrink-0 ring-2 ring-primary/10">
            <AvatarImage src={clan.avatar || undefined} alt={clan.name} />
            <AvatarFallback>
              {getInitials(clan.name)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            {/* Row 1: Name + badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="min-w-0 truncate font-semibold">{clan.name}</h3>
              {clan.tradingFocus && (
                <Badge variant="secondary" className="shrink-0">
                  {clan.tradingFocus}
                </Badge>
              )}
              <Badge
                variant="outline"
                className={`shrink-0 ${clan.tier === "PRO" ? "bg-gradient-to-r from-amber-500/20 to-amber-600/20" : ""}`}
              >
                {clan.tier}
              </Badge>
            </div>

            {/* Row 2: Followers */}
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <Heart className="h-3 w-3" />
              {clan.followerCount} {t("clan.followers")}
            </div>

            {/* Row 3: Stats */}
            {hasTrades ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span>
                  <span className="text-muted-foreground">
                    {t("explore.winRate")}:{" "}
                  </span>
                  <span
                    className={
                      perf.winRate >= 50 ? "text-green-500" : "text-red-500"
                    }
                  >
                    {perf.winRate}%
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">
                    {t("explore.totalR")}:{" "}
                  </span>
                  <span
                    className={
                      perf.totalR > 0
                        ? "text-green-500"
                        : perf.totalR < 0
                          ? "text-red-500"
                          : ""
                    }
                  >
                    {perf.totalR > 0 ? "+" : ""}
                    {perf.totalR}R
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">
                    {t("explore.avgPerWeek")}:{" "}
                  </span>
                  {perf.avgTradesPerWeek}
                </span>
                <SparklineChart
                  data={perf.sparkline}
                  totalR={perf.totalR}
                />
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground/60">
                {t("explore.noTradingHistory")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
