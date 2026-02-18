import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { VerificationStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as VerificationStatus | null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const skip = (page - 1) * limit;

    const where = status ? { verificationStatus: status } : {};

    const [statements, total, counts] = await Promise.all([
      db.tradingStatement.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
        orderBy: { uploadedAt: "desc" },
        skip,
        take: limit,
      }),
      db.tradingStatement.count({ where }),
      Promise.all([
        db.tradingStatement.count(),
        db.tradingStatement.count({ where: { verificationStatus: "PENDING" } }),
        db.tradingStatement.count({ where: { verificationStatus: "VERIFIED" } }),
        db.tradingStatement.count({ where: { verificationStatus: "REJECTED" } }),
        db.tradingStatement.count({ where: { verificationStatus: "EXPIRED" } }),
      ]),
    ]);

    return NextResponse.json({
      statements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        all: counts[0],
        pending: counts[1],
        verified: counts[2],
        rejected: counts[3],
        expired: counts[4],
      },
    });
  } catch (error) {
    console.error("Admin list statements error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
