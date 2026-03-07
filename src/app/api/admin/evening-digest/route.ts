import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { sendTelegramMessage } from "@/lib/telegram";
import { buildEveningDigest } from "@/lib/digest/evening";
import { loadStreak, saveStreak, updateStreak } from "@/lib/digest/streak-store";

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

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const todayCompleted = tasks.filter(
      (t) => (t.column === "DONE" || t.column === "BUGS_FIXED")
        && t.completedAt && t.completedAt >= todayStart && t.completedAt < tomorrowStart
    ).length;

    const existing = await loadStreak(redis);
    const todayDate = now.toISOString().slice(0, 10);
    const streak = updateStreak(existing, todayCompleted, todayDate);
    await saveStreak(redis, streak);

    const message = buildEveningDigest(tasks, now, streak);
    await sendTelegramMessage(message, { parseMode: "HTML" });

    return NextResponse.json({ ok: true, message: "Evening digest sent", streak });
  } catch (error) {
    console.error("Evening digest error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
