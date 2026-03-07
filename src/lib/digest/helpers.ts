import type { Task, DigestContext } from "./types";

// ─── Constants ───
export const PHASE_NAMES: Record<string, string> = {
  W1: "Infrastructure", W2: "Auth & Mobile", W3: "Security & QA",
  W4: "Alpha Launch", W5: "Alpha Monitoring", W6: "Post-Alpha",
  W7: "Feature Sprint 1", W8: "Feature Sprint 2",
};

export const PHASES = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];

const CATEGORY_LABELS: Record<string, string> = {
  BUG: "fix", FEATURE: "feature", INFRA: "infra", DOCS: "docs",
  SECURITY: "security", PERFORMANCE: "perf", TEST: "test",
  REFACTOR: "refactor", UI: "UI", DESIGN: "design",
};

// ─── Predicates ───
export const isDone = (t: Task) => t.column === "DONE" || t.column === "BUGS_FIXED";

// ─── Formatters ───
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function bar(done: number, total: number): string {
  if (total === 0) return "░░░░░░░░░░ 0%";
  const pct = Math.round((done / total) * 100);
  const f = Math.round((done / total) * 10);
  return "█".repeat(f) + "░".repeat(10 - f) + ` ${pct}%`;
}

export function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Context builder ───
export function buildContext(tasks: Task[], now: Date): DigestContext {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  return { tasks, now, todayStart, yesterdayStart, tomorrowStart };
}

// ─── Scoring (for task prioritization) ───
export function scoreTask(t: Task, ctx: DigestContext): number {
  let score = 0;
  if (!isDone(t) && t.dueDate && t.dueDate < ctx.todayStart) score += 100; // overdue
  if (t.priority === "CRITICAL") score += 80;
  if (t.isLaunchBlocker && !isDone(t)) score += 60;
  if (!isDone(t) && t.dueDate && t.dueDate >= ctx.todayStart && t.dueDate < ctx.tomorrowStart) score += 50; // due today
  if (t.priority === "HIGH") score += 40;
  if (t.column === "IN_PROGRESS") score += 25;
  return score;
}

