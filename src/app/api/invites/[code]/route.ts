import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getInviteByCode,
  redeemInvite,
  InviteServiceError,
} from "@/services/invite.service";
import { ClanServiceError } from "@/services/clan.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const invite = await getInviteByCode(code);

    // Return public info only
    return NextResponse.json({
      code: invite.code,
      clan: {
        id: invite.clan.id,
        name: invite.clan.name,
        description: invite.clan.description,
        avatar: invite.clan.avatar,
        tradingFocus: invite.clan.tradingFocus,
        memberCount: invite.clan._count.members,
      },
      remainingUses: invite.maxUses
        ? invite.maxUses - invite.uses
        : null,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    if (error instanceof InviteServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Get invite error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await params;
    const clan = await redeemInvite(code, session.user.id);
    return NextResponse.json({ clan, joined: true });
  } catch (error) {
    if (
      error instanceof InviteServiceError ||
      error instanceof ClanServiceError
    ) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Use invite error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
