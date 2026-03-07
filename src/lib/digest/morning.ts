import type { Task, DigestContext } from "./types";
import {
  isDone, bar, buildContext, topTasks, standupNarrative,
  focusLabel, launchCountdown, buildNudges, currentPhase,
  PHASE_NAMES,
} from "./helpers";

export function buildMorningDigest(tasks: Task[], now: Date): string {
  const ctx = buildContext(tasks, now);
  const sections = [
    headerSection(ctx),
    standupSection(ctx),
    focusSection(ctx),
    launchSection(ctx),
    nudgeSection(ctx),
    progressSection(ctx),
    footerSection(),
  ];
  return sections.filter(Boolean).join("\n\n");
}

function headerSection(ctx: DigestContext): string {
  const dayName = ctx.now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = ctx.now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `☀️ <b>${dayName}, ${monthDay}</b>`;
}

function standupSection(ctx: DigestContext): string {
  const { tasks, yesterdayStart, todayStart } = ctx;
  const yesterdayDone = tasks.filter(
    (t) => isDone(t) && t.completedAt && t.completedAt >= yesterdayStart && t.completedAt < todayStart
  );
  const narrative = standupNarrative(yesterdayDone);
  return narrative;
}

function focusSection(ctx: DigestContext): string | null {
  const top3 = topTasks(ctx.tasks, ctx, 3);
  if (top3.length === 0) return null;

  const lines = ["📋 <b>Today's Focus</b>"];
  top3.forEach((t, i) => {
    lines.push(`  ${i + 1}. ${focusLabel(t, ctx)}`);
  });

  return lines.join("\n");
}

function launchSection(ctx: DigestContext): string | null {
  return launchCountdown(ctx.tasks, ctx.now);
}

function nudgeSection(ctx: DigestContext): string | null {
  return buildNudges(ctx);
}

function progressSection(ctx: DigestContext): string {
  const { tasks, now } = ctx;
  const total = tasks.length;
  const done = tasks.filter(isDone).length;

  const phase = currentPhase(tasks);
  const phaseTasks = tasks.filter((t) => t.phase === phase);
  const phaseDone = phaseTasks.filter(isDone).length;

  const velocity7d = tasks.filter(
    (t) => isDone(t) && t.completedAt && t.completedAt >= new Date(now.getTime() - 7 * 86400000)
  ).length;

  const lines: string[] = [];
  lines.push(`<b>${phase} ${PHASE_NAMES[phase] || phase}</b> ${bar(phaseDone, phaseTasks.length)}`);
  lines.push(`Overall ${bar(done, total)} (${done}/${total})`);
  lines.push(`⚡ ${velocity7d} this week`);
  return lines.join("\n");
}

function footerSection(): string {
  return `<a href="https://clantrader.com/admin/kanban">→ Open Board</a>`;
}
