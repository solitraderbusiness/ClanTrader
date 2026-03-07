/**
 * Evening Project Digest — day results, streak, tomorrow preview.
 *
 * Run manually:   npx tsx scripts/evening-digest.ts
 * Cron (10 PM Iran): 30 18 * * * cd /root/projects/clantrader && npx tsx scripts/evening-digest.ts >> logs/digest.log 2>&1
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Redis from "ioredis";
import "dotenv/config";

import { buildEveningDigest } from "../src/lib/digest/evening";
import { loadStreak, saveStreak, updateStreak } from "../src/lib/digest/streak-store";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tasks = await prisma.projectTask.findMany({
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

  // Count today's completions
  const todayCompleted = tasks.filter(
    (t) => (t.column === "DONE" || t.column === "BUGS_FIXED")
      && t.completedAt && t.completedAt >= todayStart && t.completedAt < tomorrowStart
  ).length;

  // Update streak in Redis
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

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log(message.replace(/<[^>]+>/g, ""));
    return;
  }

  const { sendTelegramMessage } = await import("../src/lib/telegram");
  await sendTelegramMessage(message, { parseMode: "HTML" });
  console.log(`[${now.toISOString()}] Evening digest sent.`);

  if (redis) await redis.quit();
}

main()
  .catch((err) => {
    console.error("Evening digest failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
