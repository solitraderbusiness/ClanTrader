/**
 * Alpha Readiness Board Update — Email-Only Auth
 *
 * Updates ~30 board tasks for the 34-day alpha launch plan:
 * - isLaunchBlocker flag changes (add/remove)
 * - Deprecate P8 duplicates (merged into P9 stabilize.*)
 * - Add timeline notes (Week/Day assignments)
 * - Update dependencies, estimates, positions
 * - Move tasks to correct columns
 * - Create unkeyed QA tasks
 * - Generate ALPHA-READINESS-PLAN.md
 *
 * Run: npx tsx scripts/alpha-readiness-update.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ──────────────────────────────────────────────
// 1. BLOCKER FLAG CHANGES
// ──────────────────────────────────────────────

/** Set isLaunchBlocker = false (deferred / duplicate) */
const REMOVE_BLOCKER: string[] = [
  "auth.phone-otp",           // Deferred — email-only for alpha
  "stabilize.kavenegar-prod",  // Deferred — no SMS for alpha
  "market-data.openrouter-wrapper", // Deferred — not needed for alpha
  "ops.backups",               // DUPLICATE of stabilize.db-backups
  "ops.monitoring",            // DUPLICATE of stabilize.error-tracking
  "ops.health-endpoint",       // DUPLICATE of stabilize.health-endpoint
];

/** Set isLaunchBlocker = true (newly promoted) */
const ADD_BLOCKER: string[] = [
  "auth.password-reset",            // Required for email-only auth
  "stabilize.modals-mobile",        // Mobile must work for alpha
  "stabilize.signal-cards-mobile",  // Mobile must work for alpha
  "stabilize.integrity-e2e",        // Must verify integrity before alpha
  "stabilize.exploit-regression",   // Must verify no exploits before alpha
  "stabilize.env-validation",       // Fail-fast on missing env
  "stabilize.health-endpoint",      // Needed for deploy pipeline
  "stabilize.alpha-invite",         // Alpha logistics
  "stabilize.alpha-bugfix",         // Alpha logistics
];

// ──────────────────────────────────────────────
// 2. DEPRECATIONS (P8 → merged into P9)
// ──────────────────────────────────────────────

const DEPRECATIONS: Record<string, string> = {
  "ops.backups":         "DEPRECATED — merged into stabilize.db-backups",
  "ops.monitoring":      "DEPRECATED — merged into stabilize.error-tracking",
  "ops.health-endpoint": "DEPRECATED — merged into stabilize.health-endpoint",
};

// ──────────────────────────────────────────────
// 3. TIMELINE + NOTES + ESTIMATES + DEPS
// ──────────────────────────────────────────────

interface TaskUpdate {
  notes?: string;
  estimateBest?: number;
  estimateLikely?: number;
  estimateWorst?: number;
  dependencies?: string[];
  acceptanceCriteria?: string;
  column?: string;
}

