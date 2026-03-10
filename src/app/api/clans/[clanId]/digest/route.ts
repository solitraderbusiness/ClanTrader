import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { getClanDigest } from "@/services/clan-digest.service";
import { getClanDigestV2 } from "@/services/digest-v2.service";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { DIGEST_V2_FLAG } from "@/lib/digest-constants";

const querySchema = z.object({
  period: z.enum(["today", "week", "month"]).default("today"),
  tz: z.coerce.number().int().min(-720).max(840).default(0),
  v: z.coerce.number().int().optional(),
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
      tz: searchParams.get("tz") ?? undefined,
      v: searchParams.get("v") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid parameters" },
        { status: 400 }
      );
    }

    // Use v2 if feature flag enabled or explicitly requested
    const useV2 = parsed.data.v === 2 || await isFeatureEnabled(DIGEST_V2_FLAG);

    if (useV2) {
      const data = await getClanDigestV2(clanId, parsed.data.period, parsed.data.tz);
      return NextResponse.json(data);
    }

    const data = await getClanDigest(clanId, parsed.data.period, parsed.data.tz);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Clan digest error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
