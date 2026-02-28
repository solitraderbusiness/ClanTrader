"use client";

import { Shield, Equal, ShieldCheck, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";

interface RiskStatusBadgeProps {
  status: string;
}

const configMap: Record<string, { labelKey: string; icon: typeof Shield; className: string }> = {
  PROTECTED: {
    labelKey: "trade.protected",
    icon: Shield,
    className: "border-blue-500/50 text-blue-600 dark:text-blue-400",
  },
  BREAKEVEN: {
    labelKey: "trade.breakeven",
    icon: Equal,
    className: "border-yellow-500/50 text-yellow-600 dark:text-yellow-400",
  },
  LOCKED_PROFIT: {
    labelKey: "trade.lockedProfit",
    icon: ShieldCheck,
    className: "border-green-500/50 text-green-600 dark:text-green-400",
  },
  UNPROTECTED: {
    labelKey: "trade.unprotected",
    icon: AlertTriangle,
    className: "animate-pulse border-red-500/50 text-red-600 dark:text-red-400",
  },
};

export function RiskStatusBadge({ status }: RiskStatusBadgeProps) {
  const { t } = useTranslation();
  const c = configMap[status];
  if (!c) return null;

  const Icon = c.icon;
  return (
    <Badge variant="outline" className={`text-[10px] ${c.className}`}>
      <Icon className="me-0.5 h-2.5 w-2.5" />
      {t(c.labelKey)}
    </Badge>
  );
}
