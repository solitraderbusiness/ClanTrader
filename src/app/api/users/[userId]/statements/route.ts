import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUserStatements } from "@/services/statement-calc.service";
import type { StatementPeriod } from "@prisma/client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const periodType = searchParams.get("periodType") as StatementPeriod | null;

    const statements = await getUserStatements(
      userId,
      periodType || undefined
    );

    return NextResponse.json({ statements });
  } catch (error) {
    console.error("Get user statements error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
