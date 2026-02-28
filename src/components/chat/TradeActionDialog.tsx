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
import { useTranslation } from "@/lib/i18n";

interface TradeActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: TradeActionKey;
  onConfirm: (newValue?: string, note?: string) => void;
  mtLinked?: boolean;
}

export function TradeActionDialog({
  open,
  onOpenChange,
  actionType,
  onConfirm,
  mtLinked,
}: TradeActionDialogProps) {
  const { t } = useTranslation();
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
  const isMtExecution = mtLinked && actionType !== "ADD_NOTE";
  const isClose = actionType === "CLOSE";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t(action.labelKey)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            {t(action.descriptionKey)}
          </p>

          {isMtExecution && (
            <div className={`rounded-md border p-3 text-sm ${
              isClose
                ? "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400"
                : "border-blue-500/30 bg-blue-500/5 text-blue-600 dark:text-blue-400"
            }`}>
              {isClose
                ? t("trade.closeWarning")
                : t("trade.mtUpdateWarning")}
            </div>
          )}

          {actionType === "ADD_NOTE" && mtLinked && (
            <div className="rounded-md border border-muted p-3 text-xs text-muted-foreground">
              {t("trade.noteChatOnly")}
            </div>
          )}

          {actionType === "ADD_NOTE" && (
            <div className="space-y-2">
              <Label>{t("trade.noteLabel")}</Label>
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t("trade.addYourNote")}
                maxLength={500}
              />
            </div>
          )}

          {"inputType" in action && action.inputType === "select" && "options" in action && (
            <div className="space-y-2">
              <Label>{t(action.inputLabelKey)}</Label>
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger>
                  <SelectValue placeholder={t("trade.selectStatus")} />
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
                {t(action.inputLabelKey)}
                {isInputOptional && (
                  <span className="ms-1 text-xs text-muted-foreground">{t("common.optional")}</span>
                )}
              </Label>
              <Input
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t("trade.enterValue")}
              />
            </div>
          )}

          {"inputType" in action && action.inputType === "text" && actionType !== "ADD_NOTE" && (
            <div className="space-y-2">
              <Label>{t(action.inputLabelKey)}</Label>
              <Input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={t("trade.enterValue")}
              />
            </div>
          )}

          {actionType !== "ADD_NOTE" && (
            <div className="space-y-2">
              <Label>
                {t("trade.noteLabel")} <span className="text-xs text-muted-foreground">{t("common.optional")}</span>
              </Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("trade.optionalNote")}
                maxLength={500}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={isMtExecution && isClose ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={
              (requiresValue && !isInputOptional && !value) ||
              (actionType === "ADD_NOTE" && !value)
            }
          >
            {isMtExecution
              ? isClose
                ? t("trade.closeInMt")
                : t("trade.sendToMt")
              : t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
