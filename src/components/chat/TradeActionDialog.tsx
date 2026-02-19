"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TRADE_ACTIONS, type TradeActionKey } from "@/lib/trade-action-constants";

interface TradeActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: TradeActionKey;
  onConfirm: (newValue?: string, note?: string) => void;
}

export function TradeActionDialog({
  open,
  onOpenChange,
  actionType,
  onConfirm,
}: TradeActionDialogProps) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  const action = TRADE_ACTIONS[actionType];

  function handleConfirm() {
    if (actionType === "ADD_NOTE") {
      onConfirm(undefined, value);
    } else {
      onConfirm(value || undefined, note || undefined);
    }
    setValue("");
    setNote("");
    onOpenChange(false);
  }

  const requiresValue = action.requiresInput && actionType !== "ADD_NOTE";
  const isInputOptional = "inputOptional" in action && action.inputOptional;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{action.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {action.description}
          </p>

          {actionType === "ADD_NOTE" && (
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Add your note..."
                maxLength={500}
              />
            </div>
          )}

          {"inputType" in action && action.inputType === "select" && "options" in action && (
            <div className="space-y-2">
              <Label>{action.inputLabel}</Label>
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  {action.options.map((opt: string) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {"inputType" in action && action.inputType === "number" && (
            <div className="space-y-2">
              <Label>
                {action.inputLabel}
                {isInputOptional && (
                  <span className="ms-1 text-xs text-muted-foreground">(optional)</span>
                )}
              </Label>
              <Input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value..."
              />
            </div>
          )}

          {"inputType" in action && action.inputType === "text" && actionType !== "ADD_NOTE" && (
            <div className="space-y-2">
              <Label>{action.inputLabel}</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter value..."
              />
            </div>
          )}

          {actionType !== "ADD_NOTE" && (
            <div className="space-y-2">
              <Label>
                Note <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note..."
                maxLength={500}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              (requiresValue && !isInputOptional && !value) ||
              (actionType === "ADD_NOTE" && !value)
            }
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