const TASK_UPDATES: Record<string, TaskUpdate> = {
  // ── Week 1: Infrastructure ──
  "stabilize.iran-vps": {
    notes: "Alpha Plan: Week 1 / Day 1 (6h)\nPre-req: Order VPS + get SSH access before Day 1.\nScope: PostgreSQL 16, Redis 7, Node 22, nginx, SSL cert, UFW firewall.",
    estimateBest: 4,
    estimateLikely: 6,
    estimateWorst: 10,
    column: "TODO",
  },
  "stabilize.deploy-iran": {
    notes: "Alpha Plan: Week 1 / Day 2 (6h)\nAdapt existing deploy-pack.sh + deploy-staging.sh for Iran VPS.\nIncludes health endpoint verification after deploy.",
    estimateBest: 4,
    estimateLikely: 6,
    estimateWorst: 8,
    dependencies: ["stabilize.iran-vps"],
    column: "TODO",
  },
  "stabilize.health-endpoint": {
    notes: "Alpha Plan: Week 1 / Day 2 (part of deploy-iran day)\nSimple GET /api/health checking DB + Redis + Socket.io status.\n~1h implementation.",
    estimateBest: 1,
    estimateLikely: 2,
    estimateWorst: 3,
    column: "TODO",
  },
  "stabilize.smtp-prod": {
    notes: "Alpha Plan: Week 1 / Day 3 (6h)\nConfigure SMTP on Iran VPS. Test email verification + password reset flows end-to-end.\nCritical for email-only auth.",
    estimateBest: 3,
    estimateLikely: 6,
    estimateWorst: 8,
    dependencies: ["stabilize.iran-vps"],
    column: "TODO",
  },
  "stabilize.env-validation": {
    notes: "Alpha Plan: Week 1 / Day 3 (part of SMTP day)\nZod schema for all required env vars. Fail-fast at startup with clear error messages.\n~2h implementation.",
    estimateBest: 1,
    estimateLikely: 2,
    estimateWorst: 4,
    column: "TODO",
  },
  "stabilize.db-backups": {
    notes: "Alpha Plan: Week 1 / Days 4-5 (12h total)\nDay 4: pg_dump cron (daily, 7-day retention) + offsite copy.\nDay 5: Full restore drill (drop → restore → verify).",
    estimateBest: 6,
    estimateLikely: 10,
    estimateWorst: 14,
    dependencies: ["stabilize.iran-vps"],
    column: "TODO",
  },
  "stabilize.rate-limits": {
    notes: "Alpha Plan: Week 1 / Day 6 (6h)\nRate limiting on login, signup, forgot-password, public API routes.\nExtend existing Redis-based rate limiter.",
    estimateBest: 3,
    estimateLikely: 5,
    estimateWorst: 8,
    column: "TODO",
  },
  "stabilize.error-tracking": {
    notes: "Alpha Plan: Week 1 / Day 7 (buffer day, 6h)\nGlitchTip deployment. If Day 7 consumed by infra issues, push to Week 4.\nFor 10 users, PM2 logs + manual monitoring is acceptable fallback.",
    estimateBest: 3,
    estimateLikely: 6,
    estimateWorst: 10,
    dependencies: ["stabilize.iran-vps"],
    column: "BACKLOG",
  },

  // ── Week 2: Auth + Mobile ──
  "auth.email-verification": {
    notes: "Alpha Plan: Week 2 / Day 8 (6h)\nAlready in TESTING — verify on Iran staging with real SMTP.\nTest: signup → receive email → click link → account verified.",
    estimateBest: 2,
    estimateLikely: 4,
    estimateWorst: 6,
    dependencies: ["stabilize.smtp-prod"],
  },
  "auth.password-reset": {
    notes: "Alpha Plan: Week 2 / Day 8 (part of email day)\nAlready in TESTING — verify on Iran staging with real SMTP.\nTest: forgot password → receive email → reset → login works.",
    estimateBest: 1,
    estimateLikely: 3,
    estimateWorst: 5,
    dependencies: ["stabilize.smtp-prod"],
  },
  "ops.mobile-responsive": {
    notes: "Alpha Plan: Week 2 / Days 9-10 (12h)\nFinish Telegram-like mobile layout. Bottom nav, hamburger menu, overflow fixes.\nCurrently IN TESTING — needs completion of remaining items.",
    estimateBest: 8,
    estimateLikely: 12,
    estimateWorst: 16,
  },
  "stabilize.mobile-audit": {
    notes: "Alpha Plan: Week 2 / Day 11 (6h)\nVerify mobile works on real devices: iPhone Safari, Android Chrome.\nFix horizontal scroll, touch targets, keyboard overlap.",
    estimateBest: 4,
    estimateLikely: 6,
    estimateWorst: 8,
    dependencies: ["ops.mobile-responsive"],
  },
  "stabilize.modals-mobile": {
    notes: "Alpha Plan: Week 2 / Day 12 (6h)\nModals/bottom sheets closable on mobile. Empty states guide user.\nTest all dialog components on mobile viewports.",
    estimateBest: 3,
    estimateLikely: 5,
    estimateWorst: 8,
    dependencies: ["ops.mobile-responsive"],
  },
  "stabilize.signal-cards-mobile": {
    notes: "Alpha Plan: Week 2 / Day 13 (6h)\nSignal cards (R:R, instruments, actions) readable on mobile.\nMay need card layout refactor for narrow screens.",
    estimateBest: 3,
    estimateLikely: 5,
    estimateWorst: 8,
    dependencies: ["stabilize.mobile-audit"],
  },

  // ── Week 3: Security + QA ──
  "ops.security-audit": {
    notes: "Alpha Plan: Week 3 / Day 15 (6h)\nScoped to alpha basics: auth checks, IDOR, upload validation, rate limits.\nNot full OWASP — just the critical paths for 10 users.",
    estimateBest: 4,
    estimateLikely: 6,
    estimateWorst: 10,
    acceptanceCriteria: "Auth checks on all admin routes. No IDOR on user data. Upload validation (type, size). Rate limits on public routes.",
  },
  "stabilize.integrity-e2e": {
    notes: "Alpha Plan: Week 3 / Day 16 (6h)\nManual test of all 6 integrity conditions end-to-end.\nDocument results in task notes.",
    estimateBest: 3,
    estimateLikely: 5,
    estimateWorst: 8,
  },
  "stabilize.exploit-regression": {
    notes: "Alpha Plan: Week 3 / Day 16 (part of integrity day)\nRegression tests for known exploits: analysis upgrade loophole, retroactive match.\nCan be automated or manual.",
    estimateBest: 2,
    estimateLikely: 4,
    estimateWorst: 6,
    dependencies: ["stabilize.integrity-e2e"],
  },

  // ── Week 4: Alpha Launch ──
  "stabilize.alpha-invite": {
    notes: "Alpha Plan: Week 4 / Day 23 (6h)\nInvite 10-20 traders. Create 2-3 curated clans.\nPrepare welcome message with instructions.",
    estimateBest: 2,
    estimateLikely: 4,
    estimateWorst: 6,
  },
  "stabilize.alpha-bugfix": {
    notes: "Alpha Plan: Week 4 / Days 24-34 (ongoing)\nBug-fix buffer for issues discovered during alpha.\nMonitor GlitchTip/PM2 logs, fix critical issues same-day.",
    estimateBest: 12,
    estimateLikely: 30,
    estimateWorst: 60,
    dependencies: ["stabilize.alpha-invite"],
  },

  // ── Deferred tasks — add notes explaining why ──
  "auth.phone-otp": {
    notes: "DEFERRED for Alpha — email-only auth decided.\nKavenegar SMS OTP will be re-enabled post-alpha when Iran number verification is needed.",
  },
  "stabilize.kavenegar-prod": {
    notes: "DEFERRED for Alpha — email-only auth decided.\nKavenegar configuration will be done when phone OTP is re-enabled post-alpha.",
  },
  "market-data.openrouter-wrapper": {
    notes: "DEFERRED for Alpha — AI features (P10+) not needed for alpha launch.\nWill be implemented when AI copilot/briefings features begin.",
  },
};

