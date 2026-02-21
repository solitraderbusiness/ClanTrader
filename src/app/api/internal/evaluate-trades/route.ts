import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateAllPendingTrades } from "@/services/trade-evaluator.service";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin only
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await evaluateAllPendingTrades();

    return NextResponse.json(result);
  } catch (error) {
    console.error("Evaluate trades error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
