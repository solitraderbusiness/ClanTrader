import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { clanId } = await params;
    const body = await request.json();

    const { isFeatured, adminNotes, visibilityOverride } = body as {
      isFeatured?: boolean;
      adminNotes?: string;
      visibilityOverride?: string;
    };

    const clan = await db.clan.update({
      where: { id: clanId },
      data: {
        ...(isFeatured !== undefined ? { isFeatured } : {}),
        ...(adminNotes !== undefined ? { adminNotes } : {}),
        ...(visibilityOverride !== undefined ? { visibilityOverride } : {}),
      },
    });

    audit("clan.admin_update", "Clan", clanId, session.user.id, {
      changes: { isFeatured, adminNotes, visibilityOverride },
    });

    return NextResponse.json({ clan });
  } catch (error) {
    console.error("Admin update clan error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
