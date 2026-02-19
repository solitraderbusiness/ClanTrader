"use client";

import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  OPEN: {
    label: "Open",
    className: "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  TP1_HIT: {
    label: "TP1",
    className: "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400",
  },
  TP2_HIT: {
    label: "TP2",
    className: "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  SL_HIT: {
    label: "SL Hit",
    className: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
  },
  BE: {
    label: "Break Even",
    className: "border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  CLOSED: {
    label: "Closed",
    className: "border-gray-500 bg-gray-500/10 text-gray-600 dark:text-gray-400",
  },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: "border-gray-500 bg-gray-500/10 text-gray-600",
  };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
