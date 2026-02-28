"use client";

import { useState } from "react";
import { getSocket } from "@/lib/socket-client";
import { SOCKET_EVENTS, TRADE_TIMEFRAMES, COMMON_INSTRUMENTS } from "@/lib/chat-constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clanId: string;
  topicId: string | null;
}

export function AnalysisCardComposerDialog({
  open,
  onOpenChange,
  clanId,
  topicId,
}: Props) {
  const { t } = useTranslation();
  const [instrument, setInstrument] = useState("");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [target, setTarget] = useState("");
  const [timeframe, setTimeframe] = useState("H1");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  function handleSubmit() {
    const entryNum = parseFloat(entry);
    if (!instrument.trim() || isNaN(entryNum) || entryNum <= 0 || !topicId) return;

    setSending(true);

    const socket = getSocket();
    socket.emit(SOCKET_EVENTS.SEND_TRADE_CARD, {
      clanId,
      topicId,
      instrument: instrument.trim().toUpperCase(),
      direction,
      entry: entryNum,
      stopLoss: parseFloat(stopLoss) || 0,
      targets: [parseFloat(target) || 0],
      timeframe,
      note: note.trim() || undefined,
      cardType: "ANALYSIS",
    });

    // Reset form
    setInstrument("");
    setDirection("LONG");
    setEntry("");
    setStopLoss("");
    setTarget("");
    setTimeframe("H1");
    setNote("");
    setSending(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            {t("trade.createAnalysis")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t("trade.analysisDisclaimer")}
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Instrument */}
          <div className="space-y-1.5">
            <Label>{t("journal.instrument")}</Label>
            <Input
              value={instrument}
              onChange={(e) => setInstrument(e.target.value)}
              placeholder="e.g. EURUSD, XAUUSD"
              list="common-instruments"
              maxLength={20}
            />
            <datalist id="common-instruments">
              {COMMON_INSTRUMENTS.map((i) => (
                <option key={i} value={i} />
              ))}
            </datalist>
          </div>

          {/* Direction */}
          <div className="space-y-1.5">
            <Label>{t("trade.direction")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === "LONG" ? "default" : "outline"}
                className={`flex-1 ${direction === "LONG" ? "bg-green-500/20 text-green-600 hover:bg-green-500/30 border border-green-500/50" : ""}`}
                onClick={() => setDirection("LONG")}
              >
                {t("trade.long")}
              </Button>
              <Button
                type="button"
                variant={direction === "SHORT" ? "default" : "outline"}
                className={`flex-1 ${direction === "SHORT" ? "bg-red-500/20 text-red-600 hover:bg-red-500/30 border border-red-500/50" : ""}`}
                onClick={() => setDirection("SHORT")}
              >
                {t("trade.short")}
              </Button>
            </div>
          </div>

          {/* Entry + SL + TP */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>{t("trade.entry")} *</Label>
              <Input
                type="number"
                step="any"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("trade.stopLoss")}</Label>
              <Input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder={t("common.optional")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("trade.target")}</Label>
              <Input
                type="number"
                step="any"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={t("common.optional")}
              />
            </div>
          </div>

          {/* Timeframe */}
          <div className="space-y-1.5">
            <Label>Timeframe</Label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRADE_TIMEFRAMES.filter((tf) => tf !== "AUTO").map((tf) => (
                  <SelectItem key={tf} value={tf}>
                    {tf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label>{t("trade.noteLabel")} {t("common.optional")}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("trade.addYourNote")}
              maxLength={500}
              rows={2}
            />
          </div>

          <Button
            data-testid="submit-analysis"
            onClick={handleSubmit}
            disabled={!instrument.trim() || !entry || isNaN(parseFloat(entry)) || parseFloat(entry) <= 0 || !topicId || sending}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            {t("trade.shareAnalysis")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
