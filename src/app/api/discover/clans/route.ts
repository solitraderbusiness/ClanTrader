import { NextResponse } from "next/server";
import { searchClans } from "@/services/clan.service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || undefined;
    const tradingFocus = searchParams.get("tradingFocus") || undefined;
    const sort = searchParams.get("sort") || "createdAt";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result = await searchClans(
      query,
      { tradingFocus, isPublic: true },
      { page, limit }
    );

    // Sort by requested field
    if (sort === "memberCount") {
      result.clans.sort((a, b) => b._count.members - a._count.members);
    } else if (sort === "followerCount") {
      result.clans.sort((a, b) => b.followerCount - a.followerCount);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Discover clans error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
