"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Loader2,
  Minus,
  Plus,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InstrumentRow {
  instrument: string;
  price: number | null;
  priceTs: number | null;
  trades: number;
  open: number;
  wins: number;
  losses: number;
  be: number;
  winRate: number;
  avgRR: number;
  longs: number;
  shorts: number;
  lastTradeAt: string | null;
  isStarred: boolean;
}

interface WatchlistSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clanId: string;
}

function formatPrice(price: number): string {
  // Forex pairs typically need 4-5 decimal places, metals/indices fewer
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  return price.toFixed(5);
}

function PriceStaleDot({ ts, now }: { ts: number | null; now: number }) {
  if (!ts) return null;
  const age = now - ts;
  const color =
    age < 60_000
      ? "bg-emerald-500"
      : age < 300_000
        ? "bg-yellow-500"
        : "bg-muted-foreground/40";

  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full", color)}
      title={
        age < 60_000
          ? "Live (<1m)"
          : age < 300_000
            ? "Recent (<5m)"
            : "Stale"
      }
    />
  );
}

function DirectionBias({
  longs,
  shorts,
}: {
  longs: number;
  shorts: number;
}) {
  const total = longs + shorts;
  if (total === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;

  const longPct = Math.round((longs / total) * 100);
  if (longPct > 50) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-emerald-500">
        <ArrowUp className="h-3 w-3" />
        {longPct}%
      </span>
    );
  }
  if (longPct < 50) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-red-500">
        <ArrowDown className="h-3 w-3" />
        {100 - longPct}%
      </span>
    );
  }
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export function WatchlistSheet({
  open,
  onOpenChange,
  clanId,
}: WatchlistSheetProps) {
  const [instruments, setInstruments] = useState<InstrumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/clans/${clanId}/watchlist`);
      if (res.ok) {
        const data = await res.json();
        setInstruments(data.instruments ?? []);
      }
    } catch {
      // silent
    }
  }, [clanId]);

  useEffect(() => {
    if (!open) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    setLoading(true);
    fetchData().finally(() => setLoading(false));

    // Poll every 30s while open, also update `now` for staleness dots
    pollRef.current = setInterval(() => {
      fetchData();
      setNow(Date.now());
    }, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, clanId, fetchData]);

  async function toggleStar(instrument: string, isStarred: boolean) {
    // Optimistic update
    setInstruments((prev) =>
      prev
        .map((r) =>
          r.instrument === instrument ? { ...r, isStarred: !isStarred } : r
        )
        .sort((a, b) => {
          if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
          return b.trades - a.trades;
        })
    );

    try {
      if (isStarred) {
        await fetch(
          `/api/clans/${clanId}/watchlist/${encodeURIComponent(instrument)}`,
          { method: "DELETE" }
        );
      } else {
        await fetch(`/api/clans/${clanId}/watchlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instrument }),
        });
      }
    } catch {
      // Revert on failure
      fetchData();
      toast.error("Failed to update watchlist");
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = addInput.trim().toUpperCase();
    if (!trimmed) return;

    // Check if already in the list
    if (instruments.some((r) => r.instrument === trimmed)) {
      // Just star it
      const existing = instruments.find((r) => r.instrument === trimmed);
      if (existing && !existing.isStarred) {
        toggleStar(trimmed, false);
      }
      setAddInput("");
      setShowAdd(false);
      return;
    }

    setAdding(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument: trimmed }),
      });

      if (res.ok) {
        // Add new starred instrument to list
        setInstruments((prev) =>
          [
            {
              instrument: trimmed,
              price: null,
              priceTs: null,
              trades: 0,
              open: 0,
              wins: 0,
              losses: 0,
              be: 0,
              winRate: 0,
              avgRR: 0,
              longs: 0,
              shorts: 0,
              lastTradeAt: null,
              isStarred: true,
            },
            ...prev,
          ].sort((a, b) => {
            if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
            return b.trades - a.trades;
          })
        );
        setAddInput("");
        setShowAdd(false);
        toast.success(`${trimmed} added`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add");
      }
    } catch {
      toast.error("Failed to add to watchlist");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base">Watchlist</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setShowAdd((v) => !v)}
            >
              {showAdd ? (
                <X className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>
        </SheetHeader>

        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="flex gap-2 border-b px-4 py-2"
          >
            <Input
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              placeholder="Add symbol (e.g. XAUUSD)"
              maxLength={20}
              className="h-8 text-sm"
              autoFocus
            />
            <Button
              type="submit"
              size="sm"
              className="h-8"
              disabled={adding || !addInput.trim()}
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
            </Button>
          </form>
        )}

        <div
          className="overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 120px)" }}
        >
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!loading && instruments.length === 0 && (
            <EmptyState
              icon={Eye}
              title="No instruments yet"
              description="Instruments from clan trades appear here automatically. You can also add symbols manually."
            />
          )}

          {!loading &&
            instruments.map((row) => (
              <div
                key={row.instrument}
                className="flex items-start gap-2 border-b px-4 py-2.5 transition-colors hover:bg-muted/50"
              >
                {/* Star */}
                <button
                  className="mt-0.5 shrink-0"
                  onClick={() => toggleStar(row.instrument, row.isStarred)}
                >
                  <Star
                    className={cn(
                      "h-3.5 w-3.5 transition-colors",
                      row.isStarred
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-muted-foreground/40 hover:text-muted-foreground"
                    )}
                  />
                </button>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Instrument + Price + Trade count */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold truncate">
                      {row.instrument}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {row.price !== null ? (
                        <>
                          <PriceStaleDot ts={row.priceTs} now={now} />
                          <span className="font-mono text-sm tabular-nums">
                            {formatPrice(row.price)}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Stats */}
                  {row.trades > 0 ? (
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <DirectionBias longs={row.longs} shorts={row.shorts} />
                      <span>
                        {row.trades} trade{row.trades !== 1 && "s"}
                        {row.open > 0 && (
                          <span className="text-emerald-500">
                            {" "}
                            ({row.open} open)
                          </span>
                        )}
                      </span>
                      {(row.wins > 0 || row.losses > 0) && (
                        <span>
                          W:
                          <span
                            className={cn(
                              row.winRate >= 50
                                ? "text-emerald-500"
                                : "text-red-500"
                            )}
                          >
                            {row.winRate}%
                          </span>
                        </span>
                      )}
                      {row.avgRR !== 0 && (
                        <span>
                          <span
                            className={cn(
                              row.avgRR > 0
                                ? "text-emerald-500"
                                : "text-red-500"
                            )}
                          >
                            {row.avgRR > 0 ? "+" : ""}
                            {row.avgRR.toFixed(1)}R
                          </span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      No trades yet
                    </p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
