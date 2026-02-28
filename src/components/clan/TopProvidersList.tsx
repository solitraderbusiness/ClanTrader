"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ProviderStats } from "@/types/clan-performance";

interface Props {
  providers: ProviderStats[];
}

export function TopProvidersList({ providers }: Props) {
  const { t } = useTranslation();

  if (providers.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("clanPerf.topProviders")}</h3>
      <div className="space-y-2">
        {providers.map((p, idx) => (
          <Card key={p.userId}>
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <span className="text-sm font-bold text-muted-foreground tabular-nums w-5 shrink-0">
                {idx + 1}
              </span>
              <Link href={`/profile/${p.userId}`} className="shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={p.avatar || undefined} alt={p.name} />
                  <AvatarFallback>
                    {p.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/profile/${p.userId}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {p.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.signals} {t("clanPerf.signals")} · {p.winRate}% WR
                </p>
              </div>
              <div className="text-end shrink-0">
                <p className={cn(
                  "text-sm font-bold tabular-nums",
                  p.totalR >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {p.totalR >= 0 ? "+" : ""}{p.totalR}R
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  avg {p.avgR >= 0 ? "+" : ""}{p.avgR}R
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
