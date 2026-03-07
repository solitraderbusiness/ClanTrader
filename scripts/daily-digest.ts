/**
 * Morning Project Digest — sends a concise pulse via Telegram.
 *
 * Run manually:   npx tsx scripts/daily-digest.ts
 * Cron (8 AM Iran): 30 4 * * * cd /root/projects/clantrader && npx tsx scripts/daily-digest.ts >> logs/digest.log 2>&1
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { buildMorningDigest } from "../src/lib/digest/morning";

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
  const message = buildMorningDigest(tasks, now);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log(message.replace(/<[^>]+>/g, ""));
    return;
  }

  const { sendTelegramMessage } = await import("../src/lib/telegram");
  await sendTelegramMessage(message, { parseMode: "HTML" });
  console.log(`[${now.toISOString()}] Morning digest sent.`);
}

main()
  .catch((err) => {
    console.error("Daily digest failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
