import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { statementReviewSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const parsed = statementReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { status, reviewNotes } = parsed.data;

    const statement = await db.tradingStatement.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!statement) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    if (statement.verificationStatus !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending statements can be reviewed" },
        { status: 400 }
      );
    }

    if (status === "VERIFIED") {
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + 90);

      await db.$transaction([
        db.tradingStatement.update({
          where: { id },
          data: {
            verificationStatus: "VERIFIED",
            verifiedAt: now,
            expiresAt,
            reviewNotes: reviewNotes || null,
          },
        }),
        // Upgrade user role from SPECTATOR to TRADER
        ...(statement.user.role === "SPECTATOR"
          ? [
              db.user.update({
                where: { id: statement.userId },
                data: { role: "TRADER" },
              }),
            ]
          : []),
      ]);
    } else {
      await db.tradingStatement.update({
        where: { id },
        data: {
          verificationStatus: "REJECTED",
          reviewNotes: reviewNotes || null,
        },
      });
    }

    const updated = await db.tradingStatement.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ statement: updated });
  } catch (error) {
    console.error("Admin review statement error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
