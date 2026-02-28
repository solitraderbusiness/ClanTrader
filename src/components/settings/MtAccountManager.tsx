"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MtAccountItem {
  id: string;
  accountNumber: number;
  broker: string;
  serverName: string | null;
  platform: string;
  accountType: string;
  balance: number;
  equity: number;
  currency: string;
  isActive: boolean;
  lastHeartbeat: string | null;
  connectedAt: string;
  tradeCount: number;
}

export function MtAccountManager({ accounts: initial }: { accounts: MtAccountItem[] }) {
  const [accounts, setAccounts] = useState(initial);
  const [newKey, setNewKey] = useState<{ accountId: string; key: string } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleRegenerate(accountId: string) {
    if (!confirm("Regenerate API key? The old key will stop working immediately.")) return;
    setLoading(accountId);
    try {
      const res = await fetch(`/api/ea/accounts/${accountId}/regenerate-key`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setNewKey({ accountId, key: data.apiKey });
    } catch {
      alert("Failed to regenerate key");
    } finally {
      setLoading(null);
    }
  }

  async function handleDisconnect(accountId: string) {
    if (!confirm("Disconnect this MT account? It will no longer sync trades.")) return;
    setLoading(accountId);
    try {
      const res = await fetch(`/api/ea/accounts/${accountId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed");
      setAccounts((prev) =>
        prev.map((a) => (a.id === accountId ? { ...a, isActive: false } : a))
      );
    } catch {
      alert("Failed to disconnect account");
    } finally {
      setLoading(null);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No MetaTrader accounts connected.</p>
        <p className="mt-1 text-sm">
          Install the ClanTrader EA on MetaTrader to connect your first account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {accounts.map((account) => (
        <div
          key={account.id}
          className={cn(
            "rounded-lg border p-4 space-y-3",
            !account.isActive && "opacity-60"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{account.broker}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                {account.platform}
              </span>
              <span className="text-sm text-muted-foreground">
                #{account.accountNumber}
              </span>
              {!account.isActive && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  Disconnected
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {account.isActive && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRegenerate(account.id)}
                    disabled={loading === account.id}
                  >
                    Regenerate Key
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDisconnect(account.id)}
                    disabled={loading === account.id}
                  >
                    Disconnect
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Balance: {account.balance.toLocaleString()} {account.currency}</span>
            <span>Equity: {account.equity.toLocaleString()} {account.currency}</span>
            <span>{account.tradeCount} trades</span>
            {account.serverName && <span>Server: {account.serverName}</span>}
          </div>

          {newKey?.accountId === account.id && (
            <div className="rounded-md bg-green-50 p-3 dark:bg-green-900/20">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                New API Key (copy now — won&apos;t be shown again):
              </p>
              <code className="mt-1 block break-all text-xs font-mono text-green-700 dark:text-green-400">
                {newKey.key}
              </code>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
