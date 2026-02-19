import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clanSettingsSchema } from "@/lib/validators";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;

    const clan = await db.clan.findUnique({
      where: { id: clanId },
      select: { settings: true },
    });

    if (!clan) {
      return NextResponse.json({ error: "Clan not found" }, { status: 404 });
    }

    return NextResponse.json({ settings: clan.settings || {} });
  } catch (error) {
    console.error("Get clan settings error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;

    // Check leader permission
    const membership = await db.clanMember.findUnique({
      where: { userId_clanId: { userId: session.user.id, clanId } },
    });

    if (!membership || !["LEADER", "CO_LEADER"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only leaders can update clan settings" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = clanSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Merge with existing settings
    const clan = await db.clan.findUnique({
      where: { id: clanId },
      select: { settings: true },
    });

    const existingSettings = (clan?.settings as Record<string, unknown>) || {};
    const newSettings = { ...existingSettings, ...parsed.data };

    const updated = await db.clan.update({
      where: { id: clanId },
      data: { settings: newSettings },
      select: { settings: true },
    });

    return NextResponse.json({ settings: updated.settings });
  } catch (error) {
    console.error("Update clan settings error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
