"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TraderBadgeProps {
  role?: string;
  size?: "sm" | "default";
}

export function TraderBadge({ role, size = "sm" }: TraderBadgeProps) {
  if (role !== "TRADER" && role !== "ADMIN") return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={role === "ADMIN" ? "destructive" : "default"}
            className={size === "sm" ? "px-1 py-0 text-[10px]" : ""}
          >
            {role === "ADMIN" ? "A" : "T"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{role === "ADMIN" ? "Admin" : "Verified Trader"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
