"use client";

import { Activity } from "lucide-react";

interface TradeEventLineProps {
  content: string;
  createdAt: string;
}

function getResultColor(content: string): string {
  if (/TP_HIT|\+\d/.test(content)) return "text-green-600 dark:text-green-400";
  if (/SL_HIT|-\d/.test(content)) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function formatEventContent(content: string): React.ReactNode {
  // Highlight the result portion (e.g. "TP_HIT | +0.94R" or "SL_HIT | -1.00R")
  const match = content.match(/(.*?)((?:TP_HIT|SL_HIT|BE|CLOSED)\s*\|?\s*[+-]?\d*\.?\d*R?)(.*)$/);
  if (match) {
    const [, before, result, after] = match;
    const color = /TP_HIT|\+/.test(result) ? "text-green-600 dark:text-green-400 font-semibold" : /SL_HIT|-/.test(result) ? "text-red-600 dark:text-red-400 font-semibold" : "font-semibold";
    return (
      <>
        {before}
        <span className={color}>{result}</span>
        {after}
      </>
    );
  }
  return content;
}

export function TradeEventLine({ content, createdAt }: TradeEventLineProps) {
  const resultColor = getResultColor(content);
  const iconColor = resultColor.includes("green") ? "text-green-500" : resultColor.includes("red") ? "text-red-500" : "text-muted-foreground";

  return (
    <div className="my-1 flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2 text-xs backdrop-blur-sm">
      <Activity className={`h-3.5 w-3.5 flex-shrink-0 ${iconColor}`} />
      <span className="flex-1 text-muted-foreground">
        {formatEventContent(content)}
      </span>
      <span className="flex-shrink-0 text-[10px] text-muted-foreground/60">
        {new Date(createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}
