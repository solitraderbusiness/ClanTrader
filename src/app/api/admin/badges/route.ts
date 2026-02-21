import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createBadgeDefinitionSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import type { Prisma, BadgeCategory } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as BadgeCategory | null;
    const enabled = searchParams.get("enabled");
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const where: Prisma.BadgeDefinitionWhereInput = {};
    if (category) where.category = category;
    if (enabled !== null) where.enabled = enabled === "true";
    if (!includeDeleted) where.isDeleted = false;

    const badges = await db.badgeDefinition.findMany({
      where,
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }],
      include: {
        _count: { select: { userBadges: true } },
      },
    });

    return NextResponse.json({ badges });
  } catch (error) {
    console.error("Get badges error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createBadgeDefinitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { requirementsJson, ...rest } = parsed.data;

    const badge = await db.badgeDefinition.create({
      data: {
        ...rest,
        requirementsJson: requirementsJson as unknown as Prisma.InputJsonValue,
      },
    });

    // Log admin change
    await db.badgeAdminChange.create({
      data: {
        adminUserId: session.user.id,
        badgeDefinitionId: badge.id,
        changeType: "created",
        newValueJson: parsed.data as unknown as Prisma.InputJsonValue,
      },
    });

    audit("badge.create", "BadgeDefinition", badge.id, session.user.id, {
      key: badge.key,
    });

    return NextResponse.json({ badge }, { status: 201 });
  } catch (error) {
    console.error("Create badge error:", error);
    if (
      error instanceof Error &&
      error.message.includes("Unique constraint")
    ) {
      return NextResponse.json(
        { error: "A badge with this key already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
