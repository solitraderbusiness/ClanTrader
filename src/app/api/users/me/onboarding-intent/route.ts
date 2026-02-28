import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  intent: z.enum(["LEARN", "COMPETE", "SHARE", "RECRUIT"]).nullable(),
});

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: {
      onboardingIntent: parsed.data.intent,
      onboardingComplete: true,
    },
  });

  return NextResponse.json({ ok: true });
}
