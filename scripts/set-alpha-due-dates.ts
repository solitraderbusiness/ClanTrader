import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Day 1 = March 5, 2026
const START = new Date(2026, 2, 5); // month is 0-indexed

function dayDate(day: number): Date {
  const d = new Date(START);
  d.setDate(d.getDate() + day - 1);
  return d;
}

// Timeline: [day, key_or_title][]
// For multi-day tasks, use the LAST day as due date
const TIMELINE: [number, string][] = [
  // Week 1: Infrastructure
  [1,  "stabilize.iran-vps"],
  [2,  "stabilize.deploy-iran"],
  [2,  "stabilize.health-endpoint"],
  [3,  "stabilize.smtp-prod"],
  [3,  "stabilize.env-validation"],
  [5,  "stabilize.db-backups"],           // Days 4-5, due Day 5
  [6,  "stabilize.rate-limits"],
  [7,  "stabilize.error-tracking"],       // Buffer day / GlitchTip

  // Week 2: Auth + Mobile
  [8,  "auth.email-verification"],
  [8,  "auth.password-reset"],
  [10, "ops.mobile-responsive"],          // Days 9-10, due Day 10
  [11, "stabilize.mobile-audit"],
  [12, "stabilize.modals-mobile"],
  [13, "stabilize.signal-cards-mobile"],
  [14, "Verify landing page on Iran deployment"],  // Buffer day

  // Week 3: Security + QA
  [15, "ops.security-audit"],
  [15, "Prepare QA test accounts"],
  [15, "Verify onboarding flow on staging"],
  [16, "stabilize.integrity-e2e"],
  [16, "stabilize.exploit-regression"],
  [17, "QA: Auth flows (signup, login, verify, reset)"],
  [17, "QA: Clans + chat + topics"],
  [18, "QA: Trade cards + signals + DMs"],
  [18, "QA: Admin panel + leaderboards"],
  [20, "QA fix round 1"],                 // Days 19-20, due Day 20
  [21, "QA fix round 2"],                 // Buffer
  [22, "Final regression + staging deploy"],

  // Week 4: Alpha
  [23, "stabilize.alpha-invite"],
  [34, "stabilize.alpha-bugfix"],          // Days 24-34, due Day 34
];

async function main() {
  let updated = 0;

  for (const [day, keyOrTitle] of TIMELINE) {
    const dueDate = dayDate(day);

    // Try by key first, then by title
    let task = await prisma.projectTask.findUnique({ where: { key: keyOrTitle } });
    if (!task) {
      task = await prisma.projectTask.findFirst({ where: { title: keyOrTitle } });
    }

    if (!task) {
      console.log(`  ✗ Not found: ${keyOrTitle}`);
      continue;
    }

    await prisma.projectTask.update({
      where: { id: task.id },
      data: { dueDate },
    });

    const dateStr = dueDate.toISOString().split("T")[0];
    console.log(`  ✓ Day ${String(day).padStart(2)} (${dateStr}): ${task.title}`);
    updated++;
  }

  console.log(`\nDone — ${updated} tasks now have due dates.`);
  console.log(`Timeline: ${START.toISOString().split("T")[0]} → ${dayDate(34).toISOString().split("T")[0]}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
