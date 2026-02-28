"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { RecentSignal } from "@/types/clan-performance";

interface Props {
  signals: RecentSignal[];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA");
}

export function RecentSignalsList({ signals }: Props) {
  const { t } = useTranslation();

  if (signals.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("clanPerf.recentSignals")}</h3>
      <div className="space-y-2">
        {signals.map((s) => (
          <Card key={s.tradeId}>
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={s.providerAvatar || undefined} alt={s.providerName} />
                <AvatarFallback className="text-[10px]">
                  {s.providerName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{s.instrument}</span>
                  <DirectionBadge direction={s.direction as "LONG" | "SHORT"} />
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {s.providerName} · {formatDate(s.closedAt)}
                </p>
              </div>
              <div className="shrink-0">
                {s.r !== null ? (
                  <span className={cn(
                    "text-sm font-bold tabular-nums",
                    s.r > 0 ? "text-green-500" : s.r < 0 ? "text-red-500" : "text-muted-foreground"
                  )}>
                    {s.r > 0 ? "+" : ""}{s.r}R
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
