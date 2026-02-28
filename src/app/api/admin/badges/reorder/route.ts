import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { badgeReorderSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = badgeReorderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Transaction to update all displayOrders atomically
    await db.$transaction(
      parsed.data.items.map((item) =>
        db.badgeDefinition.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    // Log one admin change for the reorder
    if (parsed.data.items.length > 0) {
      await db.badgeAdminChange.create({
        data: {
          adminUserId: session.user.id,
          badgeDefinitionId: parsed.data.items[0].id,
          changeType: "reordered",
          newValueJson: parsed.data.items as unknown as Prisma.InputJsonValue,
        },
      });
    }

    audit("badge.reorder", "BadgeDefinition", "batch", session.user.id, {
      count: parsed.data.items.length,
    }, { category: "ADMIN" });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reorder badges error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
