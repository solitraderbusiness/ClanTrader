import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        bio: true,
        avatar: true,
        role: true,
        tradingStyle: true,
        sessionPreference: true,
        preferredPairs: true,
        isPro: true,
        createdAt: true,
        clanMemberships: {
          select: {
            role: true,
            clan: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        statements: {
          where: { verificationStatus: "VERIFIED" },
          orderBy: { uploadedAt: "desc" },
          take: 1,
          select: {
            extractedMetrics: true,
            verificationMethod: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
