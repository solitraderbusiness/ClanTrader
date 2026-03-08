import { describe, it, expect } from "vitest";
import type { Task, StreakData } from "../digest/types";
import {
  isDone, esc, bar, standupNarrative, focusLabel,
  currentPhase, sparkline, buildContext,
} from "../digest/helpers";
import { scoreTask, topLeverageTasks, daysBetween, SCORING_WEIGHTS } from "../digest/scoring";
import {
  detectMode, detectRisks, computeVerificationDebt,
  countStaleInProgress, buildDependencyGraph,
} from "../digest/classification";
import { buildMorningDigest, buildMorningMetadata } from "../digest/morning";
import { buildEveningDigest, buildEveningMetadata } from "../digest/evening";
import { updateStreak } from "../digest/streak-store";

// ─── Test helpers ───
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Test Task",
    phase: "W4",
    priority: "NORMAL",
    column: "TODO",
    dueDate: null,
    completedAt: null,
    startedAt: null,
    category: "FEATURE",
    isLaunchBlocker: false,
    result: null,
    key: null,
    pmStatus: null,
    milestone: null,
    workstream: null,
    owner: null,
    dependencies: null,
    evidence: null,
    notes: null,
    ...overrides,
  };
}

const NOW = new Date("2026-03-08T12:00:00Z");
const TODAY = new Date("2026-03-08T00:00:00Z");
const YESTERDAY = new Date("2026-03-07T00:00:00Z");

// ─── helpers.ts tests ───
describe("isDone", () => {
  it("returns true for DONE", () => {
    expect(isDone(makeTask({ column: "DONE" }))).toBe(true);
  });
  it("returns true for BUGS_FIXED", () => {
    expect(isDone(makeTask({ column: "BUGS_FIXED" }))).toBe(true);
  });
  it("returns false for IN_PROGRESS", () => {
    expect(isDone(makeTask({ column: "IN_PROGRESS" }))).toBe(false);
  });
});

describe("esc", () => {
  it("escapes HTML entities", () => {
    expect(esc("<script>alert('xss')</script>")).toBe("&lt;script&gt;alert('xss')&lt;/script&gt;");
  });
  it("escapes ampersands", () => {
    expect(esc("A & B")).toBe("A &amp; B");
  });
});

describe("bar", () => {
  it("renders 0%", () => {
    expect(bar(0, 10)).toBe("░░░░░░░░░░ 0%");
  });
  it("renders 50%", () => {
    expect(bar(5, 10)).toBe("█████░░░░░ 50%");
  });
  it("renders 100%", () => {
    expect(bar(10, 10)).toBe("██████████ 100%");
  });
  it("handles zero total", () => {
    expect(bar(0, 0)).toBe("░░░░░░░░░░ 0%");
  });
});

describe("currentPhase", () => {
  it("finds first phase with incomplete tasks", () => {
    const tasks = [
      makeTask({ phase: "W1", column: "DONE" }),
      makeTask({ phase: "W2", column: "DONE" }),
      makeTask({ phase: "W3", column: "IN_PROGRESS" }),
    ];
    expect(currentPhase(tasks)).toBe("W3");
  });
});

describe("sparkline", () => {
  it("renders sparkline characters", () => {
    const result = sparkline([0, 3, 1, 5, 2, 4, 3]);
    expect(result).toHaveLength(7);
    for (const c of result) {
      expect("▁▂▃▄▅▆▇█").toContain(c);
    }
  });
});

describe("standupNarrative", () => {
  it("generates narrative for bug fixes", () => {
    const tasks = [
      makeTask({ category: "BUG_FIX" }),
      makeTask({ category: "BUG_FIX" }),
      makeTask({ category: "FEATURE" }),
    ];
    const result = standupNarrative(tasks);
    expect(result).toContain("2 fixes");
    expect(result).toContain("1 feature");
  });

  it("handles empty tasks", () => {
    expect(standupNarrative([])).toBe("No tasks completed yesterday");
  });

  it("generates narrative for features", () => {
    const tasks = [makeTask({ category: "FEATURE" }), makeTask({ category: "FEATURE" })];
    const result = standupNarrative(tasks);
    expect(result).toContain("2 features");
  });
});

