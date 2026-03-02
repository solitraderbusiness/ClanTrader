import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProjectTaskSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

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

    const task = await db.projectTask.update({
      where: { id: taskId },
      data: parsed.data,
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
