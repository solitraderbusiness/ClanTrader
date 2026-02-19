"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { Eye, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface WatchlistItem {
  id: string;
  instrument: string;
  addedAt: string;
}

interface WatchlistSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clanId: string;
}

export function WatchlistSheet({
  open,
  onOpenChange,
  clanId,
}: WatchlistSheetProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [instrument, setInstrument] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function fetch_() {
      setLoading(true);
      try {
        const res = await fetch(`/api/clans/${clanId}/watchlist`);
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }

    fetch_();
  }, [open, clanId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = instrument.trim().toUpperCase();
    if (!trimmed) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/clans/${clanId}/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrument: trimmed }),
      });

      if (res.ok) {
        const data = await res.json();
        setItems((prev) => [data.item, ...prev]);
        setInstrument("");
        toast.success(`${trimmed} added to watchlist`);
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

  async function handleRemove(inst: string) {
    try {
      const res = await fetch(
        `/api/clans/${clanId}/watchlist/${encodeURIComponent(inst)}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.instrument !== inst));
        toast.success(`${inst} removed from watchlist`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove");
      }
    } catch {
      toast.error("Failed to remove from watchlist");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Watchlist</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <Input
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            placeholder="Add instrument (e.g. XAUUSD)"
            maxLength={20}
          />
          <Button type="submit" disabled={adding || !instrument.trim()}>
            {adding ? "..." : "Add"}
          </Button>
        </form>

        <div className="mt-4 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!loading && items.length === 0 && (
            <EmptyState
              icon={Eye}
              title="Watchlist empty"
              description="Add instruments to track them."
            />
          )}

          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div>
                <p className="font-mono font-medium">{item.instrument}</p>
                <p className="text-xs text-muted-foreground">
                  Added {new Date(item.addedAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive"
                onClick={() => handleRemove(item.instrument)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
