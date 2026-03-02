import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updatePmItemSchema } from "@/lib/validators";
import { audit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { itemId } = await params;
    const body = await request.json();
    const parsed = updatePmItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await db.pmItem.findUnique({ where: { id: itemId } });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) data.status = parsed.data.status;
    if (parsed.data.priority !== undefined) data.priority = parsed.data.priority;
    if (parsed.data.owner !== undefined) data.owner = parsed.data.owner;
    if (parsed.data.notes !== undefined) data.notes = parsed.data.notes;
    if (parsed.data.lastVerifiedAt !== undefined) {
      data.lastVerifiedAt = parsed.data.lastVerifiedAt
        ? new Date(parsed.data.lastVerifiedAt)
        : null;
    }

    const item = await db.pmItem.update({
      where: { id: itemId },
      data,
    });

    audit("pm.update", "PmItem", item.id, session.user.id, {
      key: item.key,
      changes: parsed.data,
    }, { category: "ADMIN" });

    return NextResponse.json({ item });
  } catch (error) {
    console.error("Update PM item error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
