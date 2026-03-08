/**
 * Ship-leverage scoring — prioritizes tasks by their actual impact on
 * ClanTrader's ability to ship safely, not just urgency.
 */

import type { Task, DigestContext, DependencyGraph } from "./types";
import { VERIFICATION_DEBT_STATUSES } from "./types";
import { isDone } from "./helpers";

// ─── Score weights ───

const W = {
  // Positive: things that make a task more important
  LAUNCH_BLOCKER: 150,
  MVP_BETA_MILESTONE: 40,
  UNBLOCKS_MULTIPLE: 20, // per downstream task unblocked
  DEPENDENCY_ROOT: 30, // is depended on by others but has no blockers itself
  SECURITY_INFRA_CATEGORY: 25,
  VERIFICATION_DEBT: 35, // implemented but not verified on important item
  IN_PROGRESS_RECENT: 20, // in progress and recently touched
  DUE_SOON: 30, // due within 3 days
  OVERDUE: 50,
  CRITICAL_PRIORITY: 60,
  HIGH_PRIORITY: 25,
  STALE_BLOCKER_AGING: 10, // per day stuck beyond threshold

  // Negative: things that suppress a task
  NO_OWNER: -15,
  VAGUE_NOTES: -10, // no notes or very short notes
  BLOCKED_BY_OTHERS: -40, // can't act on it yet
  STALE_IN_PROGRESS: -20, // stuck too long (diminishing returns)
  POST_LAUNCH_IN_GATE_MODE: -100,
  LOW_IMPACT_IN_GATE_MODE: -50, // IDEA/IMPROVEMENT during launch gate
} as const;

const STALE_THRESHOLD_DAYS = 4;
const HIGH_LEVERAGE_CATEGORIES = ["INFRASTRUCTURE", "MAINTENANCE", "BUG_FIX"];

// ─── Main scoring function ───

export function scoreTask(task: Task, ctx: DigestContext): number {
  if (isDone(task)) return -Infinity;

  let score = 0;

  // ── Positive signals ──

  if (task.isLaunchBlocker) score += W.LAUNCH_BLOCKER;

  if (task.milestone === "MVP_BETA") score += W.MVP_BETA_MILESTONE;

  if (task.priority === "CRITICAL") score += W.CRITICAL_PRIORITY;
  else if (task.priority === "HIGH") score += W.HIGH_PRIORITY;

  // Dependency fanout — tasks that unblock many others
  const downstreamCount = getDownstreamCount(task, ctx.depGraph);
  if (downstreamCount > 0) {
    score += W.UNBLOCKS_MULTIPLE * downstreamCount;
    // Bonus: if this task is a root (not blocked itself)
    const isBlocked = isBlockedByOpenTask(task, ctx);
    if (!isBlocked) score += W.DEPENDENCY_ROOT;
  }

  // Infrastructure / security categories
  if (HIGH_LEVERAGE_CATEGORIES.includes(task.category)) {
    score += W.SECURITY_INFRA_CATEGORY;
  }

  // Verification debt: built but not verified
  if (task.pmStatus && VERIFICATION_DEBT_STATUSES.includes(task.pmStatus) && task.isLaunchBlocker) {
    score += W.VERIFICATION_DEBT;
  }

  // In progress and recently worked on
  if (task.column === "IN_PROGRESS" && task.startedAt) {
    const daysSinceStart = daysBetween(task.startedAt, ctx.now);
    if (daysSinceStart <= STALE_THRESHOLD_DAYS) {
      score += W.IN_PROGRESS_RECENT;
    }
  }

  // Due soon (within 3 days)
  if (task.dueDate) {
    const daysUntilDue = daysBetween(ctx.now, task.dueDate);
    if (daysUntilDue < 0) {
      score += W.OVERDUE;
      // Aging overdue blocker gets worse
      if (task.isLaunchBlocker) {
        score += W.STALE_BLOCKER_AGING * Math.abs(daysUntilDue);
      }
    } else if (daysUntilDue <= 3) {
      score += W.DUE_SOON;
    }
  }

  // ── Negative signals ──

  if (!task.owner) score += W.NO_OWNER;

  if (!task.notes || task.notes.length < 10) score += W.VAGUE_NOTES;

  if (isBlockedByOpenTask(task, ctx)) score += W.BLOCKED_BY_OTHERS;

  // Stale in progress
  if (task.column === "IN_PROGRESS" && task.startedAt) {
    const daysSinceStart = daysBetween(task.startedAt, ctx.now);
    if (daysSinceStart > STALE_THRESHOLD_DAYS) {
      score += W.STALE_IN_PROGRESS;
    }
  }

  // Mode-specific suppression
  if (ctx.mode === "LAUNCH_GATE") {
    if (task.milestone === "POST_LAUNCH" || task.milestone === "PUBLIC_LAUNCH") {
      score += W.POST_LAUNCH_IN_GATE_MODE;
    }
    if ((task.category === "IDEA" || task.category === "IMPROVEMENT") && !task.isLaunchBlocker) {
      score += W.LOW_IMPACT_IN_GATE_MODE;
    }
  }

  return score;
}

// ─── Top-N tasks by ship leverage ───

export function topLeverageTasks(tasks: Task[], ctx: DigestContext, n: number): Task[] {
  return tasks
    .filter((t) => !isDone(t) && t.column !== "BACKLOG")
    .map((t) => ({ task: t, score: scoreTask(t, ctx) }))
    .filter((x) => x.score > -50) // exclude heavily suppressed
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.task);
}

// ─── Helpers ───

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function getDownstreamCount(task: Task, graph: DependencyGraph): number {
  if (!task.key) return 0;
  return graph.downstream.get(task.key)?.size ?? 0;
}

function isBlockedByOpenTask(task: Task, ctx: DigestContext): boolean {
  if (!task.key) return false;
  const upstreamKeys = ctx.depGraph.upstream.get(task.key);
  if (!upstreamKeys || upstreamKeys.size === 0) return false;

  // Check if any upstream dependency is still open
  const keyToTask = new Map(ctx.tasks.filter((t) => t.key).map((t) => [t.key!, t]));
  for (const depKey of upstreamKeys) {
    const depTask = keyToTask.get(depKey);
    if (depTask && !isDone(depTask)) return true;
  }
  return false;
}

// ─── Exported scoring weights for tests ───
export { W as SCORING_WEIGHTS, STALE_THRESHOLD_DAYS };
