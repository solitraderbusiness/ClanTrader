import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClanSchema } from "@/lib/validators";
import { createClan, searchClans } from "@/services/clan.service";
import { ClanServiceError } from "@/services/clan.service";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createClanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clan = await createClan(session.user.id, parsed.data);
    return NextResponse.json(clan, { status: 201 });
  } catch (error) {
    if (error instanceof ClanServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("Create clan error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || undefined;
    const tradingFocus = searchParams.get("tradingFocus") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result = await searchClans(
      query,
      { tradingFocus, isPublic: true },
      { page, limit }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Search clans error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
