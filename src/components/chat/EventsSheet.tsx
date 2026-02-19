"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Calendar, Loader2 } from "lucide-react";

interface TradingEvent {
  id: string;
  title: string;
  description: string | null;
  instrument: string | null;
  impact: string | null;
  startTime: string;
  endTime: string | null;
  source: string | null;
}

const impactColors: Record<string, string> = {
  HIGH: "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400",
  MEDIUM: "border-yellow-500 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  LOW: "border-green-500 bg-green-500/10 text-green-600 dark:text-green-400",
};

interface EventsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EventsSheet({ open, onOpenChange }: EventsSheetProps) {
  const [events, setEvents] = useState<TradingEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function fetchEvents() {
      setLoading(true);
      try {
        const res = await fetch("/api/events");
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events);
        }
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Upcoming Events</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 150px)" }}>
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!loading && events.length === 0 && (
            <EmptyState
              icon={Calendar}
              title="No upcoming events"
              description="No trading events scheduled."
            />
          )}

          {events.map((event) => (
            <div key={event.id} className="rounded-lg border p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium">{event.title}</span>
                {event.impact && (
                  <Badge
                    variant="outline"
                    className={impactColors[event.impact] || ""}
                  >
                    {event.impact}
                  </Badge>
                )}
              </div>
              {event.description && (
                <p className="mb-2 text-xs text-muted-foreground">
                  {event.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  {new Date(event.startTime).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {event.instrument && (
                  <Badge variant="secondary" className="text-[10px]">
                    {event.instrument}
                  </Badge>
                )}
                {event.source && <span>Source: {event.source}</span>}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
