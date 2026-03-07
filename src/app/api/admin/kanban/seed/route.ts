import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { audit } from "@/lib/audit";
import seedData from "../../../../../../prisma/seed/project-tasks.seed.json";

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
  dependencies: Prisma.InputJsonValue | null;
  evidence: Prisma.InputJsonValue | null;
  estimateBest: number | null;
  estimateLikely: number | null;
  estimateWorst: number | null;
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let created = 0;
    let updated = 0;

    for (const item of seedData as SeedItem[]) {
      const existing = await db.projectTask.findUnique({ where: { key: item.key } });

      if (existing) {
        // Only update structural fields, preserve operational fields
        await db.projectTask.update({
          where: { key: item.key },
          data: {
            title: item.title,
            description: item.description,
            phase: item.phase,
            category: item.category as "FEATURE" | "BUG_FIX" | "IMPROVEMENT" | "MAINTENANCE" | "INFRASTRUCTURE",
            epicKey: item.epicKey,
            epicTitle: item.epicTitle,
            workstream: item.workstream,
            milestone: item.milestone,
            isLaunchBlocker: item.isLaunchBlocker,
            acceptanceCriteria: item.acceptanceCriteria,
            risks: item.risks,
            dependencies: item.dependencies ?? Prisma.JsonNull,
            evidence: item.evidence ?? Prisma.JsonNull,
            estimateBest: item.estimateBest,
            estimateLikely: item.estimateLikely,
            estimateWorst: item.estimateWorst,
            // Preserve: column, priority, notes, result, startedAt, completedAt, owner, pmStatus
          },
        });
        updated++;
      } else {
        await db.projectTask.create({
          data: {
            key: item.key,
            title: item.title,
            description: item.description,
            phase: item.phase,
            priority: (item.priority ?? "NORMAL") as "CRITICAL" | "HIGH" | "NORMAL" | "LOW",
            column: (item.column ?? "BACKLOG") as "BACKLOG" | "TODO" | "IN_PROGRESS" | "TESTING" | "DONE" | "BUGS_FIXED",
            category: (item.category ?? "FEATURE") as "FEATURE" | "BUG_FIX" | "IMPROVEMENT" | "MAINTENANCE" | "INFRASTRUCTURE",
            position: 0,
            epicKey: item.epicKey,
            epicTitle: item.epicTitle,
            workstream: item.workstream,
            milestone: item.milestone,
            pmStatus: item.pmStatus,
            isLaunchBlocker: item.isLaunchBlocker ?? false,
            acceptanceCriteria: item.acceptanceCriteria,
            risks: item.risks,
            dependencies: item.dependencies ?? Prisma.JsonNull,
            evidence: item.evidence ?? Prisma.JsonNull,
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

    audit("kanban.seed", "ProjectTask", "bulk", session.user.id, {
      created,
      updated,
      total: seedData.length,
    }, { category: "ADMIN" });

    return NextResponse.json({ created, updated, total: seedData.length });
  } catch (error) {
    console.error("Seed project tasks error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
