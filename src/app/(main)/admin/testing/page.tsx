"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/ui/info-tip";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Play,
  Square,
  Download,
  RefreshCw,
  Monitor,
  MonitorOff,
  AlertTriangle,
} from "lucide-react";

interface TestRun {
  id: string;
  suite: string;
  requestedWorkers: number;
  effectiveWorkers: number;
  runMode: string;
  status: string;
  options: { slowMo?: number; video?: boolean; trace?: boolean } | null;
  queuedById: string;
  workerHostname: string | null;
  totalTests: number | null;
  passedTests: number | null;
  failedTests: number | null;
  skippedTests: number | null;
  durationMs: number | null;
  reportUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  claimedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  CLAIMED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  RUNNING: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  PASSED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  CANCELED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const SUITE_TIPS: Record<string, string> = {
  SMOKE:
    "Quick health checks (~30 seconds). Tests basic page loads, API health endpoints, and auth flow. Run this first to make sure the app is up and running. Good for: after deployments, quick sanity checks.",
  FULL_E2E:
    "Complete user journey tests (~3-5 minutes). Tests the full flow: signup → create clan → invite member → post signal → track trade → view leaderboard. Covers all major features end-to-end. Good for: before releases, after major changes.",
  SIMULATOR:
    "Multi-user concurrent scenario tests (~5-10 minutes). Simulates multiple users interacting simultaneously — sending messages, creating trades, joining clans — to test real-time features and race conditions. Good for: stress testing, Socket.io verification.",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function TestRunnerPage() {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [suite, setSuite] = useState<string>("SMOKE");
  const [workers, setWorkers] = useState(2);
  const [runMode, setRunMode] = useState<string>("HEADLESS");
  const [slowMo, setSlowMo] = useState(0);

  const isHeaded = runMode === "HEADED";
  const maxWorkers = isHeaded ? 2 : 6;

  // Clamp workers when switching to headed
  useEffect(() => {
    if (isHeaded && workers > 2) {
      setWorkers(1);
    }
  }, [isHeaded, workers]);

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/test-runs?limit=50");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {
      // silent on poll errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, [fetchRuns]);

  async function handleStartRun() {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        suite,
        requestedWorkers: workers,
        runMode,
      };

      const options: Record<string, unknown> = {};
      if (isHeaded && slowMo > 0) options.slowMo = slowMo;
      if (Object.keys(options).length > 0) body.options = options;

      const res = await fetch("/api/admin/test-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }

      const data = await res.json();
      toast.success(
        `Test run queued: ${data.run.suite} (${data.run.effectiveWorkers} workers, ${data.run.runMode})`
      );
      fetchRuns();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to queue test run"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(runId: string) {
    try {
      const res = await fetch(`/api/admin/test-runs/${runId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      toast.success("Run canceled");
      fetchRuns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    }
  }

  const activeRuns = runs.filter((r) =>
    ["QUEUED", "CLAIMED", "RUNNING"].includes(r.status)
  );
  const historyRuns = runs.filter((r) =>
    ["PASSED", "FAILED", "CANCELED"].includes(r.status)
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Test Runner</h1>
          <Button variant="outline" size="sm" onClick={fetchRuns}>
            <RefreshCw className="me-1 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Queue E2E test runs from the admin panel. Tests run on your local
          machine via the test worker CLI — start it with{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            npm run test:worker
          </code>
          .
        </p>
      </div>

      {/* New Run Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Queue New Test Run
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Suite */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Test Suite
                <InfoTip>
                  Choose which set of tests to run. Hover each option for
                  details, or see the guide below.
                </InfoTip>
              </Label>
              <Select value={suite} onValueChange={setSuite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMOKE">Smoke Tests</SelectItem>
                  <SelectItem value="FULL_E2E">Full E2E</SelectItem>
                  <SelectItem value="SIMULATOR">Simulator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Run Mode */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Run Mode
                <InfoTip>
                  Headless runs tests invisibly in the background (faster, uses
                  less resources). Headed opens real browser windows so you can
                  watch the tests run visually.
                </InfoTip>
              </Label>
              <Select value={runMode} onValueChange={setRunMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HEADLESS">
                    <span className="flex items-center gap-1">
                      <MonitorOff className="h-3 w-3" /> Headless
                    </span>
                  </SelectItem>
                  <SelectItem value="HEADED">
                    <span className="flex items-center gap-1">
                      <Monitor className="h-3 w-3" /> Headed
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Workers */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Workers
                <InfoTip>
                  Number of parallel browser instances running tests
                  simultaneously. More workers = faster but uses more CPU/RAM.
                  Headed mode is capped at {maxWorkers} to prevent overload.
                </InfoTip>
              </Label>
              <Input
                type="number"
                min={1}
                max={maxWorkers}
                value={workers}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 1;
                  setWorkers(Math.min(v, maxWorkers));
                }}
                className="max-w-[100px]"
              />
              <p className="text-[10px] text-muted-foreground">
                Max {maxWorkers}
                {isHeaded ? " (headed limit)" : ""}
              </p>
            </div>

            {/* SlowMo (headed only) */}
            {isHeaded && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  Slow Motion
                  <InfoTip>
                    Adds a delay between each test step so you can follow what
                    the browser is doing. Only available in headed mode.
                  </InfoTip>
                </Label>
                <Select
                  value={String(slowMo)}
                  onValueChange={(v) => setSlowMo(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Off (0ms)</SelectItem>
                    <SelectItem value="50">50ms</SelectItem>
                    <SelectItem value="100">100ms</SelectItem>
                    <SelectItem value="250">250ms</SelectItem>
                    <SelectItem value="500">500ms</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isHeaded && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <p className="font-medium">Headed mode is resource-heavy</p>
                <p>
                  Browsers will be visible on your local machine. Workers are
                  capped at {maxWorkers}. Use slowMo to watch steps in real
                  time.
                </p>
              </div>
            </div>
          )}

          {/* Suite description */}
          {SUITE_TIPS[suite] && (
            <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">
                {suite === "SMOKE"
                  ? "Smoke Tests"
                  : suite === "FULL_E2E"
                    ? "Full E2E"
                    : "Simulator"}
              </p>
              <p>{SUITE_TIPS[suite]}</p>
            </div>
          )}

          <Button onClick={handleStartRun} disabled={submitting}>
            <Play className="me-1 h-4 w-4" />
            {submitting ? "Queuing..." : "Start Test Run"}
          </Button>
        </CardContent>
      </Card>

      {/* Which suite should I use? */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Which suite should I use?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-xs">
            <div className="flex gap-3">
              <Badge
                variant="outline"
                className="h-fit flex-shrink-0 font-mono"
              >
                SMOKE
              </Badge>
              <div>
                <p className="font-medium text-foreground">
                  Quick health check (~30s)
                </p>
                <p className="text-muted-foreground">
                  Tests that the app starts, pages load, login works, and APIs
                  respond. Run this after deploying or restarting the server.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge
                variant="outline"
                className="h-fit flex-shrink-0 font-mono"
              >
                FULL_E2E
              </Badge>
              <div>
                <p className="font-medium text-foreground">
                  Complete user journeys (~3-5min)
                </p>
                <p className="text-muted-foreground">
                  Tests the full flow from signup to viewing the leaderboard.
                  Covers clan creation, trade signals, statements, and more. Run
                  this before releases or after major code changes.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Badge
                variant="outline"
                className="h-fit flex-shrink-0 font-mono"
              >
                SIMULATOR
              </Badge>
              <div>
                <p className="font-medium text-foreground">
                  Multi-user stress test (~5-10min)
                </p>
                <p className="text-muted-foreground">
                  Simulates several users at once — chatting, trading, joining
                  clans — to test real-time Socket.io features and catch race
                  conditions. Run this when testing concurrent usage.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Runs */}
      {activeRuns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Active Runs ({activeRuns.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge className={STATUS_COLORS[run.status] || ""}>
                      {run.status}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">
                        {run.suite.replace("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {run.effectiveWorkers}w &middot;{" "}
                        {run.runMode === "HEADED" ? (
                          <span className="text-yellow-600">Headed</span>
                        ) : (
                          "Headless"
                        )}
                        {run.workerHostname && ` · ${run.workerHostname}`}
                        {" · "}
                        {timeAgo(run.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.status === "RUNNING" && (
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                    )}
                    {(run.status === "QUEUED" || run.status === "CLAIMED") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(run.id)}
                      >
                        <Square className="me-1 h-3 w-3" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : historyRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No completed test runs yet. Queue a run above and start the worker
              on your local machine with{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                npm run test:worker
              </code>
              .
            </p>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-start">Status</th>
                    <th className="px-3 py-2 text-start">Suite</th>
                    <th className="hidden px-3 py-2 text-start sm:table-cell">
                      Mode
                    </th>
                    <th className="hidden px-3 py-2 text-end md:table-cell">
                      Tests
                    </th>
                    <th className="hidden px-3 py-2 text-end md:table-cell">
                      Duration
                    </th>
                    <th className="px-3 py-2 text-end">When</th>
                    <th className="px-3 py-2 text-end">Report</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRuns.map((run) => (
                    <tr key={run.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Badge
                          className={`text-xs ${STATUS_COLORS[run.status] || ""}`}
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {run.suite.replace("_", " ")}
                      </td>
                      <td className="hidden px-3 py-2 sm:table-cell">
                        <span className="text-xs">
                          {run.runMode === "HEADED" ? "Headed" : "Headless"} ·{" "}
                          {run.effectiveWorkers}w
                        </span>
                      </td>
                      <td className="hidden px-3 py-2 text-end font-mono md:table-cell">
                        {run.totalTests !== null ? (
                          <span>
                            <span className="text-green-600 dark:text-green-400">
                              {run.passedTests || 0}
                            </span>
                            /
                            <span className="text-red-600 dark:text-red-400">
                              {run.failedTests || 0}
                            </span>
                            /
                            <span className="text-muted-foreground">
                              {run.totalTests}
                            </span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="hidden px-3 py-2 text-end font-mono md:table-cell">
                        {run.durationMs !== null ? (
                          formatDuration(run.durationMs)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-end text-xs text-muted-foreground">
                        {timeAgo(run.completedAt || run.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-end">
                        {run.reportUrl ? (
                          <a
                            href={run.reportUrl}
                            download
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            <Download className="h-3 w-3" />
                            Report
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
