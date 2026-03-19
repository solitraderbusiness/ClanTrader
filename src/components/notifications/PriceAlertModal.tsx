"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import { toast } from "sonner";
import { SymbolAutocomplete } from "./SymbolAutocomplete";

interface PriceAlertModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSymbol?: string;
  onCreated?: () => void;
}

/** Format price with smart decimal places (min 2, max 8) */
function formatLivePrice(price: number): string {
  const str = price.toString();
  const dotIndex = str.indexOf(".");
  if (dotIndex === -1) return price.toFixed(2);
  const decimals = str.length - dotIndex - 1;
  const clamped = Math.max(2, Math.min(decimals, 8));
  return price.toFixed(clamped);
}

function DistanceHint({
  livePrice,
  targetPrice,
  condition,
  t,
}: {
  livePrice: number | null;
  targetPrice: string;
  condition: "ABOVE" | "BELOW";
  t: (key: string) => string;
}) {
  const parsed = parseFloat(targetPrice);
  if (livePrice == null || isNaN(parsed) || parsed <= 0) return null;

  const diff = parsed - livePrice;
  const absDiff = Math.abs(diff);
  const pct = ((absDiff / livePrice) * 100).toFixed(2);
  const isWrongDirection =
    (condition === "ABOVE" && parsed <= livePrice) ||
    (condition === "BELOW" && parsed >= livePrice);

  return (
    <div className={`flex items-center gap-1.5 text-xs ${isWrongDirection ? "text-red-500" : "text-muted-foreground"}`}>
      {diff > 0 ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      <span>
        {formatLivePrice(absDiff)} ({pct}%)
        {isWrongDirection && (
          <span className="ms-1 font-medium">
            {condition === "ABOVE" ? t("priceAlerts.aboveMustBeHigher") : t("priceAlerts.belowMustBeLower")}
          </span>
        )}
      </span>
    </div>
  );
}

export function PriceAlertModal({
  open,
  onOpenChange,
  defaultSymbol,
  onCreated,
}: PriceAlertModalProps) {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState(defaultSymbol?.toUpperCase() ?? "");
  const [condition, setCondition] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [targetPrice, setTargetPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tradedSymbols, setTradedSymbols] = useState<string[]>([]);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [livePriceLoading, setLivePriceLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const priceAbortRef = useRef<AbortController | null>(null);

  // Fetch traded symbols when modal opens
  useEffect(() => {
    if (!open) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSymbolsLoading(true);
    fetch("/api/users/me/traded-symbols", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setTradedSymbols(data.symbols ?? []);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setTradedSymbols([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSymbolsLoading(false);
        }
      });

    return () => controller.abort();
  }, [open]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSymbol(defaultSymbol?.toUpperCase() ?? "");
      setTargetPrice("");
      setCondition("ABOVE");
      setLivePrice(null);
    }
  }, [open, defaultSymbol]);

  // Fetch live price when symbol is selected (and poll every 10s)
  useEffect(() => {
    if (!open) return;
    const upperSymbol = symbol.trim().toUpperCase();
    if (!upperSymbol || !tradedSymbols.includes(upperSymbol)) {
      setLivePrice(null);
      return;
    }

    priceAbortRef.current?.abort();
    const controller = new AbortController();
    priceAbortRef.current = controller;

    async function fetchPrice() {
      try {
        setLivePriceLoading(true);
        const res = await fetch(`/api/prices?symbol=${encodeURIComponent(upperSymbol)}`, {
          signal: controller.signal,
        });
        if (res.ok && !controller.signal.aborted) {
          const data = await res.json();
          if (data.price != null) {
            setLivePrice(data.price);
          }
        }
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setLivePrice(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLivePriceLoading(false);
        }
      }
    }

    fetchPrice();
    const interval = setInterval(fetchPrice, 10_000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [open, symbol, tradedSymbols]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const upperSymbol = symbol.trim().toUpperCase();
    const price = parseFloat(targetPrice);

    if (!upperSymbol || isNaN(price) || price <= 0) {
      toast.error(t("priceAlerts.invalidInput"));
      return;
    }

    if (!tradedSymbols.includes(upperSymbol)) {
      toast.error(t("priceAlerts.invalidSymbol"));
      return;
    }

    // Validate direction against current price
    if (livePrice != null) {
      if (condition === "ABOVE" && price <= livePrice) {
        toast.error(t("priceAlerts.aboveMustBeHigher"));
        return;
      }
      if (condition === "BELOW" && price >= livePrice) {
        toast.error(t("priceAlerts.belowMustBeLower"));
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: upperSymbol,
          condition,
          targetPrice: price,
        }),
      });

      if (res.ok) {
        toast.success(t("priceAlerts.created"));
        setSymbol(defaultSymbol?.toUpperCase() ?? "");
        setTargetPrice("");
        onOpenChange(false);
        onCreated?.();
      } else {
        const data = await res.json();
        if (data.code === "MAX_ALERTS_REACHED") {
          toast.error(t("priceAlerts.maxReached"));
        } else if (data.code === "INVALID_SYMBOL") {
          toast.error(t("priceAlerts.invalidSymbol"));
        } else {
          toast.error(t("priceAlerts.createError"));
        }
      }
    } catch {
      toast.error(t("priceAlerts.createError"));
    } finally {
      setSubmitting(false);
    }
  }

  const hasNoSymbols = !symbolsLoading && tradedSymbols.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("priceAlerts.createTitle")}</DialogTitle>
        </DialogHeader>

        {hasNoSymbols ? (
          <p className="text-sm text-muted-foreground py-4">
            {t("priceAlerts.noTradedSymbols")}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Symbol */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="alert-symbol">{t("priceAlerts.symbol")}</Label>
                {livePrice != null && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("priceAlerts.currentPrice")}{" "}
                    <span className="font-mono text-foreground">
                      {formatLivePrice(livePrice)}
                    </span>
                  </span>
                )}
                {livePriceLoading && livePrice == null && (
                  <span className="text-xs text-muted-foreground animate-pulse">...</span>
                )}
              </div>
              <SymbolAutocomplete
                id="alert-symbol"
                value={symbol}
                onChange={setSymbol}
                symbols={tradedSymbols}
                loading={symbolsLoading}
                placeholder={t("priceAlerts.symbolPlaceholder")}
              />
            </div>

            {/* Condition */}
            <div className="space-y-2">
              <Label>{t("priceAlerts.condition")}</Label>
              <Select
                value={condition}
                onValueChange={(v) => setCondition(v as "ABOVE" | "BELOW")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABOVE">{t("priceAlerts.above")}</SelectItem>
                  <SelectItem value="BELOW">{t("priceAlerts.below")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target price */}
            <div className="space-y-2">
              <Label htmlFor="alert-price">{t("priceAlerts.targetPrice")}</Label>
              <Input
                id="alert-price"
                type="number"
                step="any"
                min="0"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="2000.00"
              />
              <DistanceHint livePrice={livePrice} targetPrice={targetPrice} condition={condition} t={t} />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={submitting || symbolsLoading}>
                {submitting ? t("common.loading") : t("priceAlerts.create")}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
