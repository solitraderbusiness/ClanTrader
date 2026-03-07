import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const dryRun = !process.argv.includes("--apply");

// ─── SPECIFIC KEY → WEEK MAPPING (highest priority) ───
const KEY_MAP: Record<string, string> = {
  // Infrastructure → W1
  "ops.rate-limiting": "W1",

  // Alpha launch → W4
  "ops.onboarding": "W4",

  // Alpha monitoring → W5
  "ops.cicd": "W5",
  "ops.logging": "W5",
  "ops.uptime": "W5",
  "ops.blackout-test": "W5",

  // Post-alpha polish → W6
  "ops.seo": "W6",
  "leaderboard.season-results": "W6",

  // Deferred features → W7
  "auth.phone-otp": "W7",
  "stabilize.kavenegar-prod": "W7",
};

// Date ranges for alpha blocker mapping
const WEEK_BY_DATE: Array<{ start: string; end: string; week: string }> = [
  { start: "2026-03-05", end: "2026-03-11", week: "W1" },
  { start: "2026-03-12", end: "2026-03-18", week: "W2" },
  { start: "2026-03-19", end: "2026-03-26", week: "W3" },
  { start: "2026-03-27", end: "2026-12-31", week: "W4" },
];

// Phase-based fallback
const PHASE_FALLBACK: Record<string, string> = {
  P1: "W1", P2: "W1", P3: "W1", P4: "W1", P5: "W1",
  P6: "W7", P7: "W7",
  P8: "W3", P9: "W3",
  P10: "W8", P11: "W8", P12: "W8", P13: "W8", P14: "W8", P15: "W8", P16: "W8",
};

function dateToWeek(dueDate: Date): string {
  const iso = dueDate.toISOString().split("T")[0];
  for (const { start, end, week } of WEEK_BY_DATE) {
    if (iso >= start && iso <= end) return week;
  }
  return "W4"; // anything past Mar 27
}

interface Task {
  id: string;
  key: string | null;
  title: string;
  phase: string;
  column: string;
  epicKey: string | null;
  isLaunchBlocker: boolean;
  dueDate: Date | null;
}

function mapTask(t: Task): { newPhase: string; reason: string } {
  // Priority 1: Specific key mapping
  if (t.key && KEY_MAP[t.key]) {
    return { newPhase: KEY_MAP[t.key], reason: `key:${t.key}` };
  }

  // Priority 2: monetization epicKey (active or done) → W7 for active, W6 for done
  if (t.epicKey === "monetization") {
    if (t.column === "DONE") return { newPhase: "W6", reason: "done+monetization" };
    return { newPhase: "W7", reason: "monetization.active" };
  }

  // Priority 3: DONE tasks → W1
  if (t.column === "DONE") {
    return { newPhase: "W1", reason: "done" };
  }

  // Priority 4: Launch blocker with due date → date-based
  if (t.isLaunchBlocker && t.dueDate) {
    const week = dateToWeek(t.dueDate);
    return { newPhase: week, reason: `blocker+date:${t.dueDate.toISOString().split("T")[0]}` };
  }

  // Priority 5: Non-blocker with due date → date-based
  if (t.dueDate) {
    const week = dateToWeek(t.dueDate);
    return { newPhase: week, reason: `date:${t.dueDate.toISOString().split("T")[0]}` };
  }

  // Priority 6: epicKey-based for content/ai
  if (t.epicKey === "content") return { newPhase: "W7", reason: "epicKey:content" };
  if (t.epicKey === "ai") return { newPhase: "W7", reason: "epicKey:ai" };

  // Priority 7: Phase-based fallback
  const fallback = PHASE_FALLBACK[t.phase] || "W8";
  return { newPhase: fallback, reason: `phase:${t.phase}` };
}

async function main() {
  const tasks = await prisma.projectTask.findMany({
    select: {
      id: true, key: true, title: true, phase: true,
      column: true, epicKey: true, isLaunchBlocker: true, dueDate: true,
    },
    orderBy: [{ phase: "asc" }, { position: "asc" }],
  });

  console.log(`\n📋 Phase Migration: P1-P16 → W1-W8`);
  console.log(`   Mode: ${dryRun ? "DRY RUN (use --apply to execute)" : "APPLYING CHANGES"}`);
  console.log(`   Total tasks: ${tasks.length}\n`);

  // Compute mappings
  const mappings: Array<{ id: string; title: string; oldPhase: string; newPhase: string; reason: string }> = [];
  const weekCounts: Record<string, number> = {};

  for (const t of tasks) {
    const { newPhase, reason } = mapTask(t);
    mappings.push({ id: t.id, title: t.title, oldPhase: t.phase, newPhase, reason });
    weekCounts[newPhase] = (weekCounts[newPhase] || 0) + 1;
  }

  // Print summary
  console.log("Week distribution:");
  for (const w of ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"]) {
    console.log(`  ${w}: ${weekCounts[w] || 0} tasks`);
  }
  console.log("");

  // Print changes
  const changes = mappings.filter((m) => m.oldPhase !== m.newPhase);
  console.log(`Tasks changing phase: ${changes.length}/${tasks.length}`);
  for (const m of changes) {
    console.log(`  ${m.oldPhase} → ${m.newPhase}  [${m.reason}]  ${m.title.slice(0, 60)}`);
  }
  console.log("");

  if (dryRun) {
    console.log("🔍 Dry run complete. Use --apply to execute changes.\n");
    return;
  }

  // Apply to database
  console.log("Applying to database...");
  let updated = 0;
  for (const m of changes) {
    await prisma.projectTask.update({
      where: { id: m.id },
      data: { phase: m.newPhase },
    });
    updated++;
  }
  console.log(`✅ Updated ${updated} tasks in database.\n`);

  // Update seed file
  const seedPath = path.resolve(__dirname, "../prisma/seed/project-tasks.seed.json");
  if (fs.existsSync(seedPath)) {
    console.log("Updating seed file...");
    const seed = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
    let seedUpdated = 0;
    for (const item of seed) {
      const mapping = mappings.find((m) => m.id === item.id);
      if (mapping && item.phase !== mapping.newPhase) {
        item.phase = mapping.newPhase;
        seedUpdated++;
      }
    }
    // Also update items matched by key
    for (const item of seed) {
      if (item.phase && item.phase.startsWith("P")) {
        const mapping = mappings.find((m) =>
          (item.key && m.title === tasks.find((t) => t.id === m.id)?.title) ||
          m.id === item.id
        );
        if (!mapping) {
          // Seed item not in DB — apply fallback
          const fallback = PHASE_FALLBACK[item.phase] || "W8";
          item.phase = fallback;
          seedUpdated++;
        }
      }
    }
    fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + "\n");
    console.log(`✅ Updated ${seedUpdated} entries in seed file.\n`);
  }

  console.log("🎉 Migration complete!\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
