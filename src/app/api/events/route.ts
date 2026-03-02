import { NextResponse } from "next/server";
import { type EventImpact } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getUpcomingEvents } from "@/services/event.service";

const VALID_IMPACTS: EventImpact[] = ["HIGH", "MEDIUM", "LOW", "NONE"];

const querySchema = z.object({
  impact: z.string().optional(),
  currency: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      impact: searchParams.get("impact") ?? undefined,
      currency: searchParams.get("currency") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { impact, currency, limit } = parsed.data;

    const impactFilter = impact
      ?.split(",")
      .filter((v): v is EventImpact =>
        VALID_IMPACTS.includes(v as EventImpact),
      );

    const currencyFilter = currency
      ?.split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const events = await getUpcomingEvents({
      impact: impactFilter?.length ? impactFilter : undefined,
      currency: currencyFilter?.length ? currencyFilter : undefined,
      limit,
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Get events error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
