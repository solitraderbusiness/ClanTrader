import type { Task } from "./types";
import type { StreakData } from "./types";
import { isDone, esc, buildContext, topTasks, sparkline } from "./helpers";

export function buildEveningDigest(tasks: Task[], now: Date, streak: StreakData | null): string {
  const ctx = buildContext(tasks, now);
  const sections = [
    headerSection(now),
    resultsSection(tasks, ctx.todayStart, ctx.tomorrowStart),
    carriedOverSection(tasks),
    streakSection(streak),
    tomorrowSection(tasks, now),
    footerSection(),
  ];
  return sections.filter(Boolean).join("\n\n");
}

function headerSection(now: Date): string {
  const monthDay = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `🌙 <b>End of Day — ${monthDay}</b>`;
}

function resultsSection(tasks: Task[], todayStart: Date, tomorrowStart: Date): string {
  const todayDone = tasks.filter(
    (t) => isDone(t) && t.completedAt && t.completedAt >= todayStart && t.completedAt < tomorrowStart
  );

  if (todayDone.length === 0) return "No tasks completed today";

  const lines = [`✅ <b>${todayDone.length} task${todayDone.length > 1 ? "s" : ""} shipped</b>`];
  const show = todayDone.slice(0, 5);
  for (const t of show) {
    lines.push(`  • ${esc(t.title)}`);
  }
  if (todayDone.length > 5) {
    lines.push(`  +${todayDone.length - 5} more`);
  }
  return lines.join("\n");
}

function carriedOverSection(tasks: Task[]): string | null {
  const carried = tasks.filter((t) => t.column === "IN_PROGRESS").length;
  if (carried === 0) return null;
  return `📦 ${carried} carried over to tomorrow`;
}

function streakSection(streak: StreakData | null): string | null {
  if (!streak || streak.current === 0) return null;

  const lines: string[] = [];
  lines.push(`🔥 <b>${streak.current} day streak!</b> (best: ${streak.longest})`);
  if (streak.history.length > 0) {
    const avg = streak.history.reduce((a, b) => a + b, 0) / streak.history.length;
    lines.push(`   ${sparkline(streak.history)} avg ${avg.toFixed(1)}/day`);
  }
  return lines.join("\n");
}

function tomorrowSection(tasks: Task[], now: Date): string | null {
  // Build context for tomorrow to score tasks
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const ctx = buildContext(tasks, tomorrow);
  const top3 = topTasks(tasks, ctx, 3);
  if (top3.length === 0) return null;

  const titles = top3.map((t) => esc(t.title)).join(", ");
  return `Tomorrow: ${titles}`;
}

function footerSection(): string {
  return `<a href="https://clantrader.com/admin/kanban">→ Open Board</a>`;
}
