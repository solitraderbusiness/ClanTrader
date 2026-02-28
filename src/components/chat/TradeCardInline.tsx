"use client";

import { useEffect } from "react";
import { Pin, Link2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DirectionBadge } from "@/components/shared/DirectionBadge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RiskStatusBadge } from "@/components/shared/RiskStatusBadge";
import { Badge } from "@/components/ui/badge";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { useChatStore, type TradeCardData } from "@/stores/chat-store";
import { TradeActionsMenu } from "./TradeActionsMenu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";

interface TradeCardInlineProps {
  tradeCard: TradeCardData;
  messageId: string;
  clanId: string;
  currentUserId: string;
  isPinned?: boolean;
  userRole?: string;
  memberRole?: string;
}

export function TradeCardInline({
  tradeCard,
  messageId,
  clanId,
  currentUserId,
  isPinned,
  userRole,
  memberRole,
}: TradeCardInlineProps) {
  const { t } = useTranslation();

  function handleTrack() {
    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.TRACK_TRADE, { messageId, clanId });
  }

  const isTracker = tradeCard.trade?.userId === currentUserId;
  const tradeStatus = tradeCard.trade?.status;
  const canAct = tradeStatus === "OPEN" || tradeStatus === "PENDING";
  const mtLinked = tradeCard.trade?.mtLinked;
  const pendingAction = tradeCard.trade?.pendingAction;
  const { clearTradeCardPendingAction, updateTradeCardPendingAction } = useChatStore();

  // Auto-clear pending action when it expires (client-side timeout fallback)
  useEffect(() => {
    if (!pendingAction || pendingAction.status || !pendingAction.expiresAt || !tradeCard.trade?.id)
      return;
    const expiresMs = new Date(pendingAction.expiresAt).getTime() - Date.now();
    if (expiresMs <= 0) {
      updateTradeCardPendingAction(tradeCard.trade.id, {
        ...pendingAction,
        status: "TIMED_OUT",
        errorMessage: "Action timed out",
      });
      return;
    }
    const timer = setTimeout(() => {
      updateTradeCardPendingAction(tradeCard.trade!.id, {
        ...pendingAction,
        status: "TIMED_OUT",
        errorMessage: "Action timed out",
      });
    }, expiresMs);
    return () => clearTimeout(timer);
  }, [pendingAction, tradeCard.trade?.id, clearTradeCardPendingAction, updateTradeCardPendingAction]);

  const isAnalysis = tradeCard.cardType === "ANALYSIS";

  const riskReward = tradeCard.stopLoss > 0 && tradeCard.targets[0] > 0
    ? Math.abs(tradeCard.targets[0] - tradeCard.entry) /
      Math.abs(tradeCard.entry - tradeCard.stopLoss)
    : null;

  const livePnl = useChatStore((s) =>
    tradeCard.trade?.id ? s.tradePnl[tradeCard.trade.id] : undefined
  );
  const isOpen = tradeStatus === "OPEN";
  const isClosed = tradeStatus === "TP_HIT" || tradeStatus === "SL_HIT" || tradeStatus === "BE" || tradeStatus === "CLOSED";
  const riskStatus = livePnl?.riskStatus || tradeCard.trade?.riskStatus;
  const finalRR = tradeCard.trade?.finalRR;
  const netProfit = tradeCard.trade?.netProfit;

  return (
    <div
      data-testid="trade-card"
      className={`relative overflow-hidden rounded-xl glass-card text-[15px] ${
        isPinned ? "ring-2 ring-yellow-400/50" : ""
      }`}
    >
      {/* Colored accent bar */}
      <div
        className={`absolute inset-y-0 start-0 w-1 ${
          isAnalysis
            ? "bg-blue-500"
            : tradeCard.direction === "LONG" ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <div className={`absolute inset-0 ${
        isAnalysis
          ? "bg-gradient-to-b from-blue-500/5 to-transparent"
          : tradeCard.direction === "LONG"
            ? "bg-gradient-to-b from-green-500/5 to-transparent"
            : "bg-gradient-to-b from-red-500/5 to-transparent"
      } pointer-events-none`} />
      {isPinned && (
        <Pin className="absolute -top-1 -end-1 h-3 w-3 text-yellow-500" />
      )}

      <div className="p-3 ps-4">
      {/* Header: Direction + Instrument + Status + Actions */}
      <div className="mb-2 flex items-center gap-2">
        <DirectionBadge direction={tradeCard.direction as "LONG" | "SHORT"} />
        <span className="font-semibold">{tradeCard.instrument}</span>
        <Badge variant="outline" className="text-[10px]">
          {tradeCard.timeframe === "AUTO" ? "Auto" : tradeCard.timeframe}
        </Badge>
        {isAnalysis && (
          <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-600 dark:text-blue-400">
            {t("trade.analysis")}
          </Badge>
        )}
        {tradeCard.trade && <StatusBadge status={tradeCard.trade.status} />}
        {mtLinked && (
          <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-600 dark:text-blue-400">
            <Link2 className="me-0.5 h-2.5 w-2.5" />
            MT
          </Badge>
        )}
        {riskStatus && riskStatus !== "PROTECTED" && (
          <RiskStatusBadge status={riskStatus} />
        )}
        {pendingAction && !pendingAction.status && (
          <Badge variant="outline" className="animate-pulse text-[10px] border-yellow-500/50 text-yellow-600 dark:text-yellow-400">
            <Loader2 className="me-0.5 h-2.5 w-2.5 animate-spin" />
            {t("trade.pendingAction")}
          </Badge>
        )}
        {(pendingAction?.status === "FAILED" || pendingAction?.status === "TIMED_OUT") && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-600 dark:text-red-400">
                  <AlertCircle className="me-0.5 h-2.5 w-2.5" />
                  {t("trade.actionFailed")}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{pendingAction.errorMessage || t("trade.actionFailedDefault")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {tradeCard.trade && canAct && (
          <div className="ms-auto">
            <TradeActionsMenu
              tradeId={tradeCard.trade.id}
              clanId={clanId}
              currentUserId={currentUserId}
              userRole={userRole}
              memberRole={memberRole || "MEMBER"}
              isAuthor={isTracker}
              mtLinked={mtLinked}
              pendingActionType={pendingAction && !pendingAction.status ? pendingAction.actionType : null}
            />
          </div>
        )}
      </div>

      {/* Price Grid */}
      <div className={`mb-2 grid gap-2 text-xs ${isOpen || (isClosed && finalRR != null) ? "grid-cols-4" : "grid-cols-3"}`}>
        <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1.5 text-center">
          <span className="text-muted-foreground">{t("trade.entry")}</span>
          <p className="font-mono font-medium">{tradeCard.entry}</p>
        </div>
        <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1.5 text-center">
          <span className="text-muted-foreground">{t("trade.stopLoss")}</span>
          {tradeCard.stopLoss > 0 ? (
            <p className="font-mono font-medium text-red-500">{tradeCard.stopLoss}</p>
          ) : (
            <p className="font-mono font-medium text-muted-foreground/50">{t("trade.notSet")}</p>
          )}
        </div>
        <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1.5 text-center">
          <span className="text-muted-foreground">{t("trade.target")}</span>
          {tradeCard.targets[0] > 0 ? (
            <p className="font-mono font-medium text-green-500">{tradeCard.targets[0]}</p>
          ) : (
            <p className="font-mono font-medium text-muted-foreground/50">{t("trade.notSet")}</p>
          )}
        </div>
        {isOpen && (
          <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1.5 text-center">
            <span className="text-muted-foreground">{t("trade.liveRR")}</span>
            {livePnl ? (
              <>
                <p className={`font-mono font-bold ${
                  livePnl.currentRR > 0
                    ? "text-green-500"
                    : livePnl.currentRR < 0
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}>
                  {livePnl.currentRR > 0 ? "+" : ""}{livePnl.currentRR.toFixed(2)}R
                </p>
                <p className="font-mono text-[10px] text-muted-foreground/60">{livePnl.currentPrice}</p>
                {livePnl.targetRR != null ? (
                  <p className="font-mono text-[10px] text-muted-foreground/60">{t("trade.target")}: {livePnl.targetRR.toFixed(1)}R</p>
                ) : (
                  <p className="font-mono text-[10px] text-muted-foreground/40">{t("trade.openTarget")}</p>
                )}
              </>
            ) : (
              <p className="font-mono font-medium text-muted-foreground/40">
                <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
              </p>
            )}
          </div>
        )}
        {isClosed && finalRR != null && (
          <div className="rounded-lg bg-muted/30 backdrop-blur-sm px-2 py-1.5 text-center">
            <span className="text-muted-foreground">{t("trade.result")}</span>
            <p className={`font-mono font-bold ${
              finalRR > 0
                ? "text-green-500"
                : finalRR < 0
                  ? "text-red-500"
                  : "text-muted-foreground"
            }`}>
              {finalRR > 0 ? "+" : ""}{finalRR.toFixed(2)}R
            </p>
            {netProfit != null && (
              <p className={`font-mono text-[10px] ${
                netProfit > 0 ? "text-green-500/70" : netProfit < 0 ? "text-red-500/70" : "text-muted-foreground/60"
              }`}>
                {netProfit > 0 ? "+" : ""}{netProfit.toFixed(2)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Meta Row */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {tradeCard.riskPct != null && (
          <span>{t("trade.risk")}: {tradeCard.riskPct}%</span>
        )}
        {riskReward != null ? (
          <span>{t("trade.riskReward")} 1:{riskReward.toFixed(1)}</span>
        ) : tradeCard.stopLoss === 0 || tradeCard.targets[0] === 0 ? (
          <span>{t("trade.riskReward")} —</span>
        ) : null}
      </div>

      {/* Tags */}
      {tradeCard.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {tradeCard.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className={`text-[10px] ${
                tag === "signal"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : tag === "analysis"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    : ""
              }`}
            >
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

      {/* Track Button */}
      {!tradeCard.trade && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs"
            onClick={handleTrack}
          >
            {t("trade.track")}
          </Button>
        </div>
      )}
      </div>
    </div>
  );
}
