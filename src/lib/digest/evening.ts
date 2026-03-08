/**
 * Evening Launch Control Digest
 *
 * Answers: "Did today actually move us closer to shipping?"
 */

import type { Task, DigestContext, DigestMetadata } from "./types";
import type { StreakData } from "./types";
import { isDone, esc, buildContext, sparkline } from "./helpers";
import { topLeverageTasks } from "./scoring";
import { computeVerificationDebt, countStaleInProgress } from "./classification";

export function buildEveningDigest(tasks: Task[], now: Date, streak: StreakData | null): string {
  const ctx = buildContext(tasks, now);
  const sections = [
    headerSection(ctx),
    resultsSection(ctx),
    blockerMovementSection(ctx),
    carryOverSection(ctx),
    tomorrowSection(ctx),
    streakSection(streak),
    footerSection(),
  ];
  return sections.filter(Boolean).join("\n\n");
}

export function buildEveningMetadata(tasks: Task[], now: Date, streak: StreakData | null): DigestMetadata {
  const ctx = buildContext(tasks, now);
  const open = tasks.filter((t) => !isDone(t));
  const blockerCount = open.filter((t) => t.isLaunchBlocker).length;
  const verDebt = computeVerificationDebt(tasks);
  const staleCount = countStaleInProgress(tasks, now);
  const velocity7d = tasks.filter(
    (t) => isDone(t) && t.completedAt && t.completedAt >= new Date(now.getTime() - 7 * 86400000)
  ).length;
  const focus = topLeverageTasks(tasks, ctx, 3);

  return {
    mode: ctx.mode,
    blockerCount,
    verificationDebtCount: verDebt.blockerDebt,
    staleInProgressCount: staleCount,
    velocity7d,
    focusItemIds: focus.map((t) => t.id),
    riskAlerts: [],
    milestone: "MVP_BETA",
    streak: streak ?? undefined,
  };
}

// ─── Sections ───

function headerSection(ctx: DigestContext): string {
  const monthDay = ctx.now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `<b>End of Day — ${monthDay}</b>`;
}

function resultsSection(ctx: DigestContext): string {
  const { tasks, todayStart, tomorrowStart } = ctx;
  const todayDone = tasks.filter(
    (t) => isDone(t) && t.completedAt && t.completedAt >= todayStart && t.completedAt < tomorrowStart
  );

  if (todayDone.length === 0) return "No tasks completed today.";

  // Categorize by impact
  const blockerCleared = todayDone.filter((t) => t.isLaunchBlocker);
  const verified = todayDone.filter((t) => t.pmStatus === "VERIFIED" || t.pmStatus === "HARDENED");
  const regular = todayDone.filter((t) => !t.isLaunchBlocker && t.pmStatus !== "VERIFIED" && t.pmStatus !== "HARDENED");

  const lines: string[] = [];
  lines.push(`<b>${todayDone.length} task${todayDone.length > 1 ? "s" : ""} shipped</b>`);

  if (blockerCleared.length > 0) {
    for (const t of blockerCleared.slice(0, 3)) {
      lines.push(`  ✓ ${esc(t.title)} (blocker cleared)`);
    }
  }
  if (verified.length > 0) {
    for (const t of verified.slice(0, 2)) {
      lines.push(`  ✓ ${esc(t.title)} (verified)`);
    }
  }
  const showRegular = 5 - blockerCleared.length - verified.length;
  if (showRegular > 0 && regular.length > 0) {
    for (const t of regular.slice(0, showRegular)) {
      lines.push(`  • ${esc(t.title)}`);
    }
  }
  const remaining = todayDone.length - Math.min(5, todayDone.length);
  if (remaining > 0) lines.push(`  +${remaining} more`);

  return lines.join("\n");
}

function blockerMovementSection(ctx: DigestContext): string | null {
  if (ctx.mode !== "LAUNCH_GATE") return null;

  const open = ctx.tasks.filter((t) => !isDone(t));
  const blockers = open.filter((t) => t.isLaunchBlocker);
  const verDebt = computeVerificationDebt(ctx.tasks);

  if (blockers.length === 0) return "All launch blockers cleared!";

  const parts: string[] = [];
  parts.push(`${blockers.length} blocker${blockers.length !== 1 ? "s" : ""} remain`);
  if (verDebt.blockerDebt > 0) {
    parts.push(`${verDebt.blockerDebt} awaiting verification`);
  }
  return parts.join(" · ");
}

function carryOverSection(ctx: DigestContext): string | null {
  const stale = countStaleInProgress(ctx.tasks, ctx.now);
  const inProgress = ctx.tasks.filter((t) => t.column === "IN_PROGRESS").length;
  if (inProgress === 0) return null;

  let text = `${inProgress} in progress`;
  if (stale > 0) text += ` (${stale} stale)`;
  return text;
}

function tomorrowSection(ctx: DigestContext): string | null {
  const tomorrow = new Date(ctx.now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowCtx = buildContext(ctx.tasks, tomorrow);
  const top3 = topLeverageTasks(ctx.tasks, tomorrowCtx, 3);
  if (top3.length === 0) return null;

  const titles = top3.map((t) => esc(t.title)).join(", ");
  return `Tomorrow: ${titles}`;
}

function streakSection(streak: StreakData | null): string | null {
  if (!streak || streak.current === 0) return null;

  const parts: string[] = [];
  parts.push(`${streak.current} day streak (best: ${streak.longest})`);
  if (streak.history.length > 0) {
    parts.push(sparkline(streak.history));
  }
  return parts.join(" ");
}

function footerSection(): string {
  return `<a href="https://clantrader.com/admin/kanban">→ Open Board</a>`;
}
