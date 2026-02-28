import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getJournalData } from "@/services/journal.service";
import { z } from "zod";

const querySchema = z.object({
  clanId: z.string().optional(),
  from: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Invalid date")
    .optional(),
  to: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Invalid date")
    .optional(),
  tracked: z.enum(["true", "false"]).optional(),
  cardType: z.enum(["SIGNAL", "ANALYSIS"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = querySchema.safeParse(params);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { clanId, from, to, tracked, cardType } = parsed.data;

    const data = await getJournalData(session.user.id, {
      clanId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      trackedOnly: tracked !== "false",
      cardType,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Journal API error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
