import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kanbanReorderSchema } from "@/lib/validators";

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = kanbanReorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { column, taskIds } = parsed.data;

    // Fetch existing tasks to detect column transitions
    const existingTasks = await db.projectTask.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, column: true, startedAt: true, completedAt: true },
    });
    const existingMap = new Map(existingTasks.map((t) => [t.id, t]));

    await db.$transaction(
      taskIds.map((id, index) => {
        const existing = existingMap.get(id);
        const dateUpdates: { startedAt?: Date | null; completedAt?: Date | null } = {};

        if (existing && existing.column !== column) {
          if (column === "IN_PROGRESS" && !existing.startedAt) {
            dateUpdates.startedAt = new Date();
          }
          if (column === "DONE" || column === "BUGS_FIXED") {
            dateUpdates.completedAt = new Date();
          }
          if ((existing.column === "DONE" || existing.column === "BUGS_FIXED") && column !== "DONE" && column !== "BUGS_FIXED") {
            dateUpdates.completedAt = null;
          }
        }

        return db.projectTask.update({
          where: { id },
          data: { column, position: index * 10, ...dateUpdates },
        });
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reorder kanban error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
