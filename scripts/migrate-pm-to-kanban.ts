/**
 * One-time migration: Seed ProjectTask from project-tasks.seed.json
 * (PmItem table already dropped by schema push)
 *
 * Run: npx tsx scripts/migrate-pm-to-kanban.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import seedData from "../prisma/seed/project-tasks.seed.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface SeedItem {
  key: string;
  title: string;
  description: string | null;
  phase: string;
  priority: string;
  column: string;
  category: string;
  epicKey: string | null;
  epicTitle: string | null;
  workstream: string | null;
  milestone: string | null;
  pmStatus: string | null;
  isLaunchBlocker: boolean;
  acceptanceCriteria: string | null;
  risks: string | null;
  dependencies: string[] | null;
  evidence: Record<string, unknown> | null;
  estimateBest: number | null;
  estimateLikely: number | null;
  estimateWorst: number | null;
}

async function main() {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of seedData as SeedItem[]) {
    // Check by key first
    const byKey = await prisma.projectTask.findUnique({ where: { key: item.key } });
    if (byKey) {
      skipped++;
      continue;
    }

    // Check for title match (existing kanban tasks without key)
    const byTitle = await prisma.projectTask.findFirst({
      where: { title: item.title, key: null },
    });

    if (byTitle) {
      // Merge PM fields into existing kanban task
      await prisma.projectTask.update({
        where: { id: byTitle.id },
        data: {
          key: item.key,
          epicKey: item.epicKey,
          epicTitle: item.epicTitle,
          workstream: item.workstream,
          milestone: item.milestone,
          pmStatus: item.pmStatus,
          isLaunchBlocker: item.isLaunchBlocker,
          acceptanceCriteria: item.acceptanceCriteria,
          risks: item.risks,
          dependencies: item.dependencies,
          evidence: item.evidence,
          estimateBest: item.estimateBest,
          estimateLikely: item.estimateLikely,
          estimateWorst: item.estimateWorst,
        },
      });
      updated++;
    } else {
      // Create new task
      await prisma.projectTask.create({
        data: {
          key: item.key,
          title: item.title,
          description: item.description,
          phase: item.phase,
          priority: item.priority as "CRITICAL" | "HIGH" | "NORMAL" | "LOW",
          column: item.column as "BACKLOG" | "TODO" | "IN_PROGRESS" | "TESTING" | "DONE",
          category: item.category as "FEATURE" | "BUG_FIX" | "IMPROVEMENT" | "MAINTENANCE" | "INFRASTRUCTURE",
          position: 0,
          epicKey: item.epicKey,
          epicTitle: item.epicTitle,
          workstream: item.workstream,
          milestone: item.milestone,
          pmStatus: item.pmStatus,
          isLaunchBlocker: item.isLaunchBlocker,
          acceptanceCriteria: item.acceptanceCriteria,
          risks: item.risks,
          dependencies: item.dependencies,
          evidence: item.evidence,
          estimateBest: item.estimateBest,
          estimateLikely: item.estimateLikely,
          estimateWorst: item.estimateWorst,
          completedAt: item.column === "DONE" ? new Date() : null,
          startedAt: item.column === "IN_PROGRESS" ? new Date() : null,
        },
      });
      created++;
    }
  }

  console.log(`Migration complete: ${created} created, ${updated} merged, ${skipped} skipped (already exist)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