// ──────────────────────────────────────────────
// 4. QA TASKS TO CREATE (unkeyed)
// ──────────────────────────────────────────────

interface NewTask {
  title: string;
  description: string;
  phase: string;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  column: "BACKLOG" | "TODO";
  category: "FEATURE" | "BUG_FIX" | "IMPROVEMENT" | "MAINTENANCE" | "INFRASTRUCTURE";
  isLaunchBlocker: boolean;
  notes: string;
  estimateBest: number;
  estimateLikely: number;
  estimateWorst: number;
  epicKey: string;
  epicTitle: string;
  workstream: string;
  milestone: string;
}

const QA_TASKS: NewTask[] = [
  {
    title: "Prepare QA test accounts",
    description: "Create 5+ test accounts with different roles (admin, trader, spectator) and trading statements for QA testing.",
    phase: "P9",
    priority: "HIGH",
    column: "BACKLOG",
    category: "MAINTENANCE",
    isLaunchBlocker: true,
    notes: "Alpha Plan: Week 3 / Day 15 (2h)\nCreate accounts before QA begins.",
    estimateBest: 1,
    estimateLikely: 2,
    estimateWorst: 3,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
  {
    title: "QA: Auth flows (signup, login, verify, reset)",
    description: "Test all auth flows end-to-end on staging: email signup, login, email verification, password reset, logout.",
    phase: "P9",
    priority: "CRITICAL",
    column: "BACKLOG",
    category: "MAINTENANCE",
    isLaunchBlocker: true,
    notes: "Alpha Plan: Week 3 / Day 17 (6h)\nTest on both desktop and mobile.",
    estimateBest: 3,
    estimateLikely: 5,
    estimateWorst: 8,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
  {
    title: "QA: Clans + chat + topics",
    description: "Test clan creation, joining, chat messages, topics, reactions, pins. Verify real-time updates via Socket.io.",
    phase: "P9",
    priority: "CRITICAL",
    column: "BACKLOG",
    category: "MAINTENANCE",
    isLaunchBlocker: true,
    notes: "Alpha Plan: Week 3 / Day 17 (6h)\nUse 2+ accounts to test real-time.",
    estimateBest: 3,
    estimateLikely: 5,
    estimateWorst: 8,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
  {
    title: "QA: Trade cards + signals + DMs",
    description: "Test trade lifecycle: signal → active → closed. Verify trade cards render correctly. Test DM conversations.",
    phase: "P9",
    priority: "CRITICAL",
    column: "BACKLOG",
    category: "MAINTENANCE",
    isLaunchBlocker: true,
    notes: "Alpha Plan: Week 3 / Day 18 (6h)\nVerify R:R calculation, signal cards, DM notifications.",
    estimateBest: 3,
    estimateLikely: 5,
    estimateWorst: 8,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
  {
    title: "QA: Admin panel + leaderboards",
    description: "Test admin panel functionality: user management, statement review, kanban board. Verify leaderboard rankings display correctly.",
    phase: "P9",
    priority: "HIGH",
    column: "BACKLOG",
    category: "MAINTENANCE",
    isLaunchBlocker: true,
    notes: "Alpha Plan: Week 3 / Day 18 (6h)\nVerify admin-only access controls.",
    estimateBest: 2,
    estimateLikely: 4,
    estimateWorst: 6,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
  {
    title: "QA fix round 1",
    description: "Fix all critical and high-severity bugs found during QA testing rounds (Days 17-18).",
    phase: "P9",
    priority: "CRITICAL",
    column: "BACKLOG",
    category: "BUG_FIX",
    isLaunchBlocker: true,
    notes: "Alpha Plan: Week 3 / Days 19-20 (12h)\nFix critical bugs first, then high. Document all fixes.",
    estimateBest: 6,
    estimateLikely: 12,
    estimateWorst: 18,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
  {
    title: "QA fix round 2",
    description: "Fix remaining bugs from QA round 1 + re-test fixed items. Final regression pass.",
    phase: "P9",
    priority: "HIGH",
    column: "BACKLOG",
    category: "BUG_FIX",
    isLaunchBlocker: true,
    notes: "Alpha Plan: Week 3 / Day 21 (buffer day, 6h)\nOnly if needed — otherwise use as extra buffer.",
    estimateBest: 3,
    estimateLikely: 6,
    estimateWorst: 12,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
  {
    title: "Final regression + staging deploy",
    description: "Full regression test on staging. Deploy to production. Smoke test production.",
    phase: "P9",
    priority: "CRITICAL",
    column: "BACKLOG",
    category: "MAINTENANCE",
    isLaunchBlocker: true,
    notes: "Alpha Plan: Week 3 / Day 22 (buffer day, 6h)\nFinal go/no-go decision. Deploy to prod if all clear.",
    estimateBest: 4,
    estimateLikely: 6,
    estimateWorst: 8,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
  {
    title: "Verify onboarding flow on staging",
    description: "Verify intent modal + missions dashboard works on Iran staging. Not new code — just verification.",
    phase: "P9",
    priority: "NORMAL",
    column: "BACKLOG",
    category: "MAINTENANCE",
    isLaunchBlocker: false,
    notes: "Alpha Plan: Week 3 / Day 15 (1h alongside QA prep)\nJust verify existing onboarding works — no new implementation.",
    estimateBest: 1,
    estimateLikely: 1,
    estimateWorst: 2,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
  {
    title: "Verify landing page on Iran deployment",
    description: "Landing page exists and is DONE — verify it loads correctly on Iran VPS (fonts, images, no external deps).",
    phase: "P9",
    priority: "NORMAL",
    column: "BACKLOG",
    category: "MAINTENANCE",
    isLaunchBlocker: false,
    notes: "Alpha Plan: Week 2 / Day 14 (buffer day, 1h)\nQuick smoke test — should just work.",
    estimateBest: 1,
    estimateLikely: 1,
    estimateWorst: 2,
    epicKey: "stabilize",
    epicTitle: "Stabilization & Alpha",
    workstream: "STABILIZATION",
    milestone: "ALPHA_TEST",
  },
];

// ──────────────────────────────────────────────
// 5. MAIN EXECUTION
// ──────────────────────────────────────────────

async function main() {
  const summary = {
    blockerRemoved: 0,
    blockerAdded: 0,
    deprecated: 0,
    notesUpdated: 0,
    estimatesUpdated: 0,
    depsUpdated: 0,
    columnMoved: 0,
    qaCreated: 0,
    errors: [] as string[],
  };

  console.log("═══════════════════════════════════════════");
  console.log("  Alpha Readiness Board Update");
  console.log("  Email-Only Auth — 34-Day Plan");
  console.log("═══════════════════════════════════════════\n");

  // ── Step 1: Remove blocker flags ──
  console.log("Step 1: Removing launch blocker flags...");
  for (const key of REMOVE_BLOCKER) {
    const task = await prisma.projectTask.findUnique({ where: { key } });
    if (!task) {
      summary.errors.push(`Task not found: ${key}`);
      continue;
    }
    if (!task.isLaunchBlocker) {
      console.log(`  ⏭ ${key} — already not a blocker`);
      continue;
    }
    await prisma.projectTask.update({
      where: { key },
      data: { isLaunchBlocker: false },
    });
    console.log(`  ✓ ${key} — blocker removed`);
    summary.blockerRemoved++;
  }

  // ── Step 2: Add blocker flags ──
  console.log("\nStep 2: Adding launch blocker flags...");
  for (const key of ADD_BLOCKER) {
    const task = await prisma.projectTask.findUnique({ where: { key } });
    if (!task) {
      summary.errors.push(`Task not found: ${key}`);
      continue;
    }
    if (task.isLaunchBlocker) {
      console.log(`  ⏭ ${key} — already a blocker`);
      continue;
    }
    await prisma.projectTask.update({
      where: { key },
      data: { isLaunchBlocker: true },
    });
    console.log(`  ✓ ${key} — blocker added`);
    summary.blockerAdded++;
  }

  // ── Step 3: Deprecate duplicates ──
  console.log("\nStep 3: Deprecating duplicate tasks...");
  for (const [key, note] of Object.entries(DEPRECATIONS)) {
    const task = await prisma.projectTask.findUnique({ where: { key } });
    if (!task) {
      summary.errors.push(`Task not found for deprecation: ${key}`);
      continue;
    }
    await prisma.projectTask.update({
      where: { key },
      data: {
        column: "DONE",
        notes: note,
        result: note,
        completedAt: new Date(),
        pmStatus: "DEPRECATED",
      },
    });
    console.log(`  ✓ ${key} → DONE (${note})`);
    summary.deprecated++;
  }

  // ── Step 4: Update notes, estimates, deps, columns ──
  console.log("\nStep 4: Updating task details (notes, estimates, deps, columns)...");
  for (const [key, updates] of Object.entries(TASK_UPDATES)) {
    const task = await prisma.projectTask.findUnique({ where: { key } });
    if (!task) {
      summary.errors.push(`Task not found for update: ${key}`);
      continue;
    }

    const data: Record<string, unknown> = {};

    if (updates.notes) {
      data.notes = updates.notes;
      summary.notesUpdated++;
    }
    if (updates.estimateBest !== undefined) {
      data.estimateBest = updates.estimateBest;
      data.estimateLikely = updates.estimateLikely;
      data.estimateWorst = updates.estimateWorst;
      summary.estimatesUpdated++;
    }
    if (updates.dependencies) {
      data.dependencies = updates.dependencies as unknown as Prisma.InputJsonValue;
      summary.depsUpdated++;
    }
    if (updates.acceptanceCriteria) {
      data.acceptanceCriteria = updates.acceptanceCriteria;
    }
    if (updates.column && updates.column !== task.column) {
      data.column = updates.column;
      // Auto-set dates for column transitions
      if (updates.column === "DONE" && !task.completedAt) {
        data.completedAt = new Date();
      }
      if (updates.column === "IN_PROGRESS" && !task.startedAt) {
        data.startedAt = new Date();
      }
      if (task.column === "DONE" && updates.column !== "DONE") {
        data.completedAt = null;
      }
      summary.columnMoved++;
    }

    if (Object.keys(data).length > 0) {
      await prisma.projectTask.update({ where: { key }, data });
      const changes = Object.keys(data).join(", ");
      console.log(`  ✓ ${key} — updated: ${changes}`);
    }
  }

  // ── Step 5: Reorder TODO column (Day 1 at top) ──
  console.log("\nStep 5: Reordering TODO column by timeline...");
  const todoOrder = [
    "stabilize.iran-vps",       // Day 1
    "stabilize.deploy-iran",    // Day 2
    "stabilize.health-endpoint",// Day 2
    "stabilize.smtp-prod",      // Day 3
    "stabilize.env-validation", // Day 3
    "stabilize.db-backups",     // Days 4-5
    "stabilize.rate-limits",    // Day 6
  ];

  for (let i = 0; i < todoOrder.length; i++) {
    const key = todoOrder[i];
    const task = await prisma.projectTask.findUnique({ where: { key } });
    if (!task) continue;
    await prisma.projectTask.update({
      where: { key },
      data: { position: (i + 1) * 10 },
    });
  }
  console.log(`  ✓ Reordered ${todoOrder.length} TODO tasks by day`);

  // ── Step 6: Create QA tasks ──
  console.log("\nStep 6: Creating QA tasks...");
  for (const qa of QA_TASKS) {
    // Check if already exists by title
    const existing = await prisma.projectTask.findFirst({
      where: { title: qa.title },
    });
    if (existing) {
      console.log(`  ⏭ "${qa.title}" — already exists`);
      continue;
    }

    // Get position at end of column
    const lastTask = await prisma.projectTask.findFirst({
      where: { column: qa.column },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    await prisma.projectTask.create({
      data: {
        title: qa.title,
        description: qa.description,
        phase: qa.phase,
        priority: qa.priority,
        column: qa.column,
        category: qa.category,
        isLaunchBlocker: qa.isLaunchBlocker,
        notes: qa.notes,
        estimateBest: qa.estimateBest,
        estimateLikely: qa.estimateLikely,
        estimateWorst: qa.estimateWorst,
        epicKey: qa.epicKey,
        epicTitle: qa.epicTitle,
        workstream: qa.workstream,
        milestone: qa.milestone,
        position: (lastTask?.position ?? 0) + 10,
      },
    });
    console.log(`  ✓ Created: "${qa.title}"`);
    summary.qaCreated++;
  }

  // ── Step 7: Generate ALPHA-READINESS-PLAN.md ──
  console.log("\nStep 7: Generating ALPHA-READINESS-PLAN.md...");
  await generatePlanMarkdown();
  console.log("  ✓ ALPHA-READINESS-PLAN.md written");

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════");
  console.log("  SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`  Blocker flags removed:  ${summary.blockerRemoved}`);
  console.log(`  Blocker flags added:    ${summary.blockerAdded}`);
  console.log(`  Tasks deprecated:       ${summary.deprecated}`);
  console.log(`  Notes updated:          ${summary.notesUpdated}`);
  console.log(`  Estimates updated:      ${summary.estimatesUpdated}`);
  console.log(`  Dependencies updated:   ${summary.depsUpdated}`);
  console.log(`  Column moves:           ${summary.columnMoved}`);
  console.log(`  QA tasks created:       ${summary.qaCreated}`);
  if (summary.errors.length > 0) {
    console.log(`\n  ERRORS (${summary.errors.length}):`);
    for (const err of summary.errors) {
      console.log(`    ✗ ${err}`);
    }
  }
  console.log("");

  // Final blocker count
  const allBlockers = await prisma.projectTask.findMany({
    where: { isLaunchBlocker: true, column: { not: "DONE" } },
    orderBy: [{ phase: "asc" }, { position: "asc" }],
  });
  console.log(`  Open launch blockers: ${allBlockers.length}`);
  for (const b of allBlockers) {
    console.log(`    [${b.phase}] ${b.column.padEnd(12)} ${b.key || "(unkeyed)"} — ${b.title}`);
  }
}

// ──────────────────────────────────────────────
// MARKDOWN REPORT GENERATOR
// ──────────────────────────────────────────────

async function generatePlanMarkdown() {
  const tasks = await prisma.projectTask.findMany({
    orderBy: [{ phase: "asc" }, { position: "asc" }],
  });

  const blockers = tasks.filter(t => t.isLaunchBlocker && t.column !== "DONE");
  const deferred = tasks.filter(t =>
    t.notes?.startsWith("DEFERRED") && t.column !== "DONE"
  );
  const deprecated = tasks.filter(t =>
    t.notes?.startsWith("DEPRECATED") || t.pmStatus === "DEPRECATED"
  );

  const lines: string[] = [];
  const p = (s: string) => lines.push(s);

  p("# Alpha Readiness Plan — ClanTrader");
  p("");
  p(`> **Generated**: ${new Date().toISOString().split("T")[0]}`);
  p("> **Auth strategy**: Email-only (no Kavenegar SMS OTP)");
  p("> **Timeline**: 34 days (4 weeks + 2-week alpha)");
  p("> **Capacity**: Solo founder, ~6h/day");
  p("");

  // ── Executive Summary ──
  p("## Executive Summary");
  p("");
  p(`- **Open launch blockers**: ${blockers.length}`);
  p(`- **Deferred tasks**: ${deferred.length} (phone OTP, Kavenegar, OpenRouter)`);
  p(`- **Deprecated duplicates**: ${deprecated.length} (P8 tasks merged into P9)`);
  p("");

  // Effort estimate
  let totalBest = 0, totalLikely = 0, totalWorst = 0;
  for (const t of blockers) {
    totalBest += t.estimateBest || 0;
    totalLikely += t.estimateLikely || 0;
    totalWorst += t.estimateWorst || 0;
  }
  p("### Effort Estimate (blocker tasks only)");
  p("");
  p("| Scenario | Hours | Days (6h/day) |");
  p("|---|---|---|");
  p(`| Best case | ${totalBest}h | ${Math.ceil(totalBest / 6)} days |`);
  p(`| Likely | ${totalLikely}h | ${Math.ceil(totalLikely / 6)} days |`);
  p(`| Worst case | ${totalWorst}h | ${Math.ceil(totalWorst / 6)} days |`);
  p("");

  // ── Day-by-Day Timeline ──
  p("---");
  p("");
  p("## Day-by-Day Timeline");
  p("");

  const timeline: Array<{ day: string; week: string; tasks: string[]; hours: string; notes: string }> = [
    { day: "Day 1", week: "Week 1", tasks: ["Iran VPS setup"], hours: "6h", notes: "Pre-req: order VPS before Day 1" },
    { day: "Day 2", week: "Week 1", tasks: ["Deploy pipeline to Iran", "/api/health endpoint"], hours: "6h", notes: "Health endpoint ~1h, deploy pipeline ~5h" },
    { day: "Day 3", week: "Week 1", tasks: ["SMTP production setup", "Zod env validation"], hours: "6h", notes: "Critical for email-only auth" },
    { day: "Day 4", week: "Week 1", tasks: ["Automated backups (pg_dump cron)"], hours: "6h", notes: "Daily cron, 7-day retention" },
    { day: "Day 5", week: "Week 1", tasks: ["Restore drill"], hours: "6h", notes: "Drop → restore → verify (generous buffer)" },
    { day: "Day 6", week: "Week 1", tasks: ["Rate limiting on public routes"], hours: "6h", notes: "Extend existing Redis rate limiter" },
    { day: "Day 7", week: "Week 1", tasks: ["Buffer / GlitchTip"], hours: "6h", notes: "Deploy GlitchTip if no infra issues; otherwise buffer" },
    { day: "Day 8", week: "Week 2", tasks: ["Email verification + password reset on staging"], hours: "6h", notes: "Already built — verify with real SMTP" },
    { day: "Days 9-10", week: "Week 2", tasks: ["Mobile responsive polish"], hours: "12h", notes: "Finish Telegram-like mobile layout" },
    { day: "Day 11", week: "Week 2", tasks: ["Mobile audit on real devices"], hours: "6h", notes: "iPhone Safari + Android Chrome" },
    { day: "Day 12", week: "Week 2", tasks: ["Modals/sheets on mobile"], hours: "6h", notes: "All dialogs closable on mobile" },
    { day: "Day 13", week: "Week 2", tasks: ["Signal cards mobile"], hours: "6h", notes: "R:R cards readable on narrow screens" },
    { day: "Day 14", week: "Week 2", tasks: ["Buffer"], hours: "6h", notes: "Catch-up day + verify landing page on Iran" },
    { day: "Day 15", week: "Week 3", tasks: ["Security audit (alpha basics)", "Prepare QA accounts", "Verify onboarding"], hours: "6h", notes: "Scoped: auth checks, IDOR, uploads, rate limits" },
    { day: "Day 16", week: "Week 3", tasks: ["Integrity E2E test", "Exploit regression tests"], hours: "6h", notes: "All 6 integrity conditions verified" },
    { day: "Day 17", week: "Week 3", tasks: ["QA: Auth flows", "QA: Clans + chat + topics"], hours: "6h", notes: "Use multiple test accounts" },
    { day: "Day 18", week: "Week 3", tasks: ["QA: Trade cards + signals + DMs", "QA: Admin + leaderboards"], hours: "6h", notes: "Complete QA coverage" },
    { day: "Days 19-20", week: "Week 3", tasks: ["QA fix round 1"], hours: "12h", notes: "Critical bugs first" },
    { day: "Day 21", week: "Week 3", tasks: ["Buffer / QA fix round 2"], hours: "6h", notes: "Re-test fixes, address remaining issues" },
    { day: "Day 22", week: "Week 3", tasks: ["Final regression + production deploy"], hours: "6h", notes: "Go/no-go decision" },
    { day: "Day 23", week: "Week 4", tasks: ["Alpha invite batch"], hours: "6h", notes: "10-20 traders, 2-3 curated clans" },
    { day: "Days 24-34", week: "Week 4+", tasks: ["Alpha monitoring + bug fixes"], hours: "~60h", notes: "2-week alpha feedback period" },
  ];

  p("| Day | Week | Tasks | Hours | Notes |");
  p("|---|---|---|---|---|");
  for (const row of timeline) {
    p(`| ${row.day} | ${row.week} | ${row.tasks.join(", ")} | ${row.hours} | ${row.notes} |`);
  }
  p("");

  // ── Launch Blockers ──
  p("---");
  p("");
  p("## Launch Blockers");
  p("");
  p(`${blockers.length} tasks must be completed before alpha launch:`);
  p("");
  p("| # | Key | Phase | Status | Priority | Title | Est (h) |");
  p("|---|---|---|---|---|---|---|");
  let bi = 1;
  for (const b of blockers) {
    const est = b.estimateLikely ? `${b.estimateBest || "?"}/${b.estimateLikely}/${b.estimateWorst || "?"}` : "—";
    p(`| ${bi++} | ${b.key || "—"} | ${b.phase} | ${b.column} | ${b.priority} | ${b.title} | ${est} |`);
  }
  p("");

  // ── Deferred Tasks ──
  p("---");
  p("");
  p("## Deferred Tasks (Not Alpha Blockers)");
  p("");
  p("These tasks are intentionally deferred for alpha:");
  p("");
  p("| Key | Title | Reason |");
  p("|---|---|---|");
  p("| `auth.phone-otp` | Phone OTP signup/login | Email-only auth for alpha |");
  p("| `stabilize.kavenegar-prod` | Kavenegar OTP on Iran | Email-only auth for alpha |");
  p("| `market-data.openrouter-wrapper` | OpenRouter client wrapper | AI features not needed for alpha |");
  p("");

  // ── Deprecated Duplicates ──
  p("---");
  p("");
  p("## Deprecated Duplicates");
  p("");
  p("P8 tasks merged into P9 equivalents:");
  p("");
  p("| Deprecated (P8) | Merged Into (P9) |");
  p("|---|---|");
  p("| `ops.backups` | `stabilize.db-backups` |");
  p("| `ops.monitoring` | `stabilize.error-tracking` |");
  p("| `ops.health-endpoint` | `stabilize.health-endpoint` |");
  p("");

  // ── Risk Register ──
  p("---");
  p("");
  p("## Risk Register");
  p("");
  p("| Risk | Impact | Mitigation |");
  p("|---|---|---|");
  p("| Iran VPS setup takes >1 day | Shifts all Week 1 tasks | Order VPS before Day 1; buffer on Day 7 |");
  p("| SMTP provider issues in Iran | No email auth | Test with multiple SMTP providers; have backup |");
  p("| Mobile bugs exceed Day 12-13 | Alpha with broken mobile | Days 14 + 21 are buffers; scope to critical flows only |");
  p("| QA reveals architectural issues | Major rework needed | Unlikely — core features already in TESTING/DONE |");
  p("| GlitchTip too resource-heavy | No error tracking | Fallback: PM2 logs + manual monitoring for 10 users |");
  p("");

  // ── Assumptions ──
  p("---");
  p("");
  p("## Assumptions");
  p("");
  p("1. Solo founder works ~6h/day consistently");
  p("2. Iran VPS is ordered and SSH-accessible before Day 1");
  p("3. Email-only auth (no SMS OTP) for alpha");
  p("4. Alpha = 10-20 invited traders, 2-3 curated clans");
  p("5. GlitchTip is nice-to-have; PM2 logs are acceptable for 10 users");
  p("6. No new features during alpha — bug fixes only");
  p("");

  const content = lines.join("\n");
  fs.writeFileSync(
    path.join(process.cwd(), "ALPHA-READINESS-PLAN.md"),
    content,
    "utf-8"
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
