"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MtAccountDetailSheet } from "@/components/profile/MtAccountDetailSheet";
import { useTranslation } from "@/lib/i18n";

interface MtAccountDisplay {
  id: string;
  accountNumber: number;
  broker: string;
  platform: string;
  accountType: string;
  balance: number;
  equity: number;
  currency: string;
  lastHeartbeat: string | null;
  connectedAt: string;
  tradeCount: number;
}

function getConnectionStatus(lastHeartbeat: string | null) {
  if (!lastHeartbeat) return { labelKey: "offline" as const, color: "bg-red-500" };
  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  const minutes = diff / 60000;
  if (minutes < 2) return { labelKey: "online" as const, color: "bg-green-500" };
  if (minutes < 5) return { labelKey: "idle" as const, color: "bg-yellow-500" };
  return { labelKey: "offline" as const, color: "bg-red-500" };
}

export function MtAccountsSection({
  accounts,
  isOwnProfile,
  userId,
}: {
  accounts: MtAccountDisplay[];
  isOwnProfile: boolean;
  userId: string;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const { t } = useTranslation();

  return (
    <div className="mt-6 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {t("settings.mtAccountsTitle")}
      </h3>
      <div className="grid gap-3">
        {accounts.map((account) => {
          const status = getConnectionStatus(account.lastHeartbeat);
          return (
            <button
              type="button"
              key={account.id}
              onClick={() => setSelectedAccountId(account.id)}
              className="rounded-lg border bg-card p-4 space-y-2 text-start transition-colors hover:bg-accent/50 cursor-pointer w-full"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{account.broker}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {account.platform}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-xs",
                      account.accountType === "LIVE"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    )}
                  >
                    {account.accountType}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={cn("h-2 w-2 rounded-full", status.color)} />
                  <span className="text-xs text-muted-foreground">
                    {t(`settings.${status.labelKey}`)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  #{isOwnProfile
                    ? account.accountNumber
                    : `***${String(account.accountNumber).slice(-3)}`}
                </span>
                <span>
                  {t("settings.balance")} {account.balance.toLocaleString()} {account.currency}
                </span>
                <span>
                  {t("settings.equity")} {account.equity.toLocaleString()} {account.currency}
                </span>
                <span>{account.tradeCount} {t("settings.trades")}</span>
              </div>
            </button>
          );
        })}
      </div>
      <MtAccountDetailSheet
        userId={userId}
        accountId={selectedAccountId}
        isOwnProfile={isOwnProfile}
        onClose={() => setSelectedAccountId(null)}
      />
    </div>
  );
}
