import type { Task, DigestContext } from "./types";
import { detectMode } from "./classification";
import { buildDependencyGraph } from "./classification";

// ─── Constants ───
export const PHASE_NAMES: Record<string, string> = {
  W1: "Infrastructure", W2: "Auth & Mobile", W3: "Security & QA",
  W4: "Alpha Launch", W5: "Alpha Monitoring", W6: "Post-Alpha",
  W7: "Feature Sprint 1", W8: "Feature Sprint 2",
};

export const PHASES = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];

const CATEGORY_LABELS: Record<string, string> = {
  BUG_FIX: "fix", FEATURE: "feature", INFRASTRUCTURE: "infra",
  MAINTENANCE: "maintenance", IMPROVEMENT: "improvement", IDEA: "idea",
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

// ─── Context builder (enriched with mode + dependency graph) ───
export function buildContext(tasks: Task[], now: Date): DigestContext {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const mode = detectMode(tasks);
  const depGraph = buildDependencyGraph(tasks);
  return { tasks, now, todayStart, yesterdayStart, tomorrowStart, mode, depGraph };
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

  return parts.join(", ");
}

// ─── Focus task label (enriched with PM status) ───
export function focusLabel(t: Task, ctx: DigestContext): string {
  const tags: string[] = [];
  if (t.isLaunchBlocker) tags.push("BLOCKER");
  if (!isDone(t) && t.dueDate && t.dueDate < ctx.todayStart) tags.push("overdue");
  if (t.column === "IN_PROGRESS") tags.push("in progress");
  if (t.pmStatus && ["IMPLEMENTED", "INTEGRATED", "CONFIGURED"].includes(t.pmStatus)) {
    tags.push("needs verification");
  }
  if (t.priority === "CRITICAL" && !t.isLaunchBlocker) tags.push("CRITICAL");

  // Show downstream impact
  const downstream = t.key ? ctx.depGraph.downstream.get(t.key)?.size ?? 0 : 0;
  if (downstream >= 2) tags.push(`unblocks ${downstream}`);

  const suffix = tags.length > 0 ? ` (${tags.join(" · ")})` : "";
  return `${esc(t.title)}${suffix}`;
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
  if (history.length === 0) return "";
  const chars = "▁▂▃▄▅▆▇█";
  const max = Math.max(...history, 1);
  return history.map((v) => chars[Math.min(Math.round((v / max) * 7), 7)]).join("");
}
