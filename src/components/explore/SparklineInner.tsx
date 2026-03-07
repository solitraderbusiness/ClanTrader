"use client";

import { LineChart, Line } from "recharts";
import type { SparklinePoint } from "@/types/explore";

interface Props {
  data: SparklinePoint[];
  totalR: number;
}

export default function SparklineInner({ data, totalR }: Props) {
  const color = totalR >= 0 ? "#22c55e" : "#ef4444";

  return (
    <LineChart width={80} height={32} data={data}>
      <Line
        type="monotone"
        dataKey="cumR"
        stroke={color}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
