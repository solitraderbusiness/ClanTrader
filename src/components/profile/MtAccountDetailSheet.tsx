"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { MetricsDisplay } from "@/components/statements/MetricsDisplay";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { StatementMetrics } from "@/types/statement";
import { useTranslation } from "@/lib/i18n";

interface MtAccountDetailSheetProps {
  userId: string;
  accountId: string | null;
  isOwnProfile: boolean;
  onClose: () => void;
}

interface TradeRow {
  id: string;
  ticket: number;
  symbol: string;
  direction: "BUY" | "SELL";
  lots: number;
  openPrice: number;
  closePrice?: number | null;
  openTime: string;
  closeTime?: string | null;
  profit?: number | null;
  commission?: number | null;
  swap?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

interface AccountDetail {
  account: {
    id: string;
    accountNumber: number;
    accountNumberMasked: boolean;
    broker: string;
    platform: string;
    accountType: string;
    balance: number;
    equity: number;
    currency: string;
    lastHeartbeat: string | null;
    connectedAt: string;
  };
  metrics: StatementMetrics | null;
  verificationMethod: string | null;
  openTrades: TradeRow[];
  recentTrades: TradeRow[];
}

function getConnectionStatus(lastHeartbeat: string | null) {
  if (!lastHeartbeat) return { labelKey: "offline" as const, color: "bg-red-500" };
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  const minutes = diff / 60000;
  if (minutes < 2) return { labelKey: "online" as const, color: "bg-green-500" };
  if (minutes < 5) return { labelKey: "idle" as const, color: "bg-yellow-500" };
  return { labelKey: "offline" as const, color: "bg-red-500" };
}

function netPnl(trade: TradeRow): number {
  return (trade.profit ?? 0) + (trade.commission ?? 0) + (trade.swap ?? 0);
}

function formatPnl(value: number, currency: string): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} ${currency}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MtAccountDetailSheet({
  userId,
  accountId,
  onClose,
}: MtAccountDetailSheetProps) {
  const [data, setData] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!accountId) {
      setData(null);
      return;
    }

    async function fetchAccount() {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${userId}/mt-accounts/${accountId}`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }

    fetchAccount();
  }, [userId, accountId]);

  return (
    <Sheet open={!!accountId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && data && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {data.account.broker}
                <Badge variant="outline" className="font-mono text-xs">
                  {data.account.platform}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    data.account.accountType === "LIVE"
                      ? "border-green-500 text-green-600"
                      : "border-blue-500 text-blue-600"
                  )}
                >
                  {data.account.accountType}
                </Badge>
              </SheetTitle>
            </SheetHeader>

            {/* Account info */}
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                #{data.account.accountNumberMasked
                  ? `***${data.account.accountNumber}`
                  : data.account.accountNumber}
              </span>
              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    getConnectionStatus(data.account.lastHeartbeat).color
                  )}
                />
                <span className="text-xs">
                  {t(`settings.${getConnectionStatus(data.account.lastHeartbeat).labelKey}`)}
                </span>
              </div>
            </div>

            <div className="mt-2 flex gap-4 text-sm">
              <div className="rounded-lg border p-3 flex-1 text-center">
                <p className="text-xs text-muted-foreground">{t("settings.balance")}</p>
                <p className="font-semibold">
                  {data.account.balance.toLocaleString()} {data.account.currency}
                </p>
              </div>
              <div className="rounded-lg border p-3 flex-1 text-center">
                <p className="text-xs text-muted-foreground">{t("settings.equity")}</p>
                <p className="font-semibold">
                  {data.account.equity.toLocaleString()} {data.account.currency}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="mt-6">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t("settings.tradingStats")}
              </h4>
              {data.metrics ? (
                <MetricsDisplay
                  metrics={data.metrics}
                  verificationMethod={data.verificationMethod ?? undefined}
                  compact
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("settings.notEnoughTrades")}
                </p>
              )}
            </div>

            {/* Open trades */}
            {data.openTrades.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t("settings.openPositions", { count: data.openTrades.length })}
                </h4>
                <div className="space-y-2">
                  {data.openTrades.map((trade) => {
                    const pnl = netPnl(trade);
                    return (
                      <div
                        key={trade.id}
                        className="rounded-lg border p-3 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{trade.symbol}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                trade.direction === "BUY"
                                  ? "border-green-500 text-green-600"
                                  : "border-red-500 text-red-600"
                              )}
                            >
                              {trade.direction}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {trade.lots} lots
                            </span>
                          </div>
                          <span
                            className={cn(
                              "font-medium",
                              pnl >= 0 ? "text-green-600" : "text-red-600"
                            )}
                          >
                            {formatPnl(pnl, data.account.currency)}
                          </span>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{t("settings.entry")} {trade.openPrice}</span>
                          {trade.stopLoss != null && <span>{t("settings.sl")} {trade.stopLoss}</span>}
                          {trade.takeProfit != null && <span>{t("settings.tp")} {trade.takeProfit}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent closed trades */}
            {data.recentTrades.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t("settings.recentTrades", { count: data.recentTrades.length })}
                </h4>
                <div className="space-y-2">
                  {data.recentTrades.map((trade) => {
                    const pnl = netPnl(trade);
                    return (
                      <div
                        key={trade.id}
                        className="rounded-lg border p-3 text-sm space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{trade.symbol}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                trade.direction === "BUY"
                                  ? "border-green-500 text-green-600"
                                  : "border-red-500 text-red-600"
                              )}
                            >
                              {trade.direction}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {trade.lots} lots
                            </span>
                          </div>
                          <span
                            className={cn(
                              "font-medium",
                              pnl >= 0 ? "text-green-600" : "text-red-600"
                            )}
                          >
                            {formatPnl(pnl, data.account.currency)}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {trade.openPrice} &rarr; {trade.closePrice ?? "\u2014"}
                          </span>
                          <span>{trade.closeTime ? formatTime(trade.closeTime) : "\u2014"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data.openTrades.length === 0 && data.recentTrades.length === 0 && (
              <div className="mt-6">
                <p className="text-sm text-muted-foreground">
                  {t("settings.noTradesYet")}
                </p>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
