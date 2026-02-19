"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { useTradePanelStore } from "@/stores/trade-panel-store";
import { useChatStore } from "@/stores/chat-store";
import { TRADE_STATUSES } from "@/lib/chat-constants";
import { Loader2, ArrowRight, BarChart3 } from "lucide-react";

interface TradeItem {
  id: string;
  status: string;
  createdAt: string;
  tradeCard: {
    instrument: string;
    direction: string;
    entry: number;
    stopLoss: number;
    targets: number[];
    timeframe: string;
    tags: string[];
    message: {
      id: string;
      user: { id: string; name: string | null };
    };
  };
  user: { id: string; name: string | null };
}

interface LatestTradesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clanId: string;
  onOpenDetail: (tradeId: string) => void;
}

export function LatestTradesSheet({
  open,
  onOpenChange,
  clanId,
  onOpenDetail,
}: LatestTradesSheetProps) {
  const [trades, setTrades] = useState<TradeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const { statusFilter, instrumentFilter, directionFilter, setStatusFilter, setDirectionFilter, resetFilters } =
    useTradePanelStore();
  const setHighlightMessageId = useChatStore((s) => s.setHighlightMessageId);

  const fetchTrades = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (instrumentFilter) params.set("instrument", instrumentFilter);
        if (directionFilter) params.set("direction", directionFilter);
        if (cursor) params.set("cursor", cursor);
        params.set("limit", "20");

        const res = await fetch(
          `/api/clans/${clanId}/trades?${params.toString()}`
        );
        if (res.ok) {
          const data = await res.json();
          if (cursor) {
            setTrades((prev) => [...prev, ...data.trades]);
          } else {
            setTrades(data.trades);
          }
          setHasMore(data.hasMore);
          setNextCursor(data.nextCursor);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    },
    [clanId, statusFilter, instrumentFilter, directionFilter]
  );

  useEffect(() => {
    if (open) {
      fetchTrades();
    }
  }, [open, fetchTrades]);

  function handleJumpToMessage(messageId: string) {
    setHighlightMessageId(messageId);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Latest Trades</SheetTitle>
        </SheetHeader>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => setStatusFilter(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {TRADE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={directionFilter || "all"}
            onValueChange={(v) => setDirectionFilter(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="LONG">LONG</SelectItem>
              <SelectItem value="SHORT">SHORT</SelectItem>
            </SelectContent>
          </Select>

          {(statusFilter || instrumentFilter || directionFilter) && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear
            </Button>
          )}
        </div>

        {/* Trade List */}
        <div className="mt-4 space-y-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {loading && trades.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!loading && trades.length === 0 && (
            <EmptyState
              icon={BarChart3}
              title="No trades found"
              description="No tracked trades match your filters."
            />
          )}

          {trades.map((trade) => (
            <div
              key={trade.id}
              className="rounded-lg border p-3 text-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DirectionBadge direction={trade.tradeCard.direction as "LONG" | "SHORT"} />
                  <span className="font-semibold">{trade.tradeCard.instrument}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {trade.tradeCard.timeframe}
                  </Badge>
                </div>
                <StatusBadge status={trade.status} />
              </div>

              <div className="mb-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Entry</span>
                  <p className="font-mono">{trade.tradeCard.entry}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">SL</span>
                  <p className="font-mono text-red-500">{trade.tradeCard.stopLoss}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">TP1</span>
                  <p className="font-mono text-green-500">{trade.tradeCard.targets[0]}</p>
                </div>
              </div>

              {trade.tradeCard.tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {trade.tradeCard.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>By {trade.tradeCard.message.user.name}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => handleJumpToMessage(trade.tradeCard.message.id)}
                  >
                    Jump <ArrowRight className="ms-1 h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => onOpenDetail(trade.id)}
                  >
                    Detail
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchTrades(nextCursor || undefined)}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
