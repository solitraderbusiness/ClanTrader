/**
 * Backfill badge evaluations for all users with trades.
 *
 * Usage:
 *   npx tsx scripts/backfill-badges.ts
 *   npx tsx scripts/backfill-badges.ts --offset=100  # resume from offset
 *   npx tsx scripts/backfill-badges.ts --batch=25     # batch size (default: 50)
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Parse args
const args = process.argv.slice(2);
function getArg(name: string, fallback: number): number {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? parseInt(arg.split("=")[1]) : fallback;
}

const BATCH_SIZE = getArg("batch", 50);
const START_OFFSET = getArg("offset", 0);

async function main() {
  console.log("Badge Backfill Script");
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log(`  Start offset: ${START_OFFSET}`);
  console.log();

  // Count users with trades
  const totalUsers = await prisma.user.count({
    where: { trades: { some: {} } },
  });

  console.log(`Found ${totalUsers} users with trades.`);
  if (START_OFFSET >= totalUsers) {
    console.log("Offset exceeds total users. Nothing to do.");
    return;
  }

  // Load badge definitions
  const badgeDefs = await prisma.badgeDefinition.findMany({
    where: { enabled: true, isDeleted: false },
  });

  console.log(`Loaded ${badgeDefs.length} active badge definitions.`);
  console.log();

  const RESOLVED_STATUSES = ["TP1_HIT", "TP2_HIT", "SL_HIT", "BE", "CLOSED"] as const;
  let processed = 0;
  let errors = 0;
  let offset = START_OFFSET;

  while (offset < totalUsers) {
    const users = await prisma.user.findMany({
      where: { trades: { some: {} } },
      select: { id: true, name: true },
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    if (users.length === 0) break;

    for (const user of users) {
      try {
        // Count valid closed trades
        const tradeCount = await prisma.trade.count({
          where: {
            userId: user.id,
            status: { in: [...RESOLVED_STATUSES] },
          },
        });

        // Evaluate rank badges
        const rankDefs = badgeDefs
          .filter((d) => d.category === "RANK")
          .sort((a, b) => b.displayOrder - a.displayOrder);

        let highestRank: (typeof rankDefs)[0] | null = null;
        for (const def of rankDefs) {
          const req = def.requirementsJson as { min_closed_trades?: number };
          if (req.min_closed_trades && tradeCount >= req.min_closed_trades) {
            highestRank = def;
            break;
          }
        }

        // Deactivate all rank badges
        await prisma.userBadge.updateMany({
          where: {
            userId: user.id,
            isActive: true,
            badgeDefinition: { category: "RANK" },
          },
          data: { isActive: false, revokedAt: new Date(), evaluatedAt: new Date() },
        });

        // Activate highest qualifying rank
        if (highestRank) {
          await prisma.userBadge.upsert({
            where: {
              userId_badgeDefinitionId: {
                userId: user.id,
                badgeDefinitionId: highestRank.id,
              },
            },
            create: {
              userId: user.id,
              badgeDefinitionId: highestRank.id,
              isActive: true,
              metadataJson: { validTradeCount: tradeCount },
              evaluatedAt: new Date(),
            },
            update: {
              isActive: true,
              revokedAt: null,
              metadataJson: { validTradeCount: tradeCount },
              evaluatedAt: new Date(),
            },
          });
        }

        processed++;
      } catch (err) {
        console.error(`  Error for user ${user.id} (${user.name}):`, err);
        errors++;
      }
    }

    offset += users.length;
    console.log(`  Progress: ${offset}/${totalUsers} (${processed} OK, ${errors} errors)`);
  }

  console.log();
  console.log(`Backfill complete: ${processed} processed, ${errors} errors.`);
}

main()
  .catch((e) => {
    console.error("Backfill error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
