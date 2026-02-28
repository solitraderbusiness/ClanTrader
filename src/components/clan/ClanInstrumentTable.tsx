"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { InstrumentStats } from "@/types/journal";

interface Props {
  data: InstrumentStats[];
}

export function ClanInstrumentTable({ data }: Props) {
  const { t } = useTranslation();

  if (data.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("clanPerf.instruments")}</h3>
      <Card>
        <CardContent className="px-0 py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-2.5 text-start font-medium">
                    {t("journal.instrument")}
                  </th>
                  <th className="px-3 py-2.5 text-end font-medium">
                    {t("journal.tradesCount")}
                  </th>
                  <th className="px-3 py-2.5 text-end font-medium">
                    {t("clanPerf.winRate")}
                  </th>
                  <th className="px-3 py-2.5 text-end font-medium">
                    {t("clanPerf.avgR")}
                  </th>
                  <th className="px-4 py-2.5 text-end font-medium">
                    {t("clanPerf.totalR")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.instrument} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{row.instrument}</td>
                    <td className="px-3 py-2.5 text-end tabular-nums">
                      {row.trades}
                      <span className="text-muted-foreground text-xs ms-1">
                        ({row.wins}W/{row.losses}L)
                      </span>
                    </td>
                    <td className={cn(
                      "px-3 py-2.5 text-end tabular-nums",
                      row.winRate >= 50 ? "text-green-500" : "text-red-500"
                    )}>
                      {row.winRate}%
                    </td>
                    <td className={cn(
                      "px-3 py-2.5 text-end tabular-nums",
                      row.avgR >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {row.avgR >= 0 ? "+" : ""}{row.avgR}
                    </td>
                    <td className={cn(
                      "px-4 py-2.5 text-end tabular-nums font-medium",
                      row.totalR >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                      {row.totalR >= 0 ? "+" : ""}{row.totalR}R
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
