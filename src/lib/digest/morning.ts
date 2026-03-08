/**
 * Morning Launch Control Digest
 *
 * Answers: "What most improves ClanTrader's chance of shipping safely today?"
 */

import type { Task, DigestContext, DigestMetadata } from "./types";
import {
  isDone, bar, buildContext, standupNarrative, focusLabel,
  currentPhase, PHASE_NAMES,
} from "./helpers";
import { topLeverageTasks } from "./scoring";
import { detectRisks, computeVerificationDebt, countStaleInProgress } from "./classification";

export function buildMorningDigest(tasks: Task[], now: Date): string {
  const ctx = buildContext(tasks, now);
  const sections = [
    headerSection(ctx),
    launchStatusSection(ctx),
    focusSection(ctx),
    riskSection(ctx),
    readinessSection(ctx),
    progressSection(ctx),
    footerSection(),
  ];
  return sections.filter(Boolean).join("\n\n");
}

export function buildMorningMetadata(tasks: Task[], now: Date): DigestMetadata {
  const ctx = buildContext(tasks, now);
  const open = tasks.filter((t) => !isDone(t));
  const blockerCount = open.filter((t) => t.isLaunchBlocker).length;
  const verDebt = computeVerificationDebt(tasks);
  const staleCount = countStaleInProgress(tasks, now);
  const velocity7d = tasks.filter(
    (t) => isDone(t) && t.completedAt && t.completedAt >= new Date(now.getTime() - 7 * 86400000)
  ).length;
  const focus = topLeverageTasks(tasks, ctx, 3);
  const risks = detectRisks(ctx, 2);

  return {
    mode: ctx.mode,
    blockerCount,
    verificationDebtCount: verDebt.blockerDebt,
    staleInProgressCount: staleCount,
    velocity7d,
    focusItemIds: focus.map((t) => t.id),
    riskAlerts: risks.map((r) => r.text),
    milestone: "MVP_BETA",
  };
}

// ─── Sections ───

function headerSection(ctx: DigestContext): string {
  const dayName = ctx.now.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = ctx.now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const modeLabel = ctx.mode === "LAUNCH_GATE" ? "LAUNCH GATE" : "Standard";
  return `<b>${dayName}, ${monthDay}</b> · ${modeLabel}`;
}

function launchStatusSection(ctx: DigestContext): string | null {
  const open = ctx.tasks.filter((t) => !isDone(t));
  const blockers = open.filter((t) => t.isLaunchBlocker);

  if (ctx.mode === "LAUNCH_GATE") {
    const verDebt = computeVerificationDebt(ctx.tasks);
    const stale = countStaleInProgress(ctx.tasks, ctx.now);

    const parts: string[] = [];
    parts.push(`MVP Beta blocked by <b>${blockers.length}</b> item${blockers.length !== 1 ? "s" : ""}`);
    if (verDebt.blockerDebt > 0) {
      parts.push(`${verDebt.blockerDebt} built but not verified`);
    }
    if (stale > 0) {
      parts.push(`${stale} stale WIP`);
    }
    return parts.join(" · ");
  }

  // Standard mode — brief status
  const done = ctx.tasks.filter(isDone).length;
  const total = ctx.tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return `${pct}% complete (${done}/${total})`;
}

function focusSection(ctx: DigestContext): string | null {
  const top3 = topLeverageTasks(ctx.tasks, ctx, 3);
  if (top3.length === 0) return null;

  const lines: string[] = [];
  if (ctx.mode === "LAUNCH_GATE") {
    // Count how many focus items clear blockers
    const blockerClearing = top3.filter((t) => t.isLaunchBlocker).length;
    if (blockerClearing > 0) {
      lines.push(`<b>${blockerClearing} blocker-clearing task${blockerClearing > 1 ? "s" : ""} should dominate today</b>`);
    }
  }

  top3.forEach((t, i) => {
    lines.push(`${i + 1}. ${focusLabel(t, ctx)}`);
  });

  return lines.join("\n");
}

function riskSection(ctx: DigestContext): string | null {
  const risks = detectRisks(ctx, 2);
  if (risks.length === 0) return null;

  return risks.map((r) => `⚠ ${r.text}`).join("\n");
}

function readinessSection(ctx: DigestContext): string | null {
  if (ctx.mode !== "LAUNCH_GATE") return null;

  const verDebt = computeVerificationDebt(ctx.tasks);
  if (verDebt.totalDebt === 0) return null;

  const blockerPart = verDebt.blockerDebt > 0
    ? `${verDebt.blockerDebt} blocker${verDebt.blockerDebt !== 1 ? "s" : ""}`
    : "";
  const otherDebt = verDebt.totalDebt - verDebt.blockerDebt;
  const otherPart = otherDebt > 0 ? `${otherDebt} other` : "";

  const parts = [blockerPart, otherPart].filter(Boolean).join(" + ");
  return `Verification debt: ${parts} need verification`;
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

  // Yesterday narrative
  const { yesterdayStart, todayStart } = ctx;
  const yesterdayDone = tasks.filter(
    (t) => isDone(t) && t.completedAt && t.completedAt >= yesterdayStart && t.completedAt < todayStart
  );
  const narrative = yesterdayDone.length > 0
    ? `Yesterday: ${standupNarrative(yesterdayDone)}`
    : "";

  const lines: string[] = [];
  if (narrative) lines.push(narrative);
  lines.push(`${phase} ${PHASE_NAMES[phase] || phase} ${bar(phaseDone, phaseTasks.length)}`);
  lines.push(`Overall ${bar(done, total)} (${done}/${total}) · ${velocity7d}/wk`);
  return lines.join("\n");
}

function footerSection(): string {
  return `<a href="https://clantrader.com/admin/kanban">→ Open Board</a>`;
}
