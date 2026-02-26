"use client";

import { useTranslation } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import type { EquityCurvePoint } from "@/types/journal";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

interface Props {
  data: EquityCurvePoint[];
}

export function EquityCurve({ data }: Props) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="px-4 py-4">
        <h3 className="mb-3 text-sm font-semibold">
          {t("journal.equityCurve")}
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: string) =>
                  v.length > 10 ? v.slice(5, 10) : v
                }
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${v}R`}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value: number | undefined) => [`${value ?? 0}R`, t("journal.cumulativeR")]}
                labelFormatter={(label) => {
                  const s = String(label);
                  return s.length > 10 ? s.slice(0, 10) : s;
                }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--popover)",
                  color: "var(--popover-foreground)",
                }}
              />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="cumulativeR"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
