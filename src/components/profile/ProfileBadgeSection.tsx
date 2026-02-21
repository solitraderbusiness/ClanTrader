"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Award, Trophy, Star } from "lucide-react";

interface UserBadgeData {
  id: string;
  isActive: boolean;
  metadataJson: Record<string, unknown> | null;
  badgeDefinition: {
    key: string;
    category: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
  };
}

interface NextRank {
  name: string;
  key: string;
  min_closed_trades: number;
  currentCount: number;
  progress: number;
}

interface BadgeResponse {
  rank: UserBadgeData[];
  performance: UserBadgeData[];
  trophy: UserBadgeData[];
  nextRank: NextRank | null;
}

export function ProfileBadgeSection({ userId }: { userId: string }) {
  const [data, setData] = useState<BadgeResponse | null>(null);

  useEffect(() => {
    fetch(`/api/users/${userId}/badges`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {});
  }, [userId]);

  if (!data) return null;

  const hasBadges =
    data.rank.length > 0 ||
    data.performance.length > 0 ||
    data.trophy.length > 0;

  if (!hasBadges && !data.nextRank) return null;

  return (
    <TooltipProvider>
      <div className="rounded-lg border p-3 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Badges & Rank
        </h3>

        {/* Rank Badge */}
        {data.rank.length > 0 && (
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950 dark:text-amber-300"
                >
                  {data.rank[0].badgeDefinition.iconUrl ? (
                    <img
                      src={data.rank[0].badgeDefinition.iconUrl}
                      alt=""
                      className="me-1 h-4 w-4"
                    />
                  ) : null}
                  {data.rank[0].badgeDefinition.name}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{data.rank[0].badgeDefinition.description || "Rank badge"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Progress to next rank */}
        {data.nextRank && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                Next: {data.nextRank.name}
              </span>
              <span>
                {data.nextRank.currentCount}/{data.nextRank.min_closed_trades}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{
                  width: `${Math.min(100, data.nextRank.progress * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Performance Titles */}
        {data.performance.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-blue-500" />
            {data.performance.map((b) => (
              <Tooltip key={b.id}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300 text-[10px]"
                  >
                    {b.badgeDefinition.iconUrl ? (
                      <img
                        src={b.badgeDefinition.iconUrl}
                        alt=""
                        className="me-1 h-3 w-3"
                      />
                    ) : null}
                    {b.badgeDefinition.name}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{b.badgeDefinition.description || "Performance title"}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}

        {/* Trophy Badges */}
        {data.trophy.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-purple-500" />
            {data.trophy.map((b) => (
              <Tooltip key={b.id}>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-300 text-[10px]"
                  >
                    {b.badgeDefinition.iconUrl ? (
                      <img
                        src={b.badgeDefinition.iconUrl}
                        alt=""
                        className="me-1 h-3 w-3"
                      />
                    ) : null}
                    {b.badgeDefinition.name}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{b.badgeDefinition.description || "Trophy badge"}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