describe("focusLabel", () => {
  it("shows overdue tag", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({ title: "Fix login", dueDate: YESTERDAY });
    const label = focusLabel(t, ctx);
    expect(label).toContain("overdue");
    expect(label).toContain("Fix login");
  });

  it("shows blocker tag for launch blockers", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({ title: "X", isLaunchBlocker: true, column: "IN_PROGRESS" });
    const label = focusLabel(t, ctx);
    expect(label).toContain("BLOCKER");
    expect(label).toContain("in progress");
  });

  it("shows needs verification for implemented items", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({ title: "Y", pmStatus: "IMPLEMENTED" });
    const label = focusLabel(t, ctx);
    expect(label).toContain("needs verification");
  });

  it("shows downstream count for dependency roots", () => {
    const parent = makeTask({ key: "AUTH-001", title: "Auth" });
    const child1 = makeTask({ key: "CHAT-001", dependencies: ["AUTH-001"] });
    const child2 = makeTask({ key: "DM-001", dependencies: ["AUTH-001"] });
    const tasks = [parent, child1, child2];
    const ctx = buildContext(tasks, NOW);
    const label = focusLabel(parent, ctx);
    expect(label).toContain("unblocks 2");
  });
});

// ─── scoring.ts tests ───
describe("scoreTask", () => {
  it("scores launch blockers highest", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({ isLaunchBlocker: true, owner: "me", notes: "detailed notes" });
    expect(scoreTask(t, ctx)).toBeGreaterThanOrEqual(SCORING_WEIGHTS.LAUNCH_BLOCKER);
  });

  it("scores CRITICAL priority", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({ priority: "CRITICAL", owner: "me", notes: "detailed notes here" });
    expect(scoreTask(t, ctx)).toBe(SCORING_WEIGHTS.CRITICAL_PRIORITY);
  });

  it("scores overdue items", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({ dueDate: YESTERDAY, owner: "me", notes: "detailed notes here" });
    expect(scoreTask(t, ctx)).toBe(SCORING_WEIGHTS.OVERDUE);
  });

  it("accumulates blocker + critical + overdue", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({
      isLaunchBlocker: true,
      priority: "CRITICAL",
      dueDate: YESTERDAY,
      owner: "me",
      notes: "detailed notes here",
    });
    const score = scoreTask(t, ctx);
    expect(score).toBeGreaterThanOrEqual(
      SCORING_WEIGHTS.LAUNCH_BLOCKER + SCORING_WEIGHTS.CRITICAL_PRIORITY + SCORING_WEIGHTS.OVERDUE
    );
  });

  it("returns -Infinity for done tasks", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({ column: "DONE" });
    expect(scoreTask(t, ctx)).toBe(-Infinity);
  });

  it("penalizes missing owner", () => {
    const ctx = buildContext([], NOW);
    const withOwner = makeTask({ owner: "me", notes: "detailed notes" });
    const noOwner = makeTask({ owner: null, notes: "detailed notes" });
    expect(scoreTask(noOwner, ctx)).toBeLessThan(scoreTask(withOwner, ctx));
  });

  it("penalizes vague notes", () => {
    const ctx = buildContext([], NOW);
    const withNotes = makeTask({ owner: "me", notes: "This is a well-described task" });
    const noNotes = makeTask({ owner: "me", notes: null });
    expect(scoreTask(noNotes, ctx)).toBeLessThan(scoreTask(withNotes, ctx));
  });

  it("rewards dependency fanout", () => {
    const parent = makeTask({ id: "p", key: "AUTH-001", title: "Auth", owner: "me", notes: "detailed notes" });
    const child1 = makeTask({ key: "CHAT-001", dependencies: ["AUTH-001"] });
    const child2 = makeTask({ key: "DM-001", dependencies: ["AUTH-001"] });
    const tasks = [parent, child1, child2];
    const ctx = buildContext(tasks, NOW);
    const score = scoreTask(parent, ctx);
    // Should include UNBLOCKS_MULTIPLE * 2 + DEPENDENCY_ROOT
    expect(score).toBeGreaterThanOrEqual(
      SCORING_WEIGHTS.UNBLOCKS_MULTIPLE * 2 + SCORING_WEIGHTS.DEPENDENCY_ROOT
    );
  });

  it("suppresses post-launch items in gate mode", () => {
    const blocker = makeTask({ isLaunchBlocker: true, column: "TODO" });
    const postLaunch = makeTask({
      milestone: "POST_LAUNCH",
      column: "TODO",
      owner: "me",
      notes: "detailed notes here",
    });
    const tasks = [blocker, postLaunch];
    const ctx = buildContext(tasks, NOW);
    expect(ctx.mode).toBe("LAUNCH_GATE");
    expect(scoreTask(postLaunch, ctx)).toBeLessThan(0);
  });

  it("rewards verification debt on blocker items", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({
      isLaunchBlocker: true,
      pmStatus: "IMPLEMENTED",
      owner: "me",
      notes: "detailed notes here",
    });
    const score = scoreTask(t, ctx);
    expect(score).toBeGreaterThanOrEqual(
      SCORING_WEIGHTS.LAUNCH_BLOCKER + SCORING_WEIGHTS.VERIFICATION_DEBT
    );
  });
});

