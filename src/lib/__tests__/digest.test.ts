import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Task, StreakData } from "../digest/types";
import {
  isDone, esc, bar, scoreTask, topTasks, standupNarrative,
  focusLabel, launchCountdown, buildNudges, currentPhase, sparkline,
  buildContext,
} from "../digest/helpers";
import { buildMorningDigest } from "../digest/morning";
import { buildEveningDigest } from "../digest/evening";
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

describe("scoreTask", () => {
  const ctx = buildContext([], NOW);

  it("scores overdue tasks highest", () => {
    const t = makeTask({ dueDate: YESTERDAY, priority: "NORMAL" });
    expect(scoreTask(t, ctx)).toBeGreaterThanOrEqual(100);
  });

  it("scores CRITICAL priority", () => {
    const t = makeTask({ priority: "CRITICAL" });
    expect(scoreTask(t, ctx)).toBe(80);
  });

  it("scores launch blockers", () => {
    const t = makeTask({ isLaunchBlocker: true });
    expect(scoreTask(t, ctx)).toBe(60);
  });

  it("scores due today", () => {
    const t = makeTask({ dueDate: TODAY });
    expect(scoreTask(t, ctx)).toBe(50);
  });

  it("scores IN_PROGRESS", () => {
    const t = makeTask({ column: "IN_PROGRESS" });
    expect(scoreTask(t, ctx)).toBe(25);
  });

  it("accumulates multiple scores", () => {
    const t = makeTask({
      dueDate: YESTERDAY,
      priority: "CRITICAL",
      isLaunchBlocker: true,
    });
    // overdue(100) + CRITICAL(80) + blocker(60) = 240
    expect(scoreTask(t, ctx)).toBe(240);
  });
});

describe("topTasks", () => {
  it("returns top N non-done non-backlog tasks sorted by score", () => {
    const ctx = buildContext([], NOW);
    const tasks = [
      makeTask({ id: "1", column: "TODO", priority: "NORMAL" }),
      makeTask({ id: "2", column: "IN_PROGRESS", priority: "CRITICAL" }),
      makeTask({ id: "3", column: "DONE" }),
      makeTask({ id: "4", column: "BACKLOG" }),
      makeTask({ id: "5", column: "TODO", priority: "HIGH" }),
    ];
    const top = topTasks(tasks, ctx, 2);
    expect(top).toHaveLength(2);
    expect(top[0].id).toBe("2"); // CRITICAL + IN_PROGRESS = 105
    expect(top[1].id).toBe("5"); // HIGH = 40
  });
});

