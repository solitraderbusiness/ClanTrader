/**
 * Delete audit logs older than 30 days.
 * Run via: npx tsx scripts/audit-log-cleanup.ts
 * Intended to run as a daily cron job.
 */

import { PrismaClient } from "@prisma/client";

const RETENTION_DAYS = 30;

async function main() {
  const db = new PrismaClient();

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await db.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    console.log(
      `[audit-log-cleanup] Deleted ${result.count} logs older than ${RETENTION_DAYS} days (before ${cutoff.toISOString()})`
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("[audit-log-cleanup] Error:", err);
  process.exit(1);
});