describe("topLeverageTasks", () => {
  it("returns top N non-done non-backlog tasks sorted by leverage", () => {
    const tasks = [
      makeTask({ id: "1", column: "TODO", priority: "NORMAL", owner: "me", notes: "notes here!" }),
      makeTask({ id: "2", column: "IN_PROGRESS", priority: "CRITICAL", owner: "me", notes: "notes here!", startedAt: NOW }),
      makeTask({ id: "3", column: "DONE" }),
      makeTask({ id: "4", column: "BACKLOG" }),
      makeTask({ id: "5", column: "TODO", isLaunchBlocker: true, owner: "me", notes: "notes here!" }),
    ];
    const ctx = buildContext(tasks, NOW);
    const top = topLeverageTasks(tasks, ctx, 2);
    expect(top).toHaveLength(2);
    expect(top[0].id).toBe("5"); // blocker = 150
    expect(top[1].id).toBe("2"); // CRITICAL + IN_PROGRESS_RECENT
  });
});

// ─── classification.ts tests ───
describe("detectMode", () => {
  it("returns LAUNCH_GATE when open blockers exist", () => {
    const tasks = [
      makeTask({ isLaunchBlocker: true, column: "TODO" }),
      makeTask({ column: "DONE" }),
    ];
    expect(detectMode(tasks)).toBe("LAUNCH_GATE");
  });

  it("returns STANDARD when all blockers are done", () => {
    const tasks = [
      makeTask({ isLaunchBlocker: true, column: "DONE" }),
      makeTask({ column: "TODO" }),
    ];
    expect(detectMode(tasks)).toBe("STANDARD");
  });

  it("returns STANDARD when no blockers exist", () => {
    expect(detectMode([makeTask()])).toBe("STANDARD");
  });
});

describe("computeVerificationDebt", () => {
  it("counts items built but not verified", () => {
    const tasks = [
      makeTask({ pmStatus: "IMPLEMENTED", column: "TODO" }),
      makeTask({ pmStatus: "INTEGRATED", column: "TODO", isLaunchBlocker: true }),
      makeTask({ pmStatus: "VERIFIED", column: "TODO" }),
      makeTask({ pmStatus: "CONFIGURED", column: "DONE" }), // done = excluded
    ];
    const result = computeVerificationDebt(tasks);
    expect(result.totalDebt).toBe(2); // IMPLEMENTED + INTEGRATED (not VERIFIED, not DONE)
    expect(result.blockerDebt).toBe(1); // only INTEGRATED is a blocker
  });

  it("returns zero for no debt", () => {
    const tasks = [makeTask({ pmStatus: "VERIFIED" }), makeTask({ pmStatus: null })];
    const result = computeVerificationDebt(tasks);
    expect(result.totalDebt).toBe(0);
  });
});

describe("countStaleInProgress", () => {
  it("counts tasks in progress beyond threshold", () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 86400000);
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 86400000);
    const tasks = [
      makeTask({ column: "IN_PROGRESS", startedAt: fiveDaysAgo }),
      makeTask({ column: "IN_PROGRESS", startedAt: twoDaysAgo }),
      makeTask({ column: "IN_PROGRESS", startedAt: null }),
    ];
    expect(countStaleInProgress(tasks, NOW, 4)).toBe(1); // only fiveDaysAgo
  });

  it("returns zero when nothing is stale", () => {
    const tasks = [makeTask({ column: "IN_PROGRESS", startedAt: NOW })];
    expect(countStaleInProgress(tasks, NOW)).toBe(0);
  });
});

