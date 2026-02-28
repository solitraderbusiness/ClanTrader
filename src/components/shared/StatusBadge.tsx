"use client";

import { Badge } from "@/components/ui/badge";
import {
  Clock,
  TrendingUp,
  Target,
  ShieldX,
  Equal,
  XCircle,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const statusConfig: Record<
  string,
  { labelKey: string; className: string; icon: LucideIcon }
> = {
  PENDING: {
    labelKey: "trade.pending",
    className:
      "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    icon: Clock,
  },
  OPEN: {
    labelKey: "trade.open",
    className:
      "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: TrendingUp,
  },
  TP_HIT: {
    labelKey: "trade.tpHit",
    className:
      "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400",
    icon: Target,
  },
  SL_HIT: {
    labelKey: "trade.slHit",
    className: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
    icon: ShieldX,
  },
  BE: {
    labelKey: "trade.breakEven",
    className:
      "border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    icon: Equal,
  },
  CLOSED: {
    labelKey: "trade.closed",
    className:
      "border-gray-500 bg-gray-500/10 text-gray-600 dark:text-gray-400",
    icon: XCircle,
  },
  UNVERIFIED: {
    labelKey: "trade.unverified",
    className:
      "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400",
    icon: AlertTriangle,
  },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useTranslation();
  const config = statusConfig[status];
  if (!config) {
    return (
      <Badge
        variant="outline"
        className="border-gray-500 bg-gray-500/10 text-gray-600"
      >
        {status}
      </Badge>
    );
  }

  const Icon = config.icon;

  return (
    <Badge variant="outline" className={config.className}>
      <Icon className="me-1 h-3 w-3" />
      {t(config.labelKey)}
    </Badge>
  );
}
