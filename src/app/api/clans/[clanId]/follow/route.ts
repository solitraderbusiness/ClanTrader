import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  followClan,
  unfollowClan,
  isFollowing,
} from "@/services/follow.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;
    const following = await isFollowing(session.user.id, clanId);
    return NextResponse.json({ following });
  } catch (error) {
    console.error("Check follow error:", error);
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
    await followClan(session.user.id, clanId);
    return NextResponse.json({ following: true });
  } catch (error) {
    console.error("Follow clan error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ clanId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clanId } = await params;
    await unfollowClan(session.user.id, clanId);
    return NextResponse.json({ following: false });
  } catch (error) {
    console.error("Unfollow clan error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
