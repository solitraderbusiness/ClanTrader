"use client";

import { Badge } from "@/components/ui/badge";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { AutoPostBadge } from "./AutoPostBadge";

interface TradeCardChannelPostProps {
  content: string;
  isAutoPost: boolean;
}

interface TradeCardPostData {
  instrument: string;
  direction: "LONG" | "SHORT";
  entry: number;
  stopLoss: number;
  targets: number[];
  timeframe: string;
  note?: string;
  tags?: string[];
}

export function TradeCardChannelPost({
  content,
  isAutoPost,
}: TradeCardChannelPostProps) {
  let data: TradeCardPostData;
  try {
    data = JSON.parse(content);
  } catch {
    return <p className="text-sm">{content}</p>;
  }

  const riskReward = data.stopLoss
    ? Math.abs(data.targets[0] - data.entry) /
      Math.abs(data.entry - data.stopLoss)
    : null;

  return (
    <div className="rounded-lg border bg-card p-4 text-sm shadow-sm">
      {isAutoPost && (
        <div className="mb-2">
          <AutoPostBadge />
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <DirectionBadge direction={data.direction} />
        <span className="font-semibold">{data.instrument}</span>
        <Badge variant="outline" className="text-[10px]">
          {data.timeframe}
        </Badge>
      </div>

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

      {riskReward != null && (
        <p className="mb-2 text-xs text-muted-foreground">
          R:R 1:{riskReward.toFixed(1)}
        </p>
      )}

      {data.tags && data.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {data.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {data.note && (
        <p className="text-xs italic text-muted-foreground">{data.note}</p>
      )}
    </div>
  );
}
