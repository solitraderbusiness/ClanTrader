import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recalculateAll } from "@/services/statement-calc.service";
import { audit } from "@/lib/audit";
import type { StatementPeriod } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { clanId, periodType, from, to, seasonId } = body as {
      clanId: string;
      periodType: StatementPeriod;
      from?: string;
      to?: string;
      seasonId?: string;
    };

    if (!clanId || !periodType) {
      return NextResponse.json(
        { error: "clanId and periodType are required" },
        { status: 400 }
      );
    }

    const statements = await recalculateAll(
      clanId,
      periodType,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
      seasonId
    );

    audit("statement.recalculate", "TraderStatement", clanId, session.user.id, {
      periodType,
      count: statements.length,
    });

    return NextResponse.json({
      count: statements.length,
      statements: statements.map((s) => ({
        id: s.id,
        userId: s.userId,
        tradeCount: s.tradeCount,
      })),
    });
  } catch (error) {
    console.error("Statement calculation error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
