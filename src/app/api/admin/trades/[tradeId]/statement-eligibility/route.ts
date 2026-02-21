import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateStatementEligibilitySchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check admin role
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { tradeId } = await params;
    const body = await request.json();
    const parsed = updateStatementEligibilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { statementEligible, reason } = parsed.data;

    const trade = await db.trade.findUnique({
      where: { id: tradeId },
      select: { id: true, integrityStatus: true, statementEligible: true },
    });

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    // Update the trade
    const updated = await db.trade.update({
      where: { id: tradeId },
      data: { statementEligible },
    });

    // Create audit event
    await db.tradeEvent.create({
      data: {
        tradeId,
        actionType: "ADMIN_STATEMENT_TOGGLE",
        actorId: session.user.id,
        oldValue: JSON.stringify({ statementEligible: trade.statementEligible }),
        newValue: JSON.stringify({ statementEligible }),
        note: reason,
      },
    });

    // Warn if enabling while integrity is UNVERIFIED
    const warning =
      statementEligible && trade.integrityStatus === "UNVERIFIED"
        ? "Trade is UNVERIFIED but statement eligibility was enabled"
        : undefined;

    return NextResponse.json({
      trade: { id: updated.id, statementEligible: updated.statementEligible },
      warning,
    });
  } catch (error) {
    console.error("Update statement eligibility error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
