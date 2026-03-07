"use client";

import dynamic from "next/dynamic";
import type { SparklinePoint } from "@/types/explore";

interface Props {
  data: SparklinePoint[];
  totalR: number;
}

const SparklineInner = dynamic(() => import("./SparklineInner"), {
  ssr: false,
  loading: () => <div className="h-8 w-20" />,
});

export function SparklineChart({ data, totalR }: Props) {
  if (data.length < 2) return null;
  return <SparklineInner data={data} totalR={totalR} />;
}
