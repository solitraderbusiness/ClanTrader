/**
 * Evening Launch Control Digest — day results, blocker movement, streak.
 *
 * Run manually:   npx tsx scripts/evening-digest.ts
 * Cron (10 PM Iran): 30 18 * * * cd /root/projects/clantrader && npx tsx scripts/evening-digest.ts >> logs/digest.log 2>&1
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Redis from "ioredis";
import "dotenv/config";

import { buildEveningDigest, buildEveningMetadata } from "../src/lib/digest/evening";
import { detectMode } from "../src/lib/digest/classification";
import { loadStreak, saveStreak, updateStreak } from "../src/lib/digest/streak-store";
import { DIGEST_TASK_SELECT, DIGEST_TASK_ORDER } from "../src/lib/digest/adapters";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tasks = await prisma.projectTask.findMany({
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

  // Update streak in Redis (optional — graceful if unavailable)
  let streak = null;
  let redis: Redis | null = null;
  try {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    const existing = await loadStreak(redis);
    const todayDate = now.toISOString().slice(0, 10);
    streak = updateStreak(existing, todayCompleted, todayDate);
    await saveStreak(redis, streak);
  } catch {
    // No streak — that's fine
  }

  const message = buildEveningDigest(tasks, now, streak);
  const metadata = buildEveningMetadata(tasks, now, streak);
  const mode = detectMode(tasks);

  // Persist digest record
  let sentAt: Date | null = null;
  let sendStatus = "no_telegram_config";

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (token && chatId) {
    try {
      const { sendTelegramMessage } = await import("../src/lib/telegram");
      await sendTelegramMessage(message, { parseMode: "HTML" });
      sentAt = new Date();
      sendStatus = "sent";
    } catch (err) {
      sendStatus = `failed: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }

  await prisma.digestRecord.create({
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

  if (!token || !chatId) {
    console.log(message.replace(/<[^>]+>/g, ""));
  }
  console.log(`[${now.toISOString()}] Evening digest ${sendStatus}. Mode: ${mode}`);

  if (redis) await redis.quit();
}

main()
  .catch((err) => {
    console.error("Evening digest failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
