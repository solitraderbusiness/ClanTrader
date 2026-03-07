import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { updateProjectTaskSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

/**
 * Compute auto-set date fields when a task's column changes.
 * - → IN_PROGRESS: set startedAt (only if null)
 * - → DONE: set completedAt
 * - DONE → anything else: clear completedAt
 */
function columnTransitionDates(
  oldColumn: string,
  newColumn: string | undefined,
  existing: { startedAt: Date | null; completedAt: Date | null }
) {
  if (!newColumn || newColumn === oldColumn) return {};

  const updates: { startedAt?: Date | null; completedAt?: Date | null } = {};

  if (newColumn === "IN_PROGRESS" && !existing.startedAt) {
    updates.startedAt = new Date();
  }

  if (newColumn === "DONE" || newColumn === "BUGS_FIXED") {
    updates.completedAt = new Date();
  }

  if ((oldColumn === "DONE" || oldColumn === "BUGS_FIXED") && newColumn !== "DONE" && newColumn !== "BUGS_FIXED") {
    updates.completedAt = null;
  }

  return updates;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { taskId } = await params;
    const body = await request.json();
    const parsed = updateProjectTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.projectTask.findUnique({ where: { id: taskId } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { dueDate, lastVerifiedAt, dependencies, evidence, ...rest } = parsed.data;
    const dateTransitions = columnTransitionDates(existing.column, parsed.data.column, existing);

    const task = await db.projectTask.update({
      where: { id: taskId },
      data: {
        ...rest,
        ...dateTransitions,
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(lastVerifiedAt !== undefined ? { lastVerifiedAt: lastVerifiedAt ? new Date(lastVerifiedAt) : null } : {}),
        ...(dependencies !== undefined ? { dependencies: (dependencies as Prisma.InputJsonValue) ?? Prisma.JsonNull } : {}),
        ...(evidence !== undefined ? { evidence: (evidence as Prisma.InputJsonValue) ?? Prisma.JsonNull } : {}),
      },
      include: {
        discoveredFrom: { select: { id: true, title: true } },
      },
    });

    audit("kanban.update", "ProjectTask", task.id, session.user.id, {
      title: task.title,
      changes: Object.keys(parsed.data),
    }, { category: "ADMIN" });

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Update kanban task error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { taskId } = await params;

    const existing = await db.projectTask.findUnique({ where: { id: taskId } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    await db.projectTask.delete({ where: { id: taskId } });

    audit("kanban.delete", "ProjectTask", taskId, session.user.id, {
      title: existing.title,
    }, { category: "ADMIN" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete kanban task error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
