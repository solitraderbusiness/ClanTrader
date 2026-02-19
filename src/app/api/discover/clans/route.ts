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

    // Filter out clans with visibilityOverride = "hidden"
    result.clans = result.clans.filter(
      (c) => (c as typeof c & { visibilityOverride?: string | null }).visibilityOverride !== "hidden"
    );

    // Sort by requested field, with featured clans first
    result.clans.sort((a, b) => {
      const aFeatured = (a as typeof a & { isFeatured?: boolean }).isFeatured ? 1 : 0;
      const bFeatured = (b as typeof b & { isFeatured?: boolean }).isFeatured ? 1 : 0;
      if (aFeatured !== bFeatured) return bFeatured - aFeatured;

      if (sort === "memberCount") {
        return b._count.members - a._count.members;
      } else if (sort === "followerCount") {
        return b.followerCount - a.followerCount;
      }
      return 0;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Discover clans error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
