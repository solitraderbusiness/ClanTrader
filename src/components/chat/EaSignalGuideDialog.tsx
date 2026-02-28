"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BarChart3, Download, MonitorSmartphone, Zap } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface EaSignalGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EaSignalGuideDialog({ open, onOpenChange }: EaSignalGuideDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {t("guide.title")}
          </DialogTitle>
          <DialogDescription>
            {t("guide.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                1
              </span>
              <div>
                <p className="font-medium">{t("guide.step1Title")}</p>
                <p className="text-muted-foreground">
                  {t("guide.step1Desc")}
                </p>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href="/settings/mt-accounts">
                    <MonitorSmartphone className="me-1 h-3 w-3" />
                    {t("guide.step1Cta")}
                  </Link>
                </Button>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                2
              </span>
              <div>
                <p className="font-medium">{t("guide.step2Title")}</p>
                <p className="text-muted-foreground">
                  {t("guide.step2Desc")}
                </p>
                <Button variant="link" className="h-auto p-0 text-xs" asChild>
                  <Link href="/download">
                    <Download className="me-1 h-3 w-3" />
                    {t("guide.step2Cta")}
                  </Link>
                </Button>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                3
              </span>
              <div>
                <p className="font-medium">{t("guide.step3Title")}</p>
                <p className="text-muted-foreground">
                  {t("guide.step3Desc")}
                </p>
              </div>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                4
              </span>
              <div>
                <p className="font-medium">{t("guide.step4Title")}</p>
                <p className="text-muted-foreground">
                  {t("guide.step4Desc")}
                </p>
              </div>
            </li>
          </ol>

          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Zap className="h-3.5 w-3.5 text-yellow-500" />
              {t("guide.signalVsAnalysis")}
            </p>
            <p className="mt-1">
              Cards with both SL and TP set count as <span className="font-medium text-green-600 dark:text-green-400">{t("guide.signals")}</span> for
              competitions. Otherwise tagged as <span className="font-medium text-yellow-600 dark:text-yellow-400">{t("guide.analysis")}</span> until
              both are set.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>{t("guide.gotIt")}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
