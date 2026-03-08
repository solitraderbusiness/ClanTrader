/**
 * Risk classification and readiness signals for launch control.
 * Detects patterns that threaten ship safety.
 */

import type { Task, DigestContext, DigestMode, DependencyGraph } from "./types";
import { VERIFICATION_DEBT_STATUSES } from "./types";
import { isDone, esc } from "./helpers";
import { daysBetween } from "./scoring";

// ─── Mode detection ───

export function detectMode(tasks: Task[]): DigestMode {
  const openBlockers = tasks.filter((t) => t.isLaunchBlocker && !isDone(t));
  return openBlockers.length > 0 ? "LAUNCH_GATE" : "STANDARD";
}

// ─── Risk alert types ───

export interface RiskAlert {
  text: string;
  severity: number; // higher = more urgent
  category: string;
}

// ─── Build all risk alerts, return top N ───

export function detectRisks(ctx: DigestContext, maxAlerts: number = 2): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const { tasks, now } = ctx;
  const open = tasks.filter((t) => !isDone(t));

  // A) Launch blocker still open
  const openBlockers = open.filter((t) => t.isLaunchBlocker);
  if (openBlockers.length > 0 && ctx.mode === "LAUNCH_GATE") {
    const critBlockers = openBlockers.filter((t) => t.priority === "CRITICAL");
    if (critBlockers.length > 0) {
      alerts.push({
        text: `${critBlockers.length} CRITICAL blocker${critBlockers.length > 1 ? "s" : ""} open`,
        severity: 100,
        category: "blocker",
      });
    }
  }

  // B) Critical item not started
  const critNotStarted = open.filter(
    (t) => t.priority === "CRITICAL" && t.column !== "IN_PROGRESS" && t.column !== "TESTING"
  );
  for (const t of critNotStarted.slice(0, 1)) {
    alerts.push({
      text: `${esc(t.title)} is CRITICAL but not started`,
      severity: 90,
      category: "critical_untouched",
    });
  }

  // C) In-progress item stale for N days
  const staleWIP = open.filter((t) => {
    if (t.column !== "IN_PROGRESS" || !t.startedAt) return false;
    return daysBetween(t.startedAt, now) >= 5;
  });
  if (staleWIP.length > 0) {
    const worst = staleWIP.sort((a, b) =>
      daysBetween(a.startedAt!, now) - daysBetween(b.startedAt!, now)
    ).reverse()[0];
    const days = daysBetween(worst.startedAt!, now);
    alerts.push({
      text: `${esc(worst.title)} stuck ${days} days in progress`,
      severity: 70 + days,
      category: "stale_wip",
    });
  }

  // D) Implemented but not verified (verification debt)
  const verDebt = open.filter(
    (t) => t.pmStatus && VERIFICATION_DEBT_STATUSES.includes(t.pmStatus) && t.isLaunchBlocker
  );
  if (verDebt.length >= 2) {
    alerts.push({
      text: `${verDebt.length} blockers built but not verified`,
      severity: 80,
      category: "verification_debt",
    });
  }

  // F) Testing pile-up
  const testingCount = open.filter((t) => t.column === "TESTING").length;
  if (testingCount >= 3) {
    alerts.push({
      text: `${testingCount} tasks piling up in TESTING`,
      severity: 60,
      category: "testing_pileup",
    });
  }

  // G) Missing owner on important items
  const unowned = open.filter((t) => !t.owner && (t.isLaunchBlocker || t.priority === "CRITICAL"));
  if (unowned.length > 0) {
    alerts.push({
      text: `${unowned.length} important item${unowned.length > 1 ? "s" : ""} without owner`,
      severity: 55,
      category: "missing_owner",
    });
  }

  // L) Dependency bottleneck — one item blocking many
  const bottlenecks = findBottlenecks(ctx.depGraph, tasks);
  if (bottlenecks.length > 0) {
    const top = bottlenecks[0];
    alerts.push({
      text: `${esc(top.task.title)} blocks ${top.downstreamCount} items`,
      severity: 65 + top.downstreamCount * 5,
      category: "dependency_bottleneck",
    });
  }

  return alerts
    .sort((a, b) => b.severity - a.severity)
    .slice(0, maxAlerts);
}

// ─── Verification debt analysis ───

export interface VerificationDebtSummary {
  totalDebt: number;
  blockerDebt: number;
  items: { title: string; pmStatus: string; isBlocker: boolean }[];
}

export function computeVerificationDebt(tasks: Task[]): VerificationDebtSummary {
  const open = tasks.filter((t) => !isDone(t));
  const debtItems = open.filter(
    (t) => t.pmStatus && VERIFICATION_DEBT_STATUSES.includes(t.pmStatus)
  );

  return {
    totalDebt: debtItems.length,
    blockerDebt: debtItems.filter((t) => t.isLaunchBlocker).length,
    items: debtItems.map((t) => ({
      title: t.title,
      pmStatus: t.pmStatus!,
      isBlocker: t.isLaunchBlocker,
    })),
  };
}

// ─── Stale WIP detection ───

export function countStaleInProgress(tasks: Task[], now: Date, thresholdDays: number = 4): number {
  return tasks.filter((t) => {
    if (isDone(t) || t.column !== "IN_PROGRESS" || !t.startedAt) return false;
    return daysBetween(t.startedAt, now) >= thresholdDays;
  }).length;
}

// ─── Dependency graph builder ───

export function buildDependencyGraph(tasks: Task[]): DependencyGraph {
  const downstream = new Map<string, Set<string>>();
  const upstream = new Map<string, Set<string>>();

  for (const task of tasks) {
    if (!task.key) continue;

    const deps = parseDependencies(task.dependencies);
    if (deps.length === 0) continue;

    // This task depends on `deps` → it's downstream of each dep
    upstream.set(task.key, new Set(deps));

    for (const depKey of deps) {
      if (!downstream.has(depKey)) downstream.set(depKey, new Set());
      downstream.get(depKey)!.add(task.key);
    }
  }

  return { downstream, upstream };
}

function parseDependencies(deps: unknown): string[] {
  if (!deps) return [];
  if (Array.isArray(deps)) return deps.filter((d): d is string => typeof d === "string");
  return [];
}

// ─── Bottleneck detection ───

interface Bottleneck {
  task: Task;
  downstreamCount: number;
}

function findBottlenecks(graph: DependencyGraph, tasks: Task[]): Bottleneck[] {
  const keyToTask = new Map(tasks.filter((t) => t.key).map((t) => [t.key!, t]));
  const results: Bottleneck[] = [];

  for (const [key, downstreamSet] of graph.downstream) {
    const task = keyToTask.get(key);
    if (!task || isDone(task)) continue;
    if (downstreamSet.size >= 2) {
      results.push({ task, downstreamCount: downstreamSet.size });
    }
  }

  return results.sort((a, b) => b.downstreamCount - a.downstreamCount);
}
