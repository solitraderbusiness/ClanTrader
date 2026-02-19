"use client";

import { Badge } from "@/components/ui/badge";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { AutoPostBadge } from "./AutoPostBadge";
import { Lock } from "lucide-react";

interface TradeCardData {
  instrument: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  targets: number[];
  timeframe: string;
  note?: string;
  tags?: string[];
}

interface SignalPostCardProps {
  content: string;
  isPro: boolean;
  isPaywalled: boolean;
}

export function SignalPostCard({
  content,
  isPro,
  isPaywalled,
}: SignalPostCardProps) {
  let data: TradeCardData;
  try {
    data = JSON.parse(content);
  } catch {
    return <p className="text-sm">{content}</p>;
  }

  const showDetails = isPro || !isPaywalled;

  return (
    <div className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      <div className="mb-2">
        <AutoPostBadge />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <DirectionBadge direction={data.direction} />
        <span className="font-semibold">{data.instrument}</span>
        <Badge variant="outline" className="text-[10px]">
          {data.timeframe}
        </Badge>
      </div>

      {showDetails ? (
        <>
          <div className="mb-3 grid grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Entry</span>
              <p className="font-mono font-medium">{data.entry}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Stop Loss</span>
              <p className="font-mono font-medium text-red-500">{data.stopLoss}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Target</span>
              <p className="font-mono font-medium text-green-500">{data.targets[0]}</p>
            </div>
          </div>

          {data.targets.length > 1 && (
            <div className="mb-3 flex gap-3 text-xs">
              {data.targets.slice(1).map((tp, i) => (
                <div key={i}>
                  <span className="text-muted-foreground">TP{i + 2}</span>
                  <p className="font-mono font-medium text-green-500">{tp}</p>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>Entry, Stop Loss, and Targets are hidden. Upgrade to Pro to see details.</span>
        </div>
      )}

      {data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {data.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
