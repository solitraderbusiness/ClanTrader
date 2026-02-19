"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SummaryData {
  totalMessages: number;
  totalTradeCards: number;
  instruments: Record<string, number>;
  directions: Record<string, number>;
  tradeStatuses: Record<string, number>;
  topTags: Record<string, number>;
}

interface SummarySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clanId: string;
  topicId: string | null;
  onSummaryMessage?: () => void;
}

const TIME_OPTIONS = [
  { label: "1h", hours: 1 },
  { label: "4h", hours: 4 },
  { label: "Today", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
];

export function SummarySheet({
  open,
  onOpenChange,
  clanId,
  topicId,
  onSummaryMessage,
}: SummarySheetProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedHours, setSelectedHours] = useState(24);

  async function generateSummary(hours: number) {
    if (!topicId) return;
    setSelectedHours(hours);
    setLoading(true);
    setSummary(null);

    try {
      const res = await fetch(
        `/api/clans/${clanId}/topics/${topicId}/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hours }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        onSummaryMessage?.();
        toast.success("Summary saved as message in chat");
      } else {
        toast.error("Failed to generate summary");
      }
    } catch {
      toast.error("Failed to generate summary");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Topic Summary</SheetTitle>
        </SheetHeader>

        {/* Time Range Selector */}
        <div className="mt-4 flex flex-wrap gap-2">
          {TIME_OPTIONS.map((opt) => (
            <Button
              key={opt.hours}
              variant={selectedHours === opt.hours ? "default" : "outline"}
              size="sm"
              onClick={() => generateSummary(opt.hours)}
              disabled={loading}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        <div className="mt-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!loading && !summary && (
            <EmptyState
              icon={FileText}
              title="Generate a summary"
              description="Select a time range to generate stats for this topic."
            />
          )}

          {!loading && summary && (
            <div className="space-y-4">
              {/* Overview */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{summary.totalMessages}</p>
                  <p className="text-xs text-muted-foreground">Messages</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{summary.totalTradeCards}</p>
                  <p className="text-xs text-muted-foreground">Trade Cards</p>
                </div>
              </div>

              {/* Instruments */}
              {Object.keys(summary.instruments).length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Instruments</h4>
                  <div className="space-y-1">
                    {Object.entries(summary.instruments)
                      .sort(([, a], [, b]) => b - a)
                      .map(([instrument, count]) => (
                        <div
                          key={instrument}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="font-mono">{instrument}</span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Directions */}
              {Object.keys(summary.directions).length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Direction Split</h4>
                  <div className="flex gap-4 text-sm">
                    {Object.entries(summary.directions).map(([dir, count]) => (
                      <div key={dir} className="flex items-center gap-1">
                        <span
                          className={
                            dir === "LONG" ? "text-green-500" : "text-red-500"
                          }
                        >
                          {dir}
                        </span>
                        <span className="text-muted-foreground">({count})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trade Statuses */}
              {Object.keys(summary.tradeStatuses).length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Trade Outcomes</h4>
                  <div className="flex flex-wrap gap-2 text-sm">
                    {Object.entries(summary.tradeStatuses).map(
                      ([status, count]) => (
                        <span
                          key={status}
                          className="rounded border px-2 py-0.5 text-xs"
                        >
                          {status}: {count}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {Object.keys(summary.topTags).length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Top Tags</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summary.topTags)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 10)
                      .map(([tag, count]) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          #{tag} ({count})
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
