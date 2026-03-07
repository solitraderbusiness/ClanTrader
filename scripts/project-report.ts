import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PHASE_NAMES: Record<string, string> = {
  W1: "Infrastructure",
  W2: "Auth & Mobile",
  W3: "Security & QA",
  W4: "Alpha Launch",
  W5: "Alpha Monitoring",
  W6: "Post-Alpha",
  W7: "Feature Sprint 1",
  W8: "Feature Sprint 2",
};

const STATUS_LABELS: Record<string, string> = {
  DONE: "DONE",
  TESTING: "IN TESTING",
  IN_PROGRESS: "IN PROGRESS",
  TODO: "TO DO",
  BACKLOG: "BACKLOG",
};

const PRIO_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

function actionNeeded(t: { column: string; title: string; description: string | null; isLaunchBlocker: boolean }): string {
  if (t.column === "DONE") return "Complete. No action needed.";
  if (t.column === "TESTING") return "Code complete. Needs manual QA verification before marking done.";
  if (t.column === "IN_PROGRESS") return "Currently being worked on. Finish implementation and move to testing.";

  // For TODO/BACKLOG, use description if available, otherwise generate from title
  if (t.description) {
    // Extract actionable summary from description
    const desc = t.description.replace(/\n/g, " ").trim();
    if (desc.length <= 200) return desc;
    return desc.slice(0, 197) + "...";
  }
  return "Needs implementation.";
}

