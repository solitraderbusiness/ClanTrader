import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { sendTelegramMessage } from "@/lib/telegram";
import { buildEveningDigest, buildEveningMetadata } from "@/lib/digest/evening";
import { detectMode } from "@/lib/digest/classification";
import { loadStreak, saveStreak, updateStreak } from "@/lib/digest/streak-store";
import { DIGEST_TASK_SELECT, DIGEST_TASK_ORDER } from "@/lib/digest/adapters";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const tasks = await db.projectTask.findMany({
      select: DIGEST_TASK_SELECT,
      orderBy: DIGEST_TASK_ORDER,
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
    const metadata = buildEveningMetadata(tasks, now, streak);
    const mode = detectMode(tasks);

    let sentAt: Date | null = null;
    let sendStatus = "sent";
    try {
      await sendTelegramMessage(message, { parseMode: "HTML" });
      sentAt = new Date();
    } catch (err) {
      sendStatus = `failed: ${err instanceof Error ? err.message : "unknown"}`;
    }

    const record = await db.digestRecord.create({
      data: {
        type: "EVENING",
        mode,
        content: message,
        metadata: JSON.parse(JSON.stringify(metadata)),
        blockerCount: metadata.blockerCount,
        verificationDebtCount: metadata.verificationDebtCount,
        staleInProgressCount: metadata.staleInProgressCount,
        relatedMilestone: metadata.milestone,
        focusItemIds: metadata.focusItemIds,
        sentToTelegramAt: sentAt,
        sendStatus,
      },
    });

    return NextResponse.json({ ok: true, digestId: record.id, mode, streak, sendStatus });
  } catch (error) {
    console.error("Evening digest error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
