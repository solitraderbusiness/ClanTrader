"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";

interface DirectionBadgeProps {
  direction: "LONG" | "SHORT";
}

export function DirectionBadge({ direction }: DirectionBadgeProps) {
  const { t } = useTranslation();
  return (
    <Badge
      variant="outline"
      className={
        direction === "LONG"
          ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
          : "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
      }
    >
      {direction === "LONG" ? t("trade.long") : t("trade.short")}
    </Badge>
  );
}
