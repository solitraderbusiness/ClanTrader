"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sun, Moon, ChevronDown, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface DigestRecord {
  id: string;
  type: "MORNING" | "EVENING";
  mode: "LAUNCH_GATE" | "STANDARD";
  content: string;
  metadata: Record<string, unknown> | null;
  blockerCount: number;
  verificationDebtCount: number;
  staleInProgressCount: number;
  relatedMilestone: string | null;
  focusItemIds: string[];
  sentToTelegramAt: string | null;
  sendStatus: string | null;
  createdAt: string;
}

export default function DigestsPage() {
  const { t } = useTranslation();
  const [digests, setDigests] = useState<DigestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sendingMorning, setSendingMorning] = useState(false);
  const [sendingEvening, setSendingEvening] = useState(false);

  const fetchDigests = useCallback(async (cursor?: string | null, replace = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "20");

      const res = await fetch(`/api/admin/digests?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setDigests((prev) => replace ? data.digests : [...prev, ...data.digests]);
      setNextCursor(data.nextCursor);
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, t]);

  useEffect(() => {
    fetchDigests(null, true);
  }, [fetchDigests]);

  const sendDigest = useCallback(async (type: "morning" | "evening") => {
    const setter = type === "morning" ? setSendingMorning : setSendingEvening;
    setter(true);
    try {
      const endpoint = type === "morning" ? "/api/admin/daily-digest" : "/api/admin/evening-digest";
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(`${type === "morning" ? t("admin.digestsMorning") : t("admin.digestsEvening")} ${t("admin.digestsSent")}`);
      fetchDigests(null, true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setter(false);
    }
  }, [fetchDigests, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("admin.digestsTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("admin.digestsDescription")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendDigest("morning")}
            disabled={sendingMorning}
          >
            <Sun className="h-4 w-4 me-1" />
            {sendingMorning ? t("common.loading") : t("admin.digestsSendMorning")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => sendDigest("evening")}
            disabled={sendingEvening}
          >
            <Moon className="h-4 w-4 me-1" />
            {sendingEvening ? t("common.loading") : t("admin.digestsSendEvening")}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("admin.digestsFilterAll")}</SelectItem>
            <SelectItem value="MORNING">{t("admin.digestsFilterMorning")}</SelectItem>
            <SelectItem value="EVENING">{t("admin.digestsFilterEvening")}</SelectItem>
          </SelectContent>
        </Select>
        {digests.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {digests.length} {t("admin.digestsRecords")}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {digests.map((d) => (
          <DigestCard key={d.id} digest={d} />
        ))}

        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t("common.loading")}
          </div>
        )}

        {!loading && digests.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {t("admin.digestsEmpty")}
          </div>
        )}

        {nextCursor && !loading && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchDigests(nextCursor)}
            >
              <ChevronDown className="h-4 w-4 me-1" />
              {t("admin.digestsLoadMore")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DigestCard({ digest }: { digest: DigestRecord }) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(digest.createdAt);
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const isMorning = digest.type === "MORNING";
  const isGateMode = digest.mode === "LAUNCH_GATE";

  // Strip HTML for preview
  const plainText = digest.content.replace(/<[^>]+>/g, "");
  const preview = plainText.slice(0, 120) + (plainText.length > 120 ? "..." : "");

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors cursor-pointer hover:bg-accent/30",
        isGateMode && "border-orange-500/30"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {isMorning ? (
            <Sun className="h-4 w-4 text-amber-500 flex-shrink-0" />
          ) : (
            <Moon className="h-4 w-4 text-blue-400 flex-shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{dateStr}</span>
              <span className="text-xs text-muted-foreground">{timeStr}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge variant={isGateMode ? "destructive" : "secondary"} className="text-[10px]">
            {isGateMode ? "LAUNCH GATE" : "Standard"}
          </Badge>
          {digest.sendStatus === "sent" && (
            <Send className="h-3 w-3 text-green-500" />
          )}
          {digest.blockerCount > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {digest.blockerCount} blockers
            </Badge>
          )}
        </div>
      </div>

      {!expanded && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{preview}</p>
      )}

      {expanded && (
        <div className="mt-3 space-y-3">
          <pre className="rounded bg-muted/50 p-3 whitespace-pre-wrap font-mono text-xs leading-relaxed">
            {digest.content.replace(/<[^>]*>/g, "")}
          </pre>

          <div className="flex flex-wrap gap-2 text-[10px]">
            {digest.verificationDebtCount > 0 && (
              <Badge variant="outline">{digest.verificationDebtCount} verification debt</Badge>
            )}
            {digest.staleInProgressCount > 0 && (
              <Badge variant="outline">{digest.staleInProgressCount} stale WIP</Badge>
            )}
            {digest.relatedMilestone && (
              <Badge variant="outline">{digest.relatedMilestone}</Badge>
            )}
            {digest.sendStatus && (
              <Badge variant={digest.sendStatus === "sent" ? "secondary" : "destructive"}>
                Telegram: {digest.sendStatus}
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
