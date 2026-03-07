import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { buildMorningDigest } from "@/lib/digest/morning";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const tasks = await db.projectTask.findMany({
      select: {
        id: true, title: true, phase: true, priority: true, column: true,
        dueDate: true, completedAt: true, startedAt: true, category: true,
        isLaunchBlocker: true, result: true,
      },
      orderBy: [{ phase: "asc" }, { position: "asc" }],
    });

    const message = buildMorningDigest(tasks, new Date());
    await sendTelegramMessage(message, { parseMode: "HTML" });

    return NextResponse.json({ ok: true, message: "Morning digest sent" });
  } catch (error) {
    console.error("Daily digest error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
