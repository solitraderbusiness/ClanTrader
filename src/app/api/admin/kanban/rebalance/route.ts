import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const DAILY_CAPACITY = 6;
const PRIORITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

/**
 * POST /api/admin/kanban/rebalance
 *
 * Smart rebalancer that acts like a project manager:
 * 1. Counts how many open tasks remain today (capacity - done today = free slots)
 * 2. Pulls highest-priority tasks from nearest future days to fill today
 * 3. Cascades: if tomorrow is now light, pulls from the day after, etc.
 * 4. Spreads unscheduled TODO/BACKLOG tasks into days that have capacity
 * 5. Never moves tasks that are already IN_PROGRESS or TESTING
 *
 * Returns a summary of what was moved.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const allTasks = await db.projectTask.findMany({
      where: {
        column: { notIn: ["DONE", "BUGS_FIXED"] },
      },
      orderBy: [{ position: "asc" }],
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count tasks completed today (for capacity calculation)
    const doneToday = await db.projectTask.count({
      where: {
        column: { in: ["DONE", "BUGS_FIXED"] },
        completedAt: { gte: todayStart },
      },
    });

    // Group open tasks by date
    type DateBucket = { date: string; tasks: typeof allTasks };
    const byDate = new Map<string, typeof allTasks>();
    const unscheduled: typeof allTasks = [];
    const inProgressOrTesting: typeof allTasks = [];

    for (const task of allTasks) {
      // Never move tasks that are actively being worked on
      if (task.column === "IN_PROGRESS" || task.column === "TESTING") {
        inProgressOrTesting.push(task);
        continue;
      }

      if (!task.dueDate) {
        unscheduled.push(task);
        continue;
      }

      const key = toDateKey(task.dueDate);
      const arr = byDate.get(key);
      if (arr) arr.push(task);
      else byDate.set(key, [task]);
    }

    // Sort each bucket by priority
    for (const [, tasks] of byDate) {
      tasks.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));
    }

    // Sort unscheduled by priority too
    unscheduled.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));

    // Get sorted date keys (past dates first, then future)
    const todayKey = toDateKey(todayStart);
    const sortedDates = [...byDate.keys()].sort();

    // Merge overdue tasks into today
    const overdueDates = sortedDates.filter((d) => d < todayKey);
    for (const od of overdueDates) {
      const tasks = byDate.get(od) || [];
      const todayTasks = byDate.get(todayKey) || [];
      byDate.set(todayKey, [...todayTasks, ...tasks]);
      byDate.delete(od);
    }

    // Count IN_PROGRESS/TESTING tasks for today's capacity
    const activeToday = inProgressOrTesting.length;

    // Build day-by-day schedule starting from today, 14 days ahead
    const moves: { taskId: string; taskTitle: string; from: string | null; to: string }[] = [];
    const days: DateBucket[] = [];

    for (let i = 0; i < 14; i++) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() + i);
      const key = toDateKey(d);
      days.push({ date: key, tasks: byDate.get(key) || [] });
      byDate.delete(key);
    }

    // Remaining tasks scheduled beyond 14 days — leave them
    // Now rebalance: fill each day up to capacity, pulling from later days
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      // For today, account for already-completed and active tasks
      const effectiveCapacity =
        i === 0
          ? Math.max(0, DAILY_CAPACITY - doneToday - activeToday)
          : DAILY_CAPACITY;

      // If this day is over capacity, move excess to next day
      if (day.tasks.length > effectiveCapacity) {
        // Keep highest priority tasks, move rest forward
        const keep = day.tasks.slice(0, effectiveCapacity);
        const overflow = day.tasks.slice(effectiveCapacity);
        day.tasks = keep;

        // Push overflow to next available day
        if (i + 1 < days.length) {
          days[i + 1].tasks = [...overflow, ...days[i + 1].tasks];
          // Re-sort by priority
          days[i + 1].tasks.sort(
            (a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
          );
        }
      }

      // If this day has free capacity, pull from next days
      if (day.tasks.length < effectiveCapacity) {
        const slotsOpen = effectiveCapacity - day.tasks.length;
        let pulled = 0;

        for (let j = i + 1; j < days.length && pulled < slotsOpen; j++) {
          const futureDay = days[j];
          if (futureDay.tasks.length === 0) continue;

          // Pull highest priority tasks from this future day
          const toPull = Math.min(slotsOpen - pulled, futureDay.tasks.length);
          const pulledTasks = futureDay.tasks.splice(0, toPull);
          day.tasks.push(...pulledTasks);
          pulled += toPull;
        }
      }
    }

    // Fill remaining capacity with unscheduled tasks
    for (let i = 0; i < days.length && unscheduled.length > 0; i++) {
      const day = days[i];
      const effectiveCapacity =
        i === 0
          ? Math.max(0, DAILY_CAPACITY - doneToday - activeToday)
          : DAILY_CAPACITY;

      while (day.tasks.length < effectiveCapacity && unscheduled.length > 0) {
        day.tasks.push(unscheduled.shift()!);
      }
    }

    // Now apply the schedule — update dueDates in DB
    for (const day of days) {
      for (const task of day.tasks) {
        const oldDateKey = task.dueDate ? toDateKey(task.dueDate) : null;
        if (oldDateKey !== day.date) {
          moves.push({
            taskId: task.id,
            taskTitle: task.title,
            from: oldDateKey,
            to: day.date,
          });
        }
      }
    }

    // Batch update
    if (moves.length > 0) {
      await db.$transaction(
        moves.map((m) =>
          db.projectTask.update({
            where: { id: m.taskId },
            data: { dueDate: new Date(m.to + "T00:00:00") },
          })
        )
      );
    }

    return NextResponse.json({
      success: true,
      capacity: DAILY_CAPACITY,
      doneToday,
      activeToday,
      moved: moves.length,
      unscheduledAssigned: moves.filter((m) => m.from === null).length,
      moves: moves.map((m) => ({
        title: m.taskTitle,
        from: m.from || "unscheduled",
        to: m.to,
      })),
    });
  } catch (error) {
    console.error("Rebalance error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
