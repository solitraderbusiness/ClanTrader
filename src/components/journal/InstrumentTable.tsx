"use client";

import { useTranslation } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { InstrumentStats } from "@/types/journal";
import { cn } from "@/lib/utils";

interface Props {
  data: InstrumentStats[];
}

export function InstrumentTable({ data }: Props) {
  const { t } = useTranslation();

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("common.noResults")}
      </p>
    );
  }

  return (
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
                  {t("journal.winRate")}
                </th>
                <th className="px-3 py-2.5 text-end font-medium">
                  {t("journal.avgR")}
                </th>
                <th className="px-4 py-2.5 text-end font-medium">
                  {t("journal.totalR")}
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
                  <td className="px-3 py-2.5 text-end tabular-nums">
                    {(row.winRate * 100).toFixed(0)}%
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-end tabular-nums",
                      row.avgR >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {row.avgR > 0 ? "+" : ""}
                    {row.avgR.toFixed(2)}R
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-end tabular-nums font-medium",
                      row.totalR >= 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {row.totalR > 0 ? "+" : ""}
                    {row.totalR.toFixed(2)}R
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