describe("buildDependencyGraph", () => {
  it("builds upstream and downstream maps", () => {
    const tasks = [
      makeTask({ key: "AUTH-001" }),
      makeTask({ key: "CHAT-001", dependencies: ["AUTH-001"] }),
      makeTask({ key: "DM-001", dependencies: ["AUTH-001", "CHAT-001"] }),
    ];
    const graph = buildDependencyGraph(tasks);

    // AUTH-001 is depended on by CHAT-001 and DM-001
    expect(graph.downstream.get("AUTH-001")?.size).toBe(2);
    expect(graph.downstream.get("AUTH-001")?.has("CHAT-001")).toBe(true);
    expect(graph.downstream.get("AUTH-001")?.has("DM-001")).toBe(true);

    // CHAT-001 is depended on by DM-001
    expect(graph.downstream.get("CHAT-001")?.size).toBe(1);

    // DM-001 depends on AUTH-001 and CHAT-001
    expect(graph.upstream.get("DM-001")?.size).toBe(2);
  });

  it("handles tasks with no dependencies", () => {
    const tasks = [makeTask({ key: "A" }), makeTask({ key: "B" })];
    const graph = buildDependencyGraph(tasks);
    expect(graph.downstream.size).toBe(0);
    expect(graph.upstream.size).toBe(0);
  });

  it("handles null/missing dependencies gracefully", () => {
    const tasks = [
      makeTask({ key: "A", dependencies: null }),
      makeTask({ key: "B", dependencies: undefined }),
      makeTask({ key: "C", dependencies: "not-an-array" }),
    ];
    const graph = buildDependencyGraph(tasks);
    expect(graph.downstream.size).toBe(0);
  });
});

describe("detectRisks", () => {
  it("detects critical blockers", () => {
    const tasks = [
      makeTask({ isLaunchBlocker: true, priority: "CRITICAL", column: "TODO" }),
    ];
    const ctx = buildContext(tasks, NOW);
    const risks = detectRisks(ctx, 5);
    expect(risks.some((r) => r.category === "blocker")).toBe(true);
  });

  it("detects stale WIP", () => {
    const sixDaysAgo = new Date(NOW.getTime() - 6 * 86400000);
    const tasks = [
      makeTask({ column: "IN_PROGRESS", startedAt: sixDaysAgo, title: "Stuck item" }),
    ];
    const ctx = buildContext(tasks, NOW);
    const risks = detectRisks(ctx, 5);
    expect(risks.some((r) => r.category === "stale_wip")).toBe(true);
    expect(risks.find((r) => r.category === "stale_wip")?.text).toContain("Stuck item");
  });

  it("detects testing pile-up", () => {
    const tasks = [
      makeTask({ column: "TESTING", id: "1" }),
      makeTask({ column: "TESTING", id: "2" }),
      makeTask({ column: "TESTING", id: "3" }),
    ];
    const ctx = buildContext(tasks, NOW);
    const risks = detectRisks(ctx, 5);
    expect(risks.some((r) => r.category === "testing_pileup")).toBe(true);
  });

  it("detects critical item not started", () => {
    const tasks = [makeTask({ priority: "CRITICAL", column: "TODO", title: "Security fix" })];
    const ctx = buildContext(tasks, NOW);
    const risks = detectRisks(ctx, 5);
    expect(risks.some((r) => r.text.includes("CRITICAL but not started"))).toBe(true);
  });

  it("limits to maxAlerts", () => {
    const sixDaysAgo = new Date(NOW.getTime() - 6 * 86400000);
    const tasks = [
      makeTask({ isLaunchBlocker: true, priority: "CRITICAL", column: "TODO", id: "1" }),
      makeTask({ column: "IN_PROGRESS", startedAt: sixDaysAgo, id: "2" }),
      makeTask({ priority: "CRITICAL", column: "TODO", id: "3", title: "Other" }),
      makeTask({ column: "TESTING", id: "4" }),
      makeTask({ column: "TESTING", id: "5" }),
      makeTask({ column: "TESTING", id: "6" }),
    ];
    const ctx = buildContext(tasks, NOW);
    const risks = detectRisks(ctx, 2);
    expect(risks.length).toBeLessThanOrEqual(2);
  });

  it("detects missing owners on important items", () => {
    const tasks = [
      makeTask({ isLaunchBlocker: true, column: "TODO", owner: null }),
    ];
    const ctx = buildContext(tasks, NOW);
    const risks = detectRisks(ctx, 5);
    expect(risks.some((r) => r.category === "missing_owner")).toBe(true);
  });

  it("detects dependency bottlenecks", () => {
    const tasks = [
      makeTask({ key: "AUTH-001", column: "TODO", title: "Auth setup" }),
      makeTask({ key: "CHAT-001", dependencies: ["AUTH-001"] }),
      makeTask({ key: "DM-001", dependencies: ["AUTH-001"] }),
    ];
    const ctx = buildContext(tasks, NOW);
    const risks = detectRisks(ctx, 5);
    expect(risks.some((r) => r.category === "dependency_bottleneck")).toBe(true);
    expect(risks.find((r) => r.category === "dependency_bottleneck")?.text).toContain("Auth setup");
  });
});

