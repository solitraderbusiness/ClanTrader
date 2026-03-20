"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Globe } from "lucide-react";
import { toast } from "sonner";

interface IpEntry {
  id: string;
  ip: string;
  label: string | null;
  createdAt: string;
}

export function DevLoginIpManager() {
  const [ips, setIps] = useState<IpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [myIp, setMyIp] = useState<string | null>(null);

  const fetchIps = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dev-login-ips");
      if (res.ok) {
        const data = await res.json();
        setIps(data.ips);
      }
    } catch {
      toast.error("Failed to load IPs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIps();
    // Also fetch current IP
    fetch("/api/auth/dev-login-check")
      .then((r) => r.json())
      .then((d) => setMyIp(d.ip))
      .catch(() => {});
  }, [fetchIps]);

  async function handleAdd() {
    const ip = newIp.trim();
    if (!ip) return;

    const res = await fetch("/api/admin/dev-login-ips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, label: newLabel.trim() || undefined }),
    });

    if (res.ok) {
      toast.success("IP added");
      setNewIp("");
      setNewLabel("");
      fetchIps();
    } else {
      const data = await res.json();
      toast.error(data.error || "Failed to add IP");
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/dev-login-ips?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("IP removed");
      setIps((prev) => prev.filter((e) => e.id !== id));
    }
  }

  function handleAddMyIp() {
    if (myIp) setNewIp(myIp);
  }

  if (loading) {
    return <div className="animate-pulse rounded-lg bg-muted h-32" />;
  }

  return (
    <div className="space-y-6">
      {/* Current IP notice */}
      {myIp && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <span>Your current IP: <strong className="font-mono">{myIp}</strong></span>
          {!ips.some((e) => e.ip === myIp) && (
            <Button variant="outline" size="sm" className="ms-auto" onClick={handleAddMyIp}>
              Add my IP
            </Button>
          )}
        </div>
      )}

      {/* Add form */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">IP Address</label>
          <Input
            placeholder="e.g. 209.198.131.54"
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="w-40 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Label (optional)</label>
          <Input
            placeholder="e.g. Office"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
        </div>
        <Button onClick={handleAdd} disabled={!newIp.trim()}>
          <Plus className="me-1.5 h-4 w-4" />
          Add
        </Button>
      </div>

      {/* IP list */}
      <div className="rounded-lg border divide-y">
        {ips.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No IPs configured. Quick-login buttons are hidden from everyone.
          </div>
        ) : (
          ips.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-mono text-sm font-medium">{entry.ip}</span>
                {entry.label && (
                  <span className="ms-2 text-xs text-muted-foreground">({entry.label})</span>
                )}
                {entry.ip === myIp && (
                  <span className="ms-2 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                    You
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(entry.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
