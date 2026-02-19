#!/usr/bin/env tsx
/**
 * ClanTrader Test Worker CLI
 *
 * Runs on your local machine. Polls the server for queued test runs,
 * executes Playwright locally, and uploads the report back.
 *
 * Usage:
 *   TEST_WORKER_TOKEN=<token> SERVER_URL=<url> npx tsx scripts/test-worker.ts
 *
 * Environment variables:
 *   SERVER_URL        - Base URL of the ClanTrader server (default: http://localhost:3000)
 *   TEST_WORKER_TOKEN - API token for authenticating with the server (required)
 *   MAX_LOCAL_WORKERS - Safety cap on local parallelism (default: 4)
 *   POLL_INTERVAL_MS  - How often to poll for jobs (default: 5000)
 */

import { execSync } from "child_process";
import { readFileSync, existsSync, statSync } from "fs";
import { hostname as getHostname } from "os";
import path from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const TOKEN = process.env.TEST_WORKER_TOKEN;
const MAX_LOCAL_WORKERS = parseInt(process.env.MAX_LOCAL_WORKERS || "4");
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "5000");
const HOSTNAME = getHostname();

if (!TOKEN) {
  console.error("ERROR: TEST_WORKER_TOKEN environment variable is required.");
  console.error("Set it in your .env or export it before running this script.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function api(endpoint: string, init?: RequestInit) {
  return fetch(`${SERVER_URL}${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function apiJson<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const res = await api(endpoint, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
interface TestRun {
  id: string;
  suite: string;
  effectiveWorkers: number;
  runMode: string;
  options: { slowMo?: number; video?: boolean; trace?: boolean } | null;
}

const SUITE_MAP: Record<string, string> = {
  SMOKE: "smoke",
  FULL_E2E: "full-e2e",
  SIMULATOR: "simulator",
};

async function claimJob(): Promise<TestRun | null> {
  const data = await apiJson<{ run: TestRun | null }>(
    "/api/admin/test-runs/worker/claim",
    {
      method: "POST",
      body: JSON.stringify({ hostname: HOSTNAME }),
    }
  );
  return data.run;
}

async function updateStatus(
  runId: string,
  body: Record<string, unknown>
): Promise<void> {
  await api(`/api/admin/test-runs/worker/${runId}/status`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

async function uploadReport(runId: string, zipPath: string): Promise<string> {
  const fileBuffer = readFileSync(zipPath);
  const blob = new Blob([fileBuffer], { type: "application/zip" });

  const formData = new FormData();
  formData.append("report", blob, "report.zip");

  const res = await fetch(
    `${SERVER_URL}/api/admin/test-runs/worker/${runId}/artifacts`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: formData,
    }
  );

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = (await res.json()) as { reportUrl: string };
  return data.reportUrl;
}

async function executeRun(run: TestRun): Promise<void> {
  log(`Executing: ${run.suite} | ${run.runMode} | ${run.effectiveWorkers}w`);

  // Update status to RUNNING
  await updateStatus(run.id, { status: "RUNNING" });

  const projectName = SUITE_MAP[run.suite] || "smoke";
  const isHeaded = run.runMode === "HEADED";

  // Defense-in-depth: clamp workers locally
  let workers = run.effectiveWorkers;
  workers = Math.min(workers, MAX_LOCAL_WORKERS);
  if (isHeaded) workers = Math.min(workers, 2);

  // Build env vars for Playwright
  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    TEST_RUN_MODE: run.runMode,
    TEST_WORKERS: String(workers),
    TEST_BASE_URL: process.env.TEST_BASE_URL || SERVER_URL,
  };

  if (isHeaded && run.options?.slowMo) {
    env.TEST_SLOW_MO = String(run.options.slowMo);
  }
  if (run.options?.video) env.TEST_VIDEO = "true";
  if (run.options?.trace) env.TEST_TRACE = "true";

  const cmd = [
    "npx",
    "playwright",
    "test",
    `--project=${projectName}`,
    `--workers=${workers}`,
    "--reporter=html,json",
  ].join(" ");

  log(`Running: ${cmd}`);
  const startTime = Date.now();

  let exitCode = 0;
  let errorMessage: string | undefined;

  try {
    execSync(cmd, {
      env,
      cwd: process.cwd(),
      stdio: "inherit",
      timeout: 10 * 60 * 1000, // 10 min max
    });
  } catch (err) {
    exitCode = 1;
    errorMessage =
      err instanceof Error ? err.message.slice(0, 2000) : "Unknown error";
    log(`Tests finished with failures`);
  }

  const durationMs = Date.now() - startTime;

  // Parse JSON results if available
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let skippedTests = 0;

  const jsonReportPath = path.join(process.cwd(), "test-results", "results.json");
  // Playwright HTML reporter outputs to playwright-report/
  // JSON reporter might output differently — try common locations
  const possibleJsonPaths = [
    jsonReportPath,
    path.join(process.cwd(), "test-results.json"),
  ];

  for (const jp of possibleJsonPaths) {
    if (existsSync(jp)) {
      try {
        const raw = JSON.parse(readFileSync(jp, "utf-8"));
        if (raw.stats) {
          totalTests = raw.stats.expected + raw.stats.unexpected + raw.stats.skipped;
          passedTests = raw.stats.expected;
          failedTests = raw.stats.unexpected;
          skippedTests = raw.stats.skipped;
        } else if (raw.suites) {
          // Walk suites to count
          function countSpecs(suites: Array<{ specs?: Array<{ tests?: Array<{ status: string }> }>; suites?: unknown[] }>) {
            for (const suite of suites) {
              for (const spec of suite.specs || []) {
                for (const t of spec.tests || []) {
                  totalTests++;
                  if (t.status === "expected") passedTests++;
                  else if (t.status === "skipped") skippedTests++;
                  else failedTests++;
                }
              }
              if (suite.suites) countSpecs(suite.suites as typeof suites);
            }
          }
          countSpecs(raw.suites);
        }
        break;
      } catch {
        // ignore parse errors
      }
    }
  }

  // Zip the HTML report
  const reportDir = path.join(process.cwd(), "playwright-report");
  const zipPath = path.join(process.cwd(), `test-report-${run.id}.zip`);
  let reportUrl: string | undefined;

  if (existsSync(reportDir) && statSync(reportDir).isDirectory()) {
    try {
      log("Zipping report...");
      execSync(`cd "${reportDir}" && zip -r "${zipPath}" .`, {
        stdio: "pipe",
        timeout: 60000,
      });

      log("Uploading report...");
      reportUrl = await uploadReport(run.id, zipPath);
      log(`Report uploaded: ${reportUrl}`);

      // Clean up local zip
      try {
        execSync(`rm -f "${zipPath}"`, { stdio: "pipe" });
      } catch {
        // ignore cleanup errors
      }
    } catch (err) {
      log(`Failed to zip/upload report: ${err}`);
    }
  }

  // Final status update
  const status = exitCode === 0 ? "PASSED" : "FAILED";
  await updateStatus(run.id, {
    status,
    totalTests,
    passedTests,
    failedTests,
    skippedTests,
    durationMs,
    ...(errorMessage ? { errorMessage } : {}),
  });

  log(`Run ${run.id} completed: ${status} (${totalTests} tests, ${durationMs}ms)`);
}

async function pollLoop(): Promise<void> {
  log(`Test Worker started on ${HOSTNAME}`);
  log(`Server: ${SERVER_URL}`);
  log(`Max local workers: ${MAX_LOCAL_WORKERS}`);
  log(`Poll interval: ${POLL_INTERVAL}ms`);
  log("Waiting for jobs...\n");

  while (true) {
    try {
      const run = await claimJob();
      if (run) {
        log(`Claimed job: ${run.id}`);
        await executeRun(run);
        log(""); // blank line between runs
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Only log non-connection errors verbosely
      if (msg.includes("fetch") || msg.includes("ECONNREFUSED")) {
        log(`Server unreachable, retrying...`);
      } else {
        log(`Error: ${msg}`);
      }
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

pollLoop().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
