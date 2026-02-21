import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateBadgeDefinitionSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { badgeId } = await params;

    const badge = await db.badgeDefinition.findUnique({
      where: { id: badgeId },
      include: {
        _count: { select: { userBadges: true } },
      },
    });

    if (!badge) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    return NextResponse.json({ badge });
  } catch (error) {
    console.error("Get badge error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { badgeId } = await params;
    const body = await request.json();
    const parsed = updateBadgeDefinitionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.badgeDefinition.findUnique({
      where: { id: badgeId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    const { requirementsJson, ...rest } = parsed.data;

    const badge = await db.badgeDefinition.update({
      where: { id: badgeId },
      data: {
        ...rest,
        ...(requirementsJson !== undefined
          ? {
              requirementsJson:
                requirementsJson as unknown as Prisma.InputJsonValue,
            }
          : {}),
      },
    });

    // Determine change type
    let changeType = "updated";
    if (parsed.data.enabled !== undefined && parsed.data.enabled !== existing.enabled) {
      changeType = parsed.data.enabled ? "enabled" : "disabled";
    }

    await db.badgeAdminChange.create({
      data: {
        adminUserId: session.user.id,
        badgeDefinitionId: badgeId,
        changeType,
        oldValueJson: {
          name: existing.name,
          description: existing.description,
          requirementsJson: existing.requirementsJson,
          enabled: existing.enabled,
          displayOrder: existing.displayOrder,
        } as unknown as Prisma.InputJsonValue,
        newValueJson: parsed.data as unknown as Prisma.InputJsonValue,
      },
    });

    audit("badge.update", "BadgeDefinition", badgeId, session.user.id, {
      changeType,
    });

    return NextResponse.json({ badge });
  } catch (error) {
    console.error("Update badge error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { badgeId } = await params;

    const existing = await db.badgeDefinition.findUnique({
      where: { id: badgeId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    // Soft delete
    await db.badgeDefinition.update({
      where: { id: badgeId },
      data: { isDeleted: true, enabled: false },
    });

    await db.badgeAdminChange.create({
      data: {
        adminUserId: session.user.id,
        badgeDefinitionId: badgeId,
        changeType: "deleted",
        oldValueJson: {
          name: existing.name,
          isDeleted: existing.isDeleted,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    audit("badge.delete", "BadgeDefinition", badgeId, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete badge error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
