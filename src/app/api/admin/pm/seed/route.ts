import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import seedData from "../../../../../../prisma/seed/pm-roadmap.seed.json";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let created = 0;
    let updated = 0;

    for (const item of seedData) {
      const existing = await db.pmItem.findUnique({ where: { key: item.key } });

      if (existing) {
        // Only update structural fields, preserve operational fields (status, owner, notes, lastVerifiedAt)
        await db.pmItem.update({
          where: { key: item.key },
          data: {
            title: item.title,
            description: item.description ?? null,
            epicKey: item.epicKey,
            epicTitle: item.epicTitle,
            workstream: item.workstream as "PRODUCT_CORE" | "TRUST_INTEGRITY" | "PLATFORM_OPS" | "MONETIZATION_GROWTH",
            phase: item.phase,
            milestone: item.milestone as "MVP_BETA" | "PUBLIC_LAUNCH" | "POST_LAUNCH",
            isLaunchBlocker: item.isLaunchBlocker,
            acceptanceCriteria: item.acceptanceCriteria ?? null,
            risks: item.risks ?? null,
            dependencies: item.dependencies,
            evidence: item.evidence,
          },
        });
        updated++;
      } else {
        await db.pmItem.create({
          data: {
            key: item.key,
            title: item.title,
            description: item.description ?? null,
            epicKey: item.epicKey,
            epicTitle: item.epicTitle,
            workstream: item.workstream as "PRODUCT_CORE" | "TRUST_INTEGRITY" | "PLATFORM_OPS" | "MONETIZATION_GROWTH",
            phase: item.phase,
            priority: (item.priority ?? "P1") as "P0" | "P1" | "P2",
            status: (item.status ?? "PLANNED") as "PLANNED" | "IMPLEMENTED" | "INTEGRATED" | "CONFIGURED" | "VERIFIED" | "HARDENED" | "OPERABLE" | "DEPRECATED",
            milestone: (item.milestone ?? "MVP_BETA") as "MVP_BETA" | "PUBLIC_LAUNCH" | "POST_LAUNCH",
            isLaunchBlocker: item.isLaunchBlocker ?? false,
            acceptanceCriteria: item.acceptanceCriteria ?? null,
            risks: item.risks ?? null,
            dependencies: item.dependencies ?? [],
            evidence: item.evidence ?? {},
            owner: null,
            notes: null,
          },
        });
        created++;
      }
    }

    audit("pm.seed", "PmItem", "bulk", session.user.id, {
      created,
      updated,
      total: seedData.length,
    }, { category: "ADMIN" });

    return NextResponse.json({ created, updated, total: seedData.length });
  } catch (error) {
    console.error("Seed PM items error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
