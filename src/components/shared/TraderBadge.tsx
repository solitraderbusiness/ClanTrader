"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";

interface RankBadgeInfo {
  name: string;
  key: string;
  iconUrl?: string | null;
}

interface TraderBadgeProps {
  role?: string;
  size?: "sm" | "default";
  rankBadge?: RankBadgeInfo | null;
}

export function TraderBadge({ role, size = "sm", rankBadge }: TraderBadgeProps) {
  const { t } = useTranslation();
  const showRole = role === "TRADER" || role === "ADMIN" || role === "SPECTATOR";

  if (!showRole && !rankBadge) return null;

  return (
    <TooltipProvider>
      <span className="inline-flex items-center gap-1">
        {/* Rank badge */}
        {rankBadge && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-300 ${
                  size === "sm" ? "px-1 py-0 text-[10px]" : "px-1.5 py-0.5 text-xs"
                }`}
              >
                {rankBadge.iconUrl ? (
                  <img
                    src={rankBadge.iconUrl}
                    alt={rankBadge.name}
                    className={size === "sm" ? "h-3 w-3" : "h-4 w-4"}
                  />
                ) : (
                  rankBadge.name
                )}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t("profile.rank")}: {rankBadge.name}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Role badge */}
        {showRole && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant={
                  role === "ADMIN"
                    ? "destructive"
                    : role === "SPECTATOR"
                      ? "secondary"
                      : "default"
                }
                className={`${size === "sm" ? "px-1 py-0 text-[10px]" : ""} ${
                  role === "SPECTATOR" ? "opacity-70" : ""
                }`}
              >
                {role === "ADMIN" ? "A" : role === "SPECTATOR" ? "V" : "T"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {role === "ADMIN"
                  ? t("profile.admin")
                  : role === "SPECTATOR"
                    ? t("profile.viewer")
                    : t("profile.verifiedTrader")}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </span>
    </TooltipProvider>
  );
}
