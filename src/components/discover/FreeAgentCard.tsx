"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface FreeAgentCardProps {
  agent: {
    id: string;
    name: string | null;
    avatar: string | null;
    tradingStyle: string | null;
    preferredPairs: string[];
    metrics: {
      winRate: number;
      profitFactor: number;
      totalTrades: number;
    };
    isEaVerified?: boolean;
  };
}

export function FreeAgentCard({ agent }: FreeAgentCardProps) {
  const { t } = useTranslation();
  const winRate = agent.metrics.winRate;

  return (
    <Link href={`/profile/${agent.id}`}>
    <Card className="glass-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={agent.avatar || undefined} alt={agent.name || ""} />
          <AvatarFallback>
            {(agent.name || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">
              {agent.name || t("discover.unknownTrader")}
            </h3>
            {agent.isEaVerified && (
              <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {t("discover.ea")}
              </span>
            )}
            {agent.tradingStyle && (
              <Badge variant="secondary">{agent.tradingStyle}</Badge>
            )}
          </div>

          <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
            <span className={winRate > 60 ? "text-green-500" : winRate < 40 ? "text-red-500" : ""}>
              {t("discover.winRate")} <strong>{agent.metrics.winRate.toFixed(1)}%</strong>
            </span>
            <span>
              {t("discover.profitFactor")} <strong>{agent.metrics.profitFactor.toFixed(2)}</strong>
            </span>
            <span>
              {t("discover.tradeCount")} <strong>{agent.metrics.totalTrades}</strong>
            </span>
          </div>

          {agent.preferredPairs.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {agent.preferredPairs.slice(0, 4).map((pair) => (
                <Badge key={pair} variant="outline" className="text-[10px]">
                  {pair}
                </Badge>
              ))}
              {agent.preferredPairs.length > 4 && (
                <Badge variant="outline" className="text-[10px]">
                  +{agent.preferredPairs.length - 4}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