// ─── streak-store tests ───
describe("updateStreak", () => {
  it("starts streak at 1 on first completion", () => {
    const result = updateStreak(
      { current: 0, longest: 0, lastDate: "", history: [] },
      3,
      "2026-03-08"
    );
    expect(result.current).toBe(1);
    expect(result.longest).toBe(1);
    expect(result.lastDate).toBe("2026-03-08");
    expect(result.history).toEqual([3]);
  });

  it("increments streak on consecutive days", () => {
    const result = updateStreak(
      { current: 5, longest: 10, lastDate: "2026-03-07", history: [2, 3, 1, 4, 2] },
      4,
      "2026-03-08"
    );
    expect(result.current).toBe(6);
    expect(result.longest).toBe(10);
    expect(result.history).toEqual([2, 3, 1, 4, 2, 4]);
  });

  it("resets streak on gap", () => {
    const result = updateStreak(
      { current: 5, longest: 10, lastDate: "2026-03-05", history: [2, 3, 1, 4, 2] },
      3,
      "2026-03-08"
    );
    expect(result.current).toBe(1);
  });

  it("updates longest when surpassed", () => {
    const result = updateStreak(
      { current: 9, longest: 9, lastDate: "2026-03-07", history: [1, 2, 3, 4, 5, 6, 7] },
      2,
      "2026-03-08"
    );
    expect(result.current).toBe(10);
    expect(result.longest).toBe(10);
  });

  it("keeps history to 7 entries", () => {
    const result = updateStreak(
      { current: 1, longest: 5, lastDate: "2026-03-07", history: [1, 2, 3, 4, 5, 6, 7] },
      8,
      "2026-03-08"
    );
    expect(result.history).toHaveLength(7);
    expect(result.history).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });

  it("handles zero completions", () => {
    const result = updateStreak(
      { current: 5, longest: 10, lastDate: "2026-03-07", history: [2, 3] },
      0,
      "2026-03-08"
    );
    expect(result.current).toBe(0);
    expect(result.history).toEqual([2, 3, 0]);
  });

  it("handles same-day update", () => {
    const result = updateStreak(
      { current: 3, longest: 5, lastDate: "2026-03-08", history: [2, 3, 1] },
      5,
      "2026-03-08"
    );
    expect(result.current).toBe(3);
    expect(result.history).toEqual([2, 3, 1, 5]);
  });
});

