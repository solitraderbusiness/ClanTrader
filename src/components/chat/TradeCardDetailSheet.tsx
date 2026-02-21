"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { Loader2 } from "lucide-react";

interface TradeDetail {
  id: string;
  status: string;
  userId: string;
  createdAt: string;
  closedAt: string | null;
  integrityStatus?: string;
  integrityReason?: string | null;
  integrityDetails?: Record<string, unknown> | null;
  statementEligible?: boolean;
  resolutionSource?: string;
  tradeCard: {
    instrument: string;
    direction: string;
    entry: number;
    stopLoss: number;
    targets: number[];
    timeframe: string;
    riskPct: number | null;
    note: string | null;
    tags: string[];
    message: {
      id: string;
      user: { id: string; name: string | null; avatar: string | null; role: string };
    };
  };
  statusHistory: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    changedById: string;
    note: string | null;
    createdAt: string;
  }>;
  user: { id: string; name: string | null };
}

interface TradeCardDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tradeId: string | null;
  clanId: string;
  currentUserId: string;
}

export function TradeCardDetailSheet({
  open,
  onOpenChange,
  tradeId,
  clanId,
  currentUserId,
}: TradeCardDetailSheetProps) {
  const [trade, setTrade] = useState<TradeDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !tradeId) {
      setTrade(null);
      return;
    }

    async function fetchTrade() {
      setLoading(true);
      try {
        const res = await fetch(`/api/clans/${clanId}/trades/${tradeId}`);
        if (res.ok) {
          const data = await res.json();
          setTrade(data.trade);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }

    fetchTrade();
  }, [open, tradeId, clanId]);

  function handleStatusUpdate(status: string) {
    if (!trade) return;
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.UPDATE_TRADE_STATUS, {
      tradeId: trade.id,
      clanId,
      status,
    });
    // Optimistic update
    setTrade((prev) =>
      prev ? { ...prev, status } : prev
    );
  }

  const isTracker = trade?.userId === currentUserId;
  const isOpen = trade?.status === "OPEN";
  const isPending = trade?.status === "PENDING";
  const canUpdateStatus = isTracker && (isOpen || isPending);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Trade Detail</SheetTitle>
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {!loading && trade && (
          <div className="mt-4 space-y-4 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-2">
              <DirectionBadge direction={trade.tradeCard.direction as "LONG" | "SHORT"} />
              <span className="text-lg font-semibold">{trade.tradeCard.instrument}</span>
              <StatusBadge status={trade.status} />
            </div>

            {/* Price Details */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Entry</span>
                <p className="font-mono font-medium">{trade.tradeCard.entry}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Stop Loss</span>
                <p className="font-mono font-medium text-red-500">{trade.tradeCard.stopLoss}</p>
              </div>
              {trade.tradeCard.targets.map((tp, i) => (
                <div key={i}>
                  <span className="text-muted-foreground">
                    {trade.tradeCard.targets.length > 1 ? `TP${i + 1}` : "Target"}
                  </span>
                  <p className="font-mono font-medium text-green-500">{tp}</p>
                </div>
              ))}
            </div>

            {/* Meta */}
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{trade.tradeCard.timeframe}</Badge>
              {trade.tradeCard.riskPct != null && (
                <span>Risk: {trade.tradeCard.riskPct}%</span>
              )}
              <span>By: {trade.tradeCard.message.user.name}</span>
              <span>Tracked by: {trade.user.name}</span>
            </div>

            {/* Tags */}
            {trade.tradeCard.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {trade.tradeCard.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Note */}
            {trade.tradeCard.note && (
              <p className="text-sm italic text-muted-foreground">
                {trade.tradeCard.note}
              </p>
            )}

            {/* Pending State */}
            {isPending && (
              <div className="rounded-md border border-indigo-500/30 bg-indigo-500/5 p-3 text-sm text-indigo-600 dark:text-indigo-400">
                Waiting for entry confirmation...
              </div>
            )}

            {/* Quick Actions */}
            {canUpdateStatus && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 text-sm font-medium">Update Status</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600"
                      onClick={() => handleStatusUpdate("TP_HIT")}
                    >
                      TP Hit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                      onClick={() => handleStatusUpdate("SL_HIT")}
                    >
                      SL Hit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-yellow-600"
                      onClick={() => handleStatusUpdate("BE")}
                    >
                      Break Even
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusUpdate("CLOSED")}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Integrity Section */}
            {trade.integrityStatus && trade.integrityStatus !== "VERIFIED" && (
              <>
                <Separator />
                <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-sm">
                  <p className="font-medium text-orange-600 dark:text-orange-400">
                    Integrity: {trade.integrityStatus}
                    {trade.integrityReason && (
                      <span className="ms-2 font-normal text-muted-foreground">
                        ({trade.integrityReason.replace(/_/g, " ").toLowerCase()})
                      </span>
                    )}
                  </p>
                  {trade.statementEligible === false && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Excluded from statements &amp; competition
                    </p>
                  )}
                  {trade.integrityReason === "MANUAL_OVERRIDE" && (
                    <Badge variant="outline" className="mt-1 text-[10px] border-orange-500/50">
                      Manual
                    </Badge>
                  )}
                </div>
              </>
            )}

            {/* Status History */}
            {trade.statusHistory.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="mb-2 text-sm font-medium">Status History</p>
                  <div className="space-y-2">
                    {trade.statusHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <StatusBadge status={entry.fromStatus} />
                        <span>&rarr;</span>
                        <StatusBadge status={entry.toStatus} />
                        <span className="text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                        {entry.note && (
                          <span className="italic text-muted-foreground">
                            - {entry.note}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
