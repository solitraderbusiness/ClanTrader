"use client";

import { useTranslation } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface Props {
  clans: { id: string; name: string }[];
  clanId: string;
  onClanChange: (v: string) => void;
  trackedOnly: boolean;
  onTrackedChange: (v: boolean) => void;
  period: string;
  onPeriodChange: (v: string) => void;
}

export function PeriodSelector({
  clans,
  clanId,
  onClanChange,
  trackedOnly,
  onTrackedChange,
  period,
  onPeriodChange,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Track toggle */}
      <div className="flex items-center gap-2">
        <Switch
          id="tracked-toggle"
          checked={trackedOnly}
          onCheckedChange={onTrackedChange}
        />
        <Label htmlFor="tracked-toggle" className="text-xs whitespace-nowrap">
          {trackedOnly ? t("journal.trackedOnly") : t("journal.allTrades")}
        </Label>
      </div>

      {/* Clan selector */}
      {clans.length > 0 && (
        <Select
          value={clanId || "__all__"}
          onValueChange={(v) => onClanChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger size="sm" className="min-w-[120px]">
            <SelectValue placeholder={t("journal.allClans")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("journal.allClans")}</SelectItem>
            {clans.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Period selector */}
      <Select value={period} onValueChange={onPeriodChange}>
        <SelectTrigger size="sm" className="min-w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("journal.allTime")}</SelectItem>
          <SelectItem value="month">{t("journal.thisMonth")}</SelectItem>
          <SelectItem value="3months">{t("journal.last3Months")}</SelectItem>
          <SelectItem value="6months">{t("journal.last6Months")}</SelectItem>
          <SelectItem value="year">{t("journal.thisYear")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
