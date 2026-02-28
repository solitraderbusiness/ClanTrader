import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  event: z.string().min(1).max(100),
  metadata: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Fire-and-forget write to ReferralEvent (reusing existing model for analytics)
  db.referralEvent
    .create({
      data: {
        type: parsed.data.event,
        referrerId: session.user.id,
        metadata: parsed.data.metadata ?? undefined,
      },
    })
    .catch(() => {
      // Silent — analytics writes should never fail requests
    });

  return NextResponse.json({ ok: true });
}
