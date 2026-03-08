import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { buildMorningDigest, buildMorningMetadata } from "@/lib/digest/morning";
import { detectMode } from "@/lib/digest/classification";
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
    const message = buildMorningDigest(tasks, now);
    const metadata = buildMorningMetadata(tasks, now);
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
        type: "MORNING",
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

    return NextResponse.json({ ok: true, digestId: record.id, mode, sendStatus });
  } catch (error) {
    console.error("Daily digest error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
