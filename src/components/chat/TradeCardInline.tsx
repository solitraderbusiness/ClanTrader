"use client";

import { Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import type { TradeCardData } from "@/stores/chat-store";

interface TradeCardInlineProps {
  tradeCard: TradeCardData;
  messageId: string;
  clanId: string;
  currentUserId: string;
  isPinned?: boolean;
}

export function TradeCardInline({
  tradeCard,
  messageId,
  clanId,
  currentUserId,
  isPinned,
}: TradeCardInlineProps) {
  function handleTrack() {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.TRACK_TRADE, { messageId, clanId });
  }

  function handleStatusUpdate(status: string) {
    if (!tradeCard.trade) return;
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.UPDATE_TRADE_STATUS, {
      tradeId: tradeCard.trade.id,
      clanId,
      status,
    });
  }

  const isTracker = tradeCard.trade?.userId === currentUserId;
  const hasTarget2 = tradeCard.targets.length > 1;
  const riskReward = tradeCard.stopLoss
    ? Math.abs(tradeCard.targets[0] - tradeCard.entry) /
      Math.abs(tradeCard.entry - tradeCard.stopLoss)
    : null;

  return (
    <div
      className={`relative rounded-lg border bg-card p-3 text-sm shadow-sm ${
        isPinned ? "ring-2 ring-yellow-400/50" : ""
      }`}
    >
      {isPinned && (
        <Pin className="absolute -top-1 -end-1 h-3 w-3 text-yellow-500" />
      )}

      {/* Header: Direction + Instrument + Status */}
      <div className="mb-2 flex items-center gap-2">
        <DirectionBadge direction={tradeCard.direction as "LONG" | "SHORT"} />
        <span className="font-semibold">{tradeCard.instrument}</span>
        <Badge variant="outline" className="text-[10px]">
          {tradeCard.timeframe}
        </Badge>
        {tradeCard.trade && <StatusBadge status={tradeCard.trade.status} />}
      </div>

      {/* Price Grid */}
      <div className="mb-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Entry</span>
          <p className="font-mono font-medium">{tradeCard.entry}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Stop Loss</span>
          <p className="font-mono font-medium text-red-500">{tradeCard.stopLoss}</p>
        </div>
        <div>
          <span className="text-muted-foreground">
            {hasTarget2 ? "TP1" : "Target"}
          </span>
          <p className="font-mono font-medium text-green-500">{tradeCard.targets[0]}</p>
        </div>
      </div>

      {hasTarget2 && (
        <div className="mb-2 flex gap-2 text-xs">
          {tradeCard.targets.slice(1).map((tp, i) => (
            <div key={i}>
              <span className="text-muted-foreground">TP{i + 2}</span>
              <p className="font-mono font-medium text-green-500">{tp}</p>
            </div>
          ))}
        </div>
      )}

      {/* Meta Row */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {tradeCard.riskPct != null && (
          <span>Risk: {tradeCard.riskPct}%</span>
        )}
        {riskReward != null && (
          <span>R:R 1:{riskReward.toFixed(1)}</span>
        )}
      </div>

      {/* Tags */}
      {tradeCard.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {tradeCard.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Note */}
      {tradeCard.note && (
        <p className="mb-2 text-xs italic text-muted-foreground">
          {tradeCard.note}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        {!tradeCard.trade && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={handleTrack}
          >
            Track
          </Button>
        )}
        {isTracker && tradeCard.trade && tradeCard.trade.status === "OPEN" && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs text-green-600"
              onClick={() => handleStatusUpdate("TP1_HIT")}
            >
              TP1
            </Button>
            {hasTarget2 && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs text-emerald-600"
                onClick={() => handleStatusUpdate("TP2_HIT")}
              >
                TP2
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs text-red-600"
              onClick={() => handleStatusUpdate("SL_HIT")}
            >
              SL
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs text-yellow-600"
              onClick={() => handleStatusUpdate("BE")}
            >
              BE
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              onClick={() => handleStatusUpdate("CLOSED")}
            >
              Close
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
