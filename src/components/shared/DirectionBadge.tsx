"use client";

import { Badge } from "@/components/ui/badge";

interface DirectionBadgeProps {
  direction: "LONG" | "SHORT";
}

export function DirectionBadge({ direction }: DirectionBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={
        direction === "LONG"
          ? "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400"
          : "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
      }
    >
      {direction}
    </Badge>
  );
}
