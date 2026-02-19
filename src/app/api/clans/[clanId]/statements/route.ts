import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClanStatements } from "@/services/statement-calc.service";
import type { StatementPeriod } from "@prisma/client";

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
    const { searchParams } = new URL(request.url);
    const periodType = searchParams.get("periodType") as StatementPeriod | null;

    const statements = await getClanStatements(
      clanId,
      periodType || undefined
    );

    return NextResponse.json({ statements });
  } catch (error) {
    console.error("Get clan statements error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