export function topTasks(tasks: Task[], ctx: DigestContext, n: number): Task[] {
  return tasks
    .filter((t) => !isDone(t) && t.column !== "BACKLOG")
    .map((t) => ({ task: t, score: scoreTask(t, ctx) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.task);
}

// ─── Standup narrative ───
export function standupNarrative(completedTasks: Task[]): string {
  if (completedTasks.length === 0) return "No tasks completed yesterday";

  const groups: Record<string, number> = {};
  for (const t of completedTasks) {
    const cat = t.category || "FEATURE";
    groups[cat] = (groups[cat] || 0) + 1;
  }

  const parts = Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => {
      const label = CATEGORY_LABELS[cat] || cat.toLowerCase();
      return `${count} ${label}${count > 1 ? (label === "fix" ? "es" : "s") : ""}`;
    });

  // Determine day type from largest category
  const topCat = Object.entries(groups).sort((a, b) => b[1] - a[1])[0][0];
  const dayType = topCat === "BUG" ? "Bug fix day" :
    topCat === "FEATURE" ? "Feature day" :
    topCat === "INFRA" ? "Infra day" :
    topCat === "SECURITY" ? "Security day" :
    topCat === "TEST" ? "Testing day" :
    topCat === "REFACTOR" ? "Refactor day" :
    "Productive day";

  return `${dayType} — ${parts.join(", ")}`;
}

// ─── Focus task label ───
export function focusLabel(t: Task, ctx: DigestContext): string {
  const tags: string[] = [];
  if (!isDone(t) && t.dueDate && t.dueDate < ctx.todayStart) tags.push("overdue");
  if (t.dueDate && t.dueDate >= ctx.todayStart && t.dueDate < ctx.tomorrowStart) tags.push("due today");
  if (t.column === "IN_PROGRESS") tags.push("in progress");
  if (t.priority === "CRITICAL") tags.push("CRITICAL");
  else if (t.priority === "HIGH") tags.push("HIGH");

  const suffix = tags.length > 0 ? ` (${tags.join(" · ")})` : "";
  return `${esc(t.title)}${suffix}`;
}

// ─── Launch countdown ───
export function launchCountdown(tasks: Task[], now: Date): string | null {
  const target = process.env.LAUNCH_TARGET_DATE;
  if (!target) return null;

  const launchDate = new Date(target);
  if (isNaN(launchDate.getTime())) return null;

  const daysLeft = Math.ceil((launchDate.getTime() - now.getTime()) / 86400000);
  const blockers = tasks.filter((t) => t.isLaunchBlocker && !isDone(t)).length;

  // Velocity: tasks done in last 14 days
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
  const recentDone = tasks.filter(
    (t) => isDone(t) && t.completedAt && t.completedAt >= twoWeeksAgo
  ).length;
  const dailyVelocity = recentDone / 14;

  // Remaining non-done tasks
  const remaining = tasks.filter((t) => !isDone(t)).length;
  const projectedDays = dailyVelocity > 0 ? Math.ceil(remaining / dailyVelocity) : Infinity;
  const buffer = daysLeft - projectedDays;

  let status: string;
  if (buffer >= 5) status = "✅ On track (+${buffer} day buffer)";
  else if (buffer >= 0) status = "⚠️ Tight (${buffer} day buffer)";
  else status = "🔴 At risk (${Math.abs(buffer)} days over)";
  // Fix template literals
  status = status
    .replace("${buffer}", String(buffer))
    .replace("${Math.abs(buffer)}", String(Math.abs(buffer)));

  const lines: string[] = [];
  lines.push(`🚀 Alpha in <b>${daysLeft} days</b> · ${blockers} blocker${blockers !== 1 ? "s" : ""} left`);
  lines.push(`   ${status}`);

  return lines.join("\n");
}

// ─── Nudges (max 2) ───
interface Nudge {
  text: string;
  urgency: number;
}

export function buildNudges(ctx: DigestContext): string | null {
  const { tasks, todayStart, tomorrowStart, now } = ctx;
  const nudges: Nudge[] = [];

  // Stuck tasks: IN_PROGRESS for 4+ days
  const stuckTasks = tasks.filter((t) => {
    if (t.column !== "IN_PROGRESS" || !t.startedAt) return false;
    const days = Math.floor((now.getTime() - t.startedAt.getTime()) / 86400000);
    return days >= 4;
  });
  for (const t of stuckTasks) {
    const days = Math.floor((now.getTime() - t.startedAt!.getTime()) / 86400000);
    nudges.push({
      text: `⏰ ${esc(t.title)} stuck ${days} days`,
      urgency: 70 + days,
    });
  }

  // CRITICAL untouched (not in progress, not done)
  const criticalUntouched = tasks.filter(
    (t) => t.priority === "CRITICAL" && !isDone(t) && t.column !== "IN_PROGRESS" && t.column !== "TESTING"
  );
  for (const t of criticalUntouched) {
    nudges.push({
      text: `🔴 ${esc(t.title)} is CRITICAL but not started`,
      urgency: 90,
    });
  }

  // Testing pile-up
  const testingCount = tasks.filter((t) => t.column === "TESTING").length;
  if (testingCount >= 3) {
    nudges.push({
      text: `📦 ${testingCount} tasks waiting in TESTING`,
      urgency: 60,
    });
  }

  // Due today not started
  const dueTodayNotStarted = tasks.filter(
    (t) => !isDone(t) && t.dueDate && t.dueDate >= todayStart && t.dueDate < tomorrowStart
      && t.column !== "IN_PROGRESS" && t.column !== "TESTING"
  );
  if (dueTodayNotStarted.length > 0) {
    nudges.push({
      text: `⚡ ${dueTodayNotStarted.length} due today not started`,
      urgency: 75,
    });
  }

  if (nudges.length === 0) return null;

  const top2 = nudges.sort((a, b) => b.urgency - a.urgency).slice(0, 2);
  return top2.map((n) => n.text).join("\n");
}

// ─── Current phase detection ───
export function currentPhase(tasks: Task[]): string {
  for (const phase of PHASES) {
    if (tasks.filter((t) => t.phase === phase).some((t) => !isDone(t))) {
      return phase;
    }
  }
  return PHASES[0];
}

// ─── Sparkline for streak history ───
export function sparkline(history: number[]): string {
  const chars = "▁▂▃▄▅▆▇█";
  const max = Math.max(...history, 1);
  return history.map((v) => chars[Math.min(Math.round((v / max) * 7), 7)]).join("");
}
