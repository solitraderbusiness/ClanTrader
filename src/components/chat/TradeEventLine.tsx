"use client";

import { Activity } from "lucide-react";

interface TradeEventLineProps {
  content: string;
  createdAt: string;
}

export function TradeEventLine({ content, createdAt }: TradeEventLineProps) {
  return (
    <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
      <Activity className="h-3 w-3 flex-shrink-0" />
      <span className="flex-1">{content}</span>
      <span className="flex-shrink-0 text-[10px]">
        {new Date(createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
