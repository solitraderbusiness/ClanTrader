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

    await db.$transaction(
      taskIds.map((id, index) =>
        db.projectTask.update({
          where: { id },
          data: { column, position: index * 10 },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reorder kanban error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
