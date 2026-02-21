import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { badgeDryRunSchema } from "@/lib/validators";
import { dryRunBadge } from "@/services/badge-engine.service";
import type { BadgeRequirements } from "@/types/badge";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = badgeDryRunSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await dryRunBadge(
      parsed.data.badgeId,
      parsed.data.requirementsJson as BadgeRequirements
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Badge dry-run error:", error);
    if (error instanceof Error && error.message === "Badge definition not found") {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
