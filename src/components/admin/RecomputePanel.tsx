"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface RecomputeProgress {
  total: number;
  processed: number;
  errors: number;
  status: "running" | "completed" | "failed";
}

export function RecomputePanel() {
  const [userId, setUserId] = useState("");
  const [badgeId, setBadgeId] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<RecomputeProgress | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  async function recompute(scope: "user" | "badge" | "all") {
    const targetId = scope === "user" ? userId : scope === "badge" ? badgeId : undefined;

    if ((scope === "user" && !userId.trim()) || (scope === "badge" && !badgeId.trim())) {
      toast.error("Please enter an ID");
      return;
    }

    setLoading(scope);
    try {
      const res = await fetch("/api/admin/badges/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, targetId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Recompute failed");
      }

      const data = await res.json();

      if (scope === "all" && data.jobId) {
        setJobId(data.jobId);
        setProgress({ total: 0, processed: 0, errors: 0, status: "running" });
        pollProgress(data.jobId);
      } else {
        toast.success("Recompute complete");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Recompute failed");
    } finally {
      setLoading(null);
    }
  }

  function pollProgress(jid: string) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/badges/recompute?jobId=${jid}`);
        if (!res.ok) return;
        const data: RecomputeProgress = await res.json();
        setProgress(data);
        if (data.status !== "running") {
          if (intervalRef.current) clearInterval(intervalRef.current);
          toast.success(
            `Recompute ${data.status}: ${data.processed} processed, ${data.errors} errors`
          );
        }
      } catch {
        // Retry on next interval
      }
    }, 2000);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {/* User Recompute */}
      <Card>
        <CardHeader className="space-y-3 pb-4">
          <CardTitle className="text-sm">Recompute User</CardTitle>
          <div className="space-y-2">
            <Label className="text-xs">User ID</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="cuid..."
              className="text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={() => recompute("user")}
            disabled={loading === "user"}
          >
            <RefreshCw className="me-2 h-3 w-3" />
            {loading === "user" ? "Running..." : "Recompute"}
          </Button>
        </CardHeader>
      </Card>

      {/* Badge Recompute */}
      <Card>
        <CardHeader className="space-y-3 pb-4">
          <CardTitle className="text-sm">Recompute Badge</CardTitle>
          <div className="space-y-2">
            <Label className="text-xs">Badge ID</Label>
            <Input
              value={badgeId}
              onChange={(e) => setBadgeId(e.target.value)}
              placeholder="cuid..."
              className="text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={() => recompute("badge")}
            disabled={loading === "badge"}
          >
            <RefreshCw className="me-2 h-3 w-3" />
            {loading === "badge" ? "Running..." : "Recompute"}
          </Button>
        </CardHeader>
      </Card>

      {/* Global Recompute */}
      <Card className="border-amber-200 dark:border-amber-900">
        <CardHeader className="space-y-3 pb-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Global Recompute
          </CardTitle>
          <p className="text-[10px] text-muted-foreground">
            Re-evaluates all badges for all users with trades. This may take a
            while.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => recompute("all")}
            disabled={loading === "all" || progress?.status === "running"}
          >
            <RefreshCw className="me-2 h-3 w-3" />
            {loading === "all" ? "Starting..." : "Recompute All"}
          </Button>
        </CardHeader>
      </Card>

      {/* Progress */}
      {progress && jobId && (
        <div className="sm:col-span-3 rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              Job: {progress.status}
            </span>
            <span className="text-muted-foreground">
              {progress.processed}/{progress.total}{" "}
              {progress.errors > 0 && (
                <span className="text-destructive">
                  ({progress.errors} errors)
                </span>
              )}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width:
                  progress.total > 0
                    ? `${(progress.processed / progress.total) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