async function main() {
  const tasks = await prisma.projectTask.findMany({
    orderBy: [{ phase: "asc" }, { position: "asc" }, { createdAt: "asc" }],
  });

  const phases: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    if (!phases[t.phase]) phases[t.phase] = [];
    phases[t.phase].push(t);
  }

  const sortedPhases = Object.keys(phases).sort(
    (a, b) => parseInt(a.replace("W", "")) - parseInt(b.replace("W", ""))
  );

  const lines: string[] = [];
  const p = (s: string) => lines.push(s);

  p("# ClanTrader — Project Report for PM");
  p("");
  p("> **Generated**: " + new Date().toISOString().split("T")[0]);
  p(">");
  p("> This document lists every feature/task in the ClanTrader project, grouped by phase.");
  p("> Each entry includes its current status, what it does, and what action is needed to complete it.");
  p("");

  // ─── EXECUTIVE SUMMARY ───
  const total = tasks.length;
  const done = tasks.filter((t) => t.column === "DONE").length;
  const inProg = tasks.filter((t) => t.column === "IN_PROGRESS").length;
  const testing = tasks.filter((t) => t.column === "TESTING").length;
  const todo = tasks.filter((t) => t.column === "TODO").length;
  const backlog = tasks.filter((t) => t.column === "BACKLOG").length;
  const blockerCount = tasks.filter((t) => t.isLaunchBlocker && t.column !== "DONE").length;

  p("---");
  p("");
  p("## Executive Summary");
  p("");
  p("| | Count | % |");
  p("|---|---|---|");
  p("| **Total tasks** | " + total + " | 100% |");
  p("| Done | " + done + " | " + Math.round((done / total) * 100) + "% |");
  p("| In Testing | " + testing + " | " + Math.round((testing / total) * 100) + "% |");
  p("| In Progress | " + inProg + " | " + Math.round((inProg / total) * 100) + "% |");
  p("| To Do | " + todo + " | " + Math.round((todo / total) * 100) + "% |");
  p("| Backlog | " + backlog + " | " + Math.round((backlog / total) * 100) + "% |");
  p("| **Open Launch Blockers** | **" + blockerCount + "** | |");
  p("");

  // Estimates
  let totalBest = 0, totalLikely = 0, totalWorst = 0, estCount = 0;
  for (const t of tasks) {
    if (t.column !== "DONE" && t.estimateLikely) {
      totalBest += t.estimateBest || t.estimateLikely;
      totalLikely += t.estimateLikely;
      totalWorst += t.estimateWorst || t.estimateLikely;
      estCount++;
    }
  }
  if (estCount > 0) {
    p("### Remaining Effort Estimate");
    p("");
    p("Based on " + estCount + " tasks that have hour estimates (excludes completed tasks):");
    p("");
    p("| Scenario | Hours |");
    p("|---|---|");
    p("| Best case | " + totalBest + "h |");
    p("| Likely | " + totalLikely + "h |");
    p("| Worst case | " + totalWorst + "h |");
    p("");
    p("*Note: " + (total - done - estCount) + " remaining tasks do not yet have estimates.*");
    p("");
  }

  // ─── PHASE OVERVIEW TABLE ───
  p("---");
  p("");
  p("## Phase Overview");
  p("");
  p("| Phase | Name | Total | Done | Remaining | Progress |");
  p("|---|---|---|---|---|---|");
  for (const phase of sortedPhases) {
    const pts = phases[phase];
    const pDone = pts.filter((t) => t.column === "DONE").length;
    const pRemaining = pts.length - pDone;
    const pct = Math.round((pDone / pts.length) * 100);
    const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
    p(
      "| " + phase + " | " + (PHASE_NAMES[phase] || phase) +
      " | " + pts.length +
      " | " + pDone +
      " | " + pRemaining +
      " | " + bar + " " + pct + "% |"
    );
  }
  p("");

  // ─── LAUNCH BLOCKERS ───
  const openBlockers = tasks.filter((t) => t.isLaunchBlocker && t.column !== "DONE");
  if (openBlockers.length > 0) {
    p("---");
    p("");
    p("## Launch Blockers (Must Complete Before Go-Live)");
    p("");
    p("These " + openBlockers.length + " tasks are flagged as **launch blockers** — the platform cannot go live until they are resolved.");
    p("");
    p("| # | Phase | Status | Priority | Task | Action Needed |");
    p("|---|---|---|---|---|---|");
    openBlockers.sort((a, b) => {
      const pa = parseInt(a.phase.replace("W", ""));
      const pb = parseInt(b.phase.replace("W", ""));
      if (pa !== pb) return pa - pb;
      return (PRIO_ORDER[a.priority] ?? 2) - (PRIO_ORDER[b.priority] ?? 2);
    });
    let bi = 1;
    for (const t of openBlockers) {
      const action = actionNeeded(t);
      p("| " + bi++ + " | " + t.phase + " | " + STATUS_LABELS[t.column] + " | " + t.priority + " | **" + t.title + "** | " + action + " |");
    }
    p("");
  }

  // ─── DETAILED PHASE SECTIONS ───
  p("---");
  p("");
  p("## Detailed Feature List by Phase");
  p("");

  for (const phase of sortedPhases) {
    const pts = phases[phase];
    const pDone = pts.filter((t) => t.column === "DONE").length;
    const pct = Math.round((pDone / pts.length) * 100);

    p("---");
    p("");
    p("### " + phase + " — " + (PHASE_NAMES[phase] || phase));
    p("");
    p("**Progress**: " + pDone + "/" + pts.length + " tasks done (" + pct + "%)");
    p("");

    // Sort by priority
    const sorted = [...pts].sort(
      (a, b) => (PRIO_ORDER[a.priority] ?? 2) - (PRIO_ORDER[b.priority] ?? 2)
    );

    let num = 1;
    for (const t of sorted) {
      const status = STATUS_LABELS[t.column] || t.column;
      const blocker = t.isLaunchBlocker ? " `LAUNCH BLOCKER`" : "";
      const key = t.key ? " (`" + t.key + "`)" : "";
      const ws = t.workstream ? " — *" + t.workstream + "*" : "";
      const est = t.estimateLikely
        ? " — Est: " + (t.estimateBest || "?") + "/" + t.estimateLikely + "/" + (t.estimateWorst || "?") + "h (best/likely/worst)"
        : "";

      p("#### " + num++ + ". " + t.title + key);
      p("");
      p("- **Status**: " + status + blocker);
      p("- **Priority**: " + t.priority + ws);
      if (est) p("- **Estimate**: " + est.replace(" — Est: ", ""));

      // What it is
      if (t.description) {
        const desc = t.description.replace(/\n/g, " ").trim();
        p("- **What it is**: " + (desc.length > 300 ? desc.slice(0, 297) + "..." : desc));
      }

      // What needs to happen
      const action = actionNeeded(t);
      if (t.column !== "DONE") {
        p("- **To complete**: " + action);
      }

      p("");
    }
  }

  // ─── WORKSTREAM SUMMARY ───
  p("---");
  p("");
  p("## Workstream Summary");
  p("");
  const byWs: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    const ws = t.workstream || "Unassigned";
    if (!byWs[ws]) byWs[ws] = [];
    byWs[ws].push(t);
  }
  p("| Workstream | Total | Done | Remaining |");
  p("|---|---|---|---|");
  for (const [ws, wsTasks] of Object.entries(byWs).sort((a, b) => a[0].localeCompare(b[0]))) {
    const wsDone = wsTasks.filter((t) => t.column === "DONE").length;
    p("| " + ws + " | " + wsTasks.length + " | " + wsDone + " | " + (wsTasks.length - wsDone) + " |");
  }
  p("");

  console.log(lines.join("\n"));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
