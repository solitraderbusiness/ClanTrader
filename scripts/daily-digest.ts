/**
 * Morning Launch Control Digest — sends via Telegram + persists to DB.
 *
 * Run manually:   npx tsx scripts/daily-digest.ts
 * Cron (8 AM Iran): 30 4 * * * cd /root/projects/clantrader && npx tsx scripts/daily-digest.ts >> logs/digest.log 2>&1
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

import { buildMorningDigest, buildMorningMetadata } from "../src/lib/digest/morning";
import { detectMode } from "../src/lib/digest/classification";
import { DIGEST_TASK_SELECT, DIGEST_TASK_ORDER } from "../src/lib/digest/adapters";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tasks = await prisma.projectTask.findMany({
    select: DIGEST_TASK_SELECT,
    orderBy: DIGEST_TASK_ORDER,
  });

  const now = new Date();
  const message = buildMorningDigest(tasks, now);
  const metadata = buildMorningMetadata(tasks, now);
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

  if (!token || !chatId) {
    console.log(message.replace(/<[^>]+>/g, ""));
  }
  console.log(`[${now.toISOString()}] Morning digest ${sendStatus}. Mode: ${mode}`);
}

main()
  .catch((err) => {
    console.error("Daily digest failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