describe("standupNarrative", () => {
  it("generates narrative for bug fixes", () => {
    const tasks = [
      makeTask({ category: "BUG" }),
      makeTask({ category: "BUG" }),
      makeTask({ category: "FEATURE" }),
    ];
    const result = standupNarrative(tasks);
    expect(result).toContain("Bug fix day");
    expect(result).toContain("2 fixes");
    expect(result).toContain("1 feature");
  });

  it("handles empty tasks", () => {
    expect(standupNarrative([])).toBe("No tasks completed yesterday");
  });

  it("generates narrative for features", () => {
    const tasks = [makeTask({ category: "FEATURE" }), makeTask({ category: "FEATURE" })];
    const result = standupNarrative(tasks);
    expect(result).toContain("Feature day");
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

  it("shows multiple tags", () => {
    const ctx = buildContext([], NOW);
    const t = makeTask({ title: "X", dueDate: YESTERDAY, priority: "CRITICAL", column: "IN_PROGRESS" });
    const label = focusLabel(t, ctx);
    expect(label).toContain("overdue");
    expect(label).toContain("CRITICAL");
    expect(label).toContain("in progress");
  });
});

describe("launchCountdown", () => {
  beforeEach(() => {
    vi.stubEnv("LAUNCH_TARGET_DATE", "2026-03-31");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows days left and blockers", () => {
    const tasks = [
      makeTask({ isLaunchBlocker: true, column: "TODO" }),
      makeTask({ isLaunchBlocker: true, column: "DONE" }),
    ];
    const result = launchCountdown(tasks, NOW);
    expect(result).toContain("Alpha in");
    expect(result).toContain("1 blocker left");
  });

  it("returns null if no env var", () => {
    vi.stubEnv("LAUNCH_TARGET_DATE", "");
    expect(launchCountdown([], NOW)).toBeNull();
  });
});

describe("buildNudges", () => {
  it("detects stuck tasks", () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 86400000);
    const tasks = [makeTask({ column: "IN_PROGRESS", startedAt: fiveDaysAgo, title: "Socket auth" })];
    const ctx = buildContext(tasks, NOW);
    const result = buildNudges(ctx);
    expect(result).toContain("stuck 5 days");
  });

  it("detects CRITICAL untouched", () => {
    const tasks = [makeTask({ priority: "CRITICAL", column: "TODO", title: "Security fix" })];
    const ctx = buildContext(tasks, NOW);
    const result = buildNudges(ctx);
    expect(result).toContain("CRITICAL but not started");
  });

  it("detects testing pile-up", () => {
    const tasks = [
      makeTask({ column: "TESTING", id: "1" }),
      makeTask({ column: "TESTING", id: "2" }),
      makeTask({ column: "TESTING", id: "3" }),
    ];
    const ctx = buildContext(tasks, NOW);
    const result = buildNudges(ctx);
    expect(result).toContain("3 tasks waiting in TESTING");
  });

  it("limits to 2 nudges", () => {
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 86400000);
    const tasks = [
      makeTask({ column: "IN_PROGRESS", startedAt: fiveDaysAgo, id: "1" }),
      makeTask({ priority: "CRITICAL", column: "TODO", id: "2" }),
      makeTask({ column: "TESTING", id: "3" }),
      makeTask({ column: "TESTING", id: "4" }),
      makeTask({ column: "TESTING", id: "5" }),
      makeTask({ dueDate: TODAY, column: "TODO", id: "6" }),
    ];
    const ctx = buildContext(tasks, NOW);
    const result = buildNudges(ctx);
    expect(result).not.toBeNull();
    const lines = result!.split("\n");
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  it("returns null when no issues", () => {
    const tasks = [makeTask({ column: "DONE" })];
    const ctx = buildContext(tasks, NOW);
    expect(buildNudges(ctx)).toBeNull();
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
    // All chars should be from the sparkline set
    for (const c of result) {
      expect("▁▂▃▄▅▆▇█").toContain(c);
    }
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
    expect(result.current).toBe(3); // Don't increment, same day
    expect(result.history).toEqual([2, 3, 1, 5]);
  });
});

// ─── Integration: morning digest ───
describe("buildMorningDigest", () => {
  it("produces a non-empty message", () => {
    const tasks = [
      makeTask({ column: "TODO", title: "Task A" }),
      makeTask({ column: "IN_PROGRESS", title: "Task B" }),
      makeTask({ column: "DONE", title: "Task C", completedAt: YESTERDAY }),
    ];
    const result = buildMorningDigest(tasks, NOW);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("☀️");
    expect(result).toContain("Open Board");
  });

  it("handles zero tasks", () => {
    const result = buildMorningDigest([], NOW);
    expect(result).toContain("No tasks completed yesterday");
  });

  it("shows focus section", () => {
    const tasks = [
      makeTask({ column: "IN_PROGRESS", title: "Socket auth", priority: "HIGH" }),
      makeTask({ column: "TODO", title: "DM receipts" }),
    ];
    const result = buildMorningDigest(tasks, NOW);
    expect(result).toContain("Today's Focus");
    expect(result).toContain("Socket auth");
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

  it("shows carried over", () => {
    const tasks = [
      makeTask({ column: "IN_PROGRESS", title: "Work X" }),
      makeTask({ column: "IN_PROGRESS", title: "Work Y" }),
    ];
    const result = buildEveningDigest(tasks, NOW, null);
    expect(result).toContain("2 carried over");
  });
});
