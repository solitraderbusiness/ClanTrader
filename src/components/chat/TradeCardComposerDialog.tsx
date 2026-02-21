"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSocket } from "@/lib/socket-client";
import {
  SOCKET_EVENTS,
  TRADE_TIMEFRAMES,
  COMMON_INSTRUMENTS,
} from "@/lib/chat-constants";
import { toast } from "sonner";

interface TradeCardComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clanId: string;
  topicId: string;
}

export function TradeCardComposerDialog({
  open,
  onOpenChange,
  clanId,
  topicId,
}: TradeCardComposerDialogProps) {
  const [instrument, setInstrument] = useState("");
  const [direction, setDirection] = useState<"LONG" | "SHORT">("LONG");
  const [entry, setEntry] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [tp, setTp] = useState("");
  const [timeframe, setTimeframe] = useState("H1");
  const [riskPct, setRiskPct] = useState("");
  const [note, setNote] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  function addTag() {
    const tag = tagInput.trim();
    if (tag && tags.length < 5 && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function resetForm() {
    setInstrument("");
    setDirection("LONG");
    setEntry("");
    setStopLoss("");
    setTp("");
    setTimeframe("H1");
    setRiskPct("");
    setNote("");
    setTags([]);
    setTagInput("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!topicId) {
      toast.error("No topic selected. Please select a topic first.");
      return;
    }

    if (!instrument.trim() || !entry || !stopLoss || !tp) {
      toast.error("Please fill in required fields");
      return;
    }

    const entryNum = parseFloat(entry);
    const slNum = parseFloat(stopLoss);
    const tpNum = parseFloat(tp);

    if (isNaN(entryNum) || isNaN(slNum) || isNaN(tpNum)) {
      toast.error("Price values must be valid numbers");
      return;
    }

    // Price ordering validation
    if (direction === "LONG") {
      if (slNum >= entryNum) {
        toast.error("LONG: stop loss must be below entry");
        return;
      }
      if (tpNum <= entryNum) {
        toast.error("LONG: target must be above entry");
        return;
      }
    } else {
      if (slNum <= entryNum) {
        toast.error("SHORT: stop loss must be above entry");
        return;
      }
      if (tpNum >= entryNum) {
        toast.error("SHORT: target must be below entry");
        return;
      }
    }

    const targets = [tpNum];

    setLoading(true);
    const socket = getSocket();

    if (!socket.connected) {
      toast.error("Not connected to chat. Please wait and try again.");
      setLoading(false);
      return;
    }

    const data = {
      clanId,
      topicId,
      instrument: instrument.trim().toUpperCase(),
      direction,
      entry: entryNum,
      stopLoss: slNum,
      targets,
      timeframe,
      ...(riskPct ? { riskPct: parseFloat(riskPct) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(tags.length > 0 ? { tags } : {}),
    };

    socket.emit(SOCKET_EVENTS.SEND_TRADE_CARD, data);
    resetForm();
    onOpenChange(false);
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Trade Card</DialogTitle>
          <DialogDescription>
            Share a structured trade idea with the clan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Instrument */}
          <div className="space-y-2">
            <Label>Instrument *</Label>
            <div className="flex gap-2">
              <Input
                value={instrument}
                onChange={(e) => setInstrument(e.target.value)}
                placeholder="e.g. XAUUSD"
                className="flex-1"
                required
              />
              <Select
                value=""
                onValueChange={(val) => setInstrument(val)}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Quick" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_INSTRUMENTS.map((inst) => (
                    <SelectItem key={inst} value={inst}>
                      {inst}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Direction */}
          <div className="space-y-2">
            <Label>Direction *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === "LONG" ? "default" : "outline"}
                className={direction === "LONG" ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={() => setDirection("LONG")}
              >
                LONG
              </Button>
              <Button
                type="button"
                variant={direction === "SHORT" ? "default" : "outline"}
                className={direction === "SHORT" ? "bg-red-600 hover:bg-red-700" : ""}
                onClick={() => setDirection("SHORT")}
              >
                SHORT
              </Button>
            </div>
          </div>

          {/* Price Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Entry *</Label>
              <Input
                type="number"
                step="any"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Stop Loss *</Label>
              <Input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Target *</Label>
              <Input
                type="number"
                step="any"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Timeframe + Risk */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Timeframe *</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRADE_TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf} value={tf}>
                      {tf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Risk %</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={riskPct}
                onChange={(e) => setRiskPct(e.target.value)}
                placeholder="e.g. 2"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                maxLength={30}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTag} disabled={tags.length >= 5}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} &times;
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Analysis notes..."
              maxLength={500}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Share Trade"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