// ─── Integration: morning digest ───
describe("buildMorningDigest", () => {
  it("produces a non-empty message with header and footer", () => {
    const tasks = [
      makeTask({ column: "TODO", title: "Task A" }),
      makeTask({ column: "IN_PROGRESS", title: "Task B", startedAt: NOW }),
      makeTask({ column: "DONE", title: "Task C", completedAt: YESTERDAY }),
    ];
    const result = buildMorningDigest(tasks, NOW);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("Sun, Mar 8");
    expect(result).toContain("Open Board");
  });

  it("shows standard mode when no blockers", () => {
    const result = buildMorningDigest([], NOW);
    expect(result).toContain("Standard");
  });

  it("shows launch gate mode when blockers exist", () => {
    const tasks = [makeTask({ isLaunchBlocker: true, column: "TODO" })];
    const result = buildMorningDigest(tasks, NOW);
    expect(result).toContain("LAUNCH GATE");
  });

  it("shows focus items with task titles", () => {
    const tasks = [
      makeTask({ column: "IN_PROGRESS", title: "Socket auth", priority: "HIGH", startedAt: NOW, owner: "me", notes: "notes" }),
      makeTask({ column: "TODO", title: "DM receipts", owner: "me", notes: "notes" }),
    ];
    const result = buildMorningDigest(tasks, NOW);
    expect(result).toContain("Socket auth");
  });

  it("shows progress bar", () => {
    const tasks = [
      makeTask({ column: "DONE", completedAt: YESTERDAY }),
      makeTask({ column: "TODO" }),
    ];
    const result = buildMorningDigest(tasks, NOW);
    expect(result).toContain("50%");
  });
});

describe("buildMorningMetadata", () => {
  it("returns correct metadata structure", () => {
    const tasks = [
      makeTask({ isLaunchBlocker: true, column: "TODO", id: "b1" }),
      makeTask({ pmStatus: "IMPLEMENTED", isLaunchBlocker: true, column: "TODO", id: "b2" }),
      makeTask({ column: "DONE", id: "d1" }),
    ];
    const meta = buildMorningMetadata(tasks, NOW);
    expect(meta.mode).toBe("LAUNCH_GATE");
    expect(meta.blockerCount).toBe(2);
    expect(meta.verificationDebtCount).toBe(1); // b2 has IMPLEMENTED + isLaunchBlocker
    expect(meta.focusItemIds.length).toBeGreaterThan(0);
  });
});

// ─── Integration: evening digest ───
describe("buildEveningDigest", () => {
  it("shows completed tasks", () => {
    const tasks = [
      makeTask({
        column: "DONE",
        title: "Fix login",
        completedAt: new Date("2026-03-08T10:00:00Z"),
      }),
    ];
    const result = buildEveningDigest(tasks, NOW, null);
    expect(result).toContain("End of Day");
    expect(result).toContain("Fix login");
    expect(result).toContain("1 task shipped");
  });

  it("shows streak info", () => {
    const streak: StreakData = {
      current: 6,
      longest: 12,
      lastDate: "2026-03-08",
      history: [3, 2, 0, 5, 1, 4, 2],
    };
    const result = buildEveningDigest([], NOW, streak);
    expect(result).toContain("6 day streak");
    expect(result).toContain("best: 12");
  });

  it("handles zero completions", () => {
    const result = buildEveningDigest([], NOW, null);
    expect(result).toContain("No tasks completed today");
  });

  it("shows in-progress carry-over count", () => {
    const tasks = [
      makeTask({ column: "IN_PROGRESS", title: "Work X" }),
      makeTask({ column: "IN_PROGRESS", title: "Work Y" }),
    ];
    const result = buildEveningDigest(tasks, NOW, null);
    expect(result).toContain("2 in progress");
  });

  it("shows tomorrow preview", () => {
    const tasks = [
      makeTask({ column: "TODO", title: "Tomorrow Task", owner: "me", notes: "notes here!" }),
    ];
    const result = buildEveningDigest(tasks, NOW, null);
    expect(result).toContain("Tomorrow");
    expect(result).toContain("Tomorrow Task");
  });
});

describe("buildEveningMetadata", () => {
  it("returns correct metadata with streak", () => {
    const streak: StreakData = {
      current: 3,
      longest: 7,
      lastDate: "2026-03-08",
      history: [1, 2, 3],
    };
    const meta = buildEveningMetadata([], NOW, streak);
    expect(meta.mode).toBe("STANDARD");
    expect(meta.streak?.current).toBe(3);
  });
});

// ─── daysBetween ───
describe("daysBetween", () => {
  it("calculates days between dates", () => {
    expect(daysBetween(YESTERDAY, TODAY)).toBe(1);
  });
  it("returns 0 for same date", () => {
    expect(daysBetween(TODAY, TODAY)).toBe(0);
  });
  it("returns negative for reversed dates", () => {
    expect(daysBetween(TODAY, YESTERDAY)).toBe(-1);
  });
});
