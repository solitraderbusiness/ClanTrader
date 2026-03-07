import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { createProjectTaskSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

function computeDashboard(tasks: Array<{
  id: string;
  title: string;
  phase: string;
  priority: string;
  column: string;
  dueDate: Date | null;
  completedAt: Date | null;
  startedAt: Date | null;
  category: string;
  result: string | null;
  description: string | null;
  position: number;
  notes: string | null;
  isLaunchBlocker: boolean;
  createdAt: Date;
  updatedAt: Date;
}>) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // End of this week (Sunday)
  const dayOfWeek = now.getDay();
  const endOfWeek = new Date(todayStart);
  endOfWeek.setDate(endOfWeek.getDate() + (7 - dayOfWeek));

  const isCompleted = (t: { column: string }) => t.column === "DONE" || t.column === "BUGS_FIXED";
  const done = tasks.filter(isCompleted);
  const notDone = tasks.filter((t) => !isCompleted(t));
  const inProgress = tasks.filter((t) => t.column === "IN_PROGRESS");

  const overdueTasks = notDone.filter(
    (t) => t.dueDate && new Date(t.dueDate) < todayStart
  );

  const todayTasks = notDone.filter(
    (t) => t.dueDate && new Date(t.dueDate) >= todayStart && new Date(t.dueDate) < todayEnd
  );

  const thisWeekTasks = notDone.filter(
    (t) => t.dueDate && new Date(t.dueDate) >= todayEnd && new Date(t.dueDate) < endOfWeek
  );

  // Current phase = highest phase with incomplete tasks
  const phases = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"];
  let currentPhase = "W1";
  for (const phase of phases) {
    const phaseTasks = tasks.filter((t) => t.phase === phase);
    const phaseNotDone = phaseTasks.filter((t) => !isCompleted(t));
    if (phaseNotDone.length > 0) {
      currentPhase = phase;
      break;
    }
  }

  // Latest completed
  const completedSorted = done
    .filter((t) => t.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
  const latestCompleted = completedSorted[0] ?? null;

  // Suggested next: top 3 priority tasks in current phase, not DONE
  const priorityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  const suggestedNext = notDone
    .filter((t) => t.phase === currentPhase)
    .sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
    .slice(0, 3);

  // Stats by phase
  const byPhase: Record<string, { total: number; done: number }> = {};
  for (const phase of phases) {
    const phaseTasks = tasks.filter((t) => t.phase === phase);
    byPhase[phase] = {
      total: phaseTasks.length,
      done: phaseTasks.filter(isCompleted).length,
    };
  }

  const launchBlockers = notDone.filter((t) => t.isLaunchBlocker);

  return {
    currentPhase,
    latestCompleted,
    overdueTasks,
    todayTasks,
    thisWeekTasks,
    suggestedNext,
    launchBlockers,
    stats: {
      total: tasks.length,
      done: done.length,
      inProgress: inProgress.length,
      overdue: overdueTasks.length,
      launchBlockers: launchBlockers.length,
      byPhase,
    },
  };
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    const tasks = await db.projectTask.findMany({
      where: search ? { title: { contains: search, mode: "insensitive" } } : undefined,
      orderBy: [{ column: "asc" }, { position: "asc" }, { createdAt: "asc" }],
      include: {
        discoveredFrom: { select: { id: true, title: true } },
      },
    });

    const dashboard = search ? null : computeDashboard(tasks);

    return NextResponse.json({ tasks, dashboard });
  } catch (error) {
    console.error("Get kanban tasks error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createProjectTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const targetColumn = parsed.data.column || "BACKLOG";

    // Auto-position at end of column
    const lastTask = await db.projectTask.findFirst({
      where: { column: targetColumn },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const { dueDate, dependencies, evidence, ...rest } = parsed.data;

    const task = await db.projectTask.create({
      data: {
        ...rest,
        column: targetColumn,
        position: (lastTask?.position ?? 0) + 10,
        dueDate: dueDate ? new Date(dueDate) : null,
        startedAt: targetColumn === "IN_PROGRESS" ? new Date() : null,
        completedAt: (targetColumn === "DONE" || targetColumn === "BUGS_FIXED") ? new Date() : null,
        ...(dependencies !== undefined ? { dependencies: (dependencies as Prisma.InputJsonValue) ?? Prisma.JsonNull } : {}),
        ...(evidence !== undefined ? { evidence: (evidence as Prisma.InputJsonValue) ?? Prisma.JsonNull } : {}),
      },
    });

    audit("kanban.create", "ProjectTask", task.id, session.user.id, {
      title: task.title,
      phase: task.phase,
    }, { category: "ADMIN" });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Create kanban task error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
