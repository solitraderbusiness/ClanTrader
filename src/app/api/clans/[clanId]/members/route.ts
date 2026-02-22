import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const { clanId } = await params;

    const members = await db.clanMember.findMany({
      where: { clanId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
            tradingStyle: true,
          },
        },
      },
      orderBy: [
        { role: "asc" }, // LEADER first, then CO_LEADER, then MEMBER
        { joinedAt: "asc" },
      ],
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Get members error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
