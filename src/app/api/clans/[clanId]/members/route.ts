import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { addMember, ClanServiceError } from "@/services/clan.service";

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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;

    // Check clan is public
    const clan = await db.clan.findUnique({ where: { id: clanId } });
    if (!clan) {
      return NextResponse.json({ error: "Clan not found" }, { status: 404 });
    }
    if (!clan.isPublic) {
      return NextResponse.json(
        { error: "This clan requires an invite to join" },
        { status: 403 }
      );
    }

    const member = await addMember(clanId, session.user.id);
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    if (error instanceof ClanServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Join clan error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
