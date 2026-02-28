import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { getClanDigest } from "@/services/clan-digest.service";

const querySchema = z.object({
  period: z.enum(["today", "week", "month"]).default("today"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;

    // Verify user is a member of this clan
    const member = await db.clanMember.findUnique({
      where: {
        userId_clanId: { userId: session.user.id, clanId },
      },
      select: { id: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Not a clan member" }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      period: searchParams.get("period") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid parameters" },
        { status: 400 }
      );
    }

    const data = await getClanDigest(clanId, parsed.data.period);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Clan digest error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
