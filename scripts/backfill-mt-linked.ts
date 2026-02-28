/**
 * One-time backfill: set mtLinked = true on all existing trades with
 * resolutionSource = EA_VERIFIED.
 *
 * Usage: npx tsx scripts/backfill-mt-linked.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const db = new PrismaClient({ adapter });

async function main() {
  const result = await db.trade.updateMany({
    where: {
      resolutionSource: "EA_VERIFIED",
      mtLinked: false,
    },
    data: {
      mtLinked: true,
    },
  });

  console.log(`Backfill complete: ${result.count} trades marked as mtLinked`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
