import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PUSH_CATEGORIES } from "@/lib/notification-types";

const pushCategoriesSchema = z.record(
  z.enum([
    PUSH_CATEGORIES.TRADES,
    PUSH_CATEGORIES.PRICE_ALERTS,
    PUSH_CATEGORIES.RISK,
    PUSH_CATEGORIES.TRACKING,
    PUSH_CATEGORIES.INTEGRITY,
    PUSH_CATEGORIES.CLAN,
  ]),
  z.boolean()
);

const updateSchema = z.object({
  inAppEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  deliveryMode: z.enum(["all", "critical_only"]).optional(),
  pushCategories: pushCategoriesSchema.optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pref = await db.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    inAppEnabled: pref?.inAppEnabled ?? true,
    soundEnabled: pref?.soundEnabled ?? true,
    pushEnabled: pref?.pushEnabled ?? false,
    deliveryMode: pref?.deliveryMode ?? "all",
    pushCategories: (pref?.pushCategories as Record<string, boolean>) ?? {},
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const pref = await db.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      inAppEnabled: parsed.data.inAppEnabled ?? true,
      soundEnabled: parsed.data.soundEnabled ?? true,
      pushEnabled: parsed.data.pushEnabled ?? false,
      deliveryMode: parsed.data.deliveryMode ?? "all",
      pushCategories: parsed.data.pushCategories ?? {},
    },
    update: parsed.data,
  });

  return NextResponse.json({
    inAppEnabled: pref.inAppEnabled,
    soundEnabled: pref.soundEnabled,
    pushEnabled: pref.pushEnabled,
    deliveryMode: pref.deliveryMode,
    pushCategories: (pref.pushCategories as Record<string, boolean>) ?? {},
  });
}
