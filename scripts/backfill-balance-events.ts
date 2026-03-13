/**
 * backfill-balance-events.ts — Scan historical equity snapshots to infer
 * past deposit/withdrawal events and annotate snapshots.
 *
 * Usage:
 *   npx tsx scripts/backfill-balance-events.ts              # dry-run (default)
 *   npx tsx scripts/backfill-balance-events.ts --apply       # apply changes
 *   npx tsx scripts/backfill-balance-events.ts --account=ID  # single account
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  computeExternalFlow,
  classifyExternalFlow,
  computeDynamicThreshold,
} from "../src/services/balance-event.service";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const DRY_RUN = !args.includes("--apply");
const SINGLE_ACCOUNT = args.find((a) => a.startsWith("--account="))?.split("=")[1];

interface BackfillSummary {
  accountsScanned: number;
  snapshotsScanned: number;
  eventsDetected: number;
  depositsDetected: number;
  withdrawalsDetected: number;
  unknownFlows: number;
  snapshotsAnnotated: number;
  errors: number;
}

async function main() {
  console.log(`\n=== Balance Event Backfill ${DRY_RUN ? "(DRY RUN)" : "(APPLYING)"} ===\n`);

  const summary: BackfillSummary = {
    accountsScanned: 0,
    snapshotsScanned: 0,
    eventsDetected: 0,
    depositsDetected: 0,
    withdrawalsDetected: 0,
    unknownFlows: 0,
    snapshotsAnnotated: 0,
    errors: 0,
  };

  // Get all active MT accounts (or single account)
  const accounts = await prisma.mtAccount.findMany({
    where: SINGLE_ACCOUNT ? { id: SINGLE_ACCOUNT } : { isActive: true },
    select: { id: true, accountNumber: true, broker: true, balance: true },
  });

  console.log(`Found ${accounts.length} account(s) to scan.\n`);

  for (const account of accounts) {
    summary.accountsScanned++;
    console.log(`--- Account ${account.accountNumber} (${account.broker}) [${account.id}] ---`);

    try {
      // Get all snapshots ordered by time
      const snapshots = await prisma.equitySnapshot.findMany({
        where: { mtAccountId: account.id },
        orderBy: { timestamp: "asc" },
        select: { id: true, timestamp: true, balance: true, equity: true },
      });

      if (snapshots.length < 2) {
        console.log(`  Only ${snapshots.length} snapshot(s), skipping.\n`);
        continue;
      }

      summary.snapshotsScanned += snapshots.length;

      // Get all closed trades for this account to find close times and PnL
      const closedTrades = await prisma.mtTrade.findMany({
        where: { mtAccountId: account.id, isOpen: false, closeTime: { not: null } },
        select: { closeTime: true, profit: true, commission: true, swap: true },
        orderBy: { closeTime: "asc" },
      });

      // For each consecutive pair of snapshots, check for balance jumps
      for (let i = 1; i < snapshots.length; i++) {
        const prev = snapshots[i - 1];
        const curr = snapshots[i];
        const balanceDelta = curr.balance - prev.balance;

        // Skip if no meaningful balance change
        const threshold = computeDynamicThreshold(prev.balance);
        if (Math.abs(balanceDelta) <= threshold) continue;

        // Sum PnL of trades that closed between these two snapshots
        let closedPnL = 0;
        for (const trade of closedTrades) {
          if (trade.closeTime && trade.closeTime > prev.timestamp && trade.closeTime <= curr.timestamp) {
            closedPnL += (trade.profit ?? 0) + (trade.commission ?? 0) + (trade.swap ?? 0);
          }
        }

        // Detect external flow
        const flowResult = computeExternalFlow(prev.balance, curr.balance, closedPnL);
        if (!flowResult) continue;

        const type = classifyExternalFlow(flowResult.signedAmount);
        summary.eventsDetected++;
        if (type === "DEPOSIT") summary.depositsDetected++;
        else if (type === "WITHDRAWAL") summary.withdrawalsDetected++;
        else summary.unknownFlows++;

        console.log(
          `  [${curr.timestamp.toISOString()}] ${type}: $${flowResult.signedAmount.toFixed(2)} ` +
          `(bal: ${prev.balance.toFixed(2)} → ${curr.balance.toFixed(2)}, closedPnL: ${closedPnL.toFixed(2)}, ` +
          `threshold: ${threshold})`
        );

        if (!DRY_RUN) {
          // Create BalanceEvent
          await prisma.balanceEvent.create({
            data: {
              mtAccountId: account.id,
              type,
              signedAmount: flowResult.signedAmount,
              absAmount: flowResult.absAmount,
              balanceBefore: prev.balance,
              balanceAfter: curr.balance,
              detectedAt: curr.timestamp,
              inferredFrom: "BACKFILL",
              metadata: {
                closedTradesPnL: Math.round(closedPnL * 100) / 100,
                balanceDelta: Math.round(balanceDelta * 100) / 100,
                residual: flowResult.signedAmount,
                threshold,
                snapshotBefore: prev.id,
                snapshotAfter: curr.id,
                backfilledAt: new Date().toISOString(),
              },
            },
          });

          // Annotate the snapshot at the boundary
          await prisma.equitySnapshot.update({
            where: { id: curr.id },
            data: {
              externalFlowSigned: flowResult.signedAmount,
              isBalanceEventBoundary: true,
            },
          });
          summary.snapshotsAnnotated++;
        }
      }

      // Set initialBalance from first snapshot if not already set
      if (!DRY_RUN && snapshots.length > 0) {
        await prisma.mtAccount.update({
          where: { id: account.id },
          data: {
            initialBalance: snapshots[0].balance,
            // Recompute cumulativeExternalFlow from all backfilled events
            cumulativeExternalFlow: await prisma.balanceEvent.aggregate({
              where: { mtAccountId: account.id },
              _sum: { signedAmount: true },
            }).then((r) => r._sum.signedAmount ?? 0),
          },
        });
      }
    } catch (err) {
      console.error(`  ERROR: ${err}`);
      summary.errors++;
    }
    console.log("");
  }

  // Print summary
  console.log("=== SUMMARY ===");
  console.log(`Accounts scanned:     ${summary.accountsScanned}`);
  console.log(`Snapshots scanned:    ${summary.snapshotsScanned}`);
  console.log(`Events detected:      ${summary.eventsDetected}`);
  console.log(`  Deposits:           ${summary.depositsDetected}`);
  console.log(`  Withdrawals:        ${summary.withdrawalsDetected}`);
  console.log(`  Unknown:            ${summary.unknownFlows}`);
  console.log(`Snapshots annotated:  ${summary.snapshotsAnnotated}`);
  console.log(`Errors:               ${summary.errors}`);
  if (DRY_RUN) {
    console.log(`\nThis was a DRY RUN. Run with --apply to persist changes.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
