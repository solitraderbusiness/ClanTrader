import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDisplayPrice } from "@/services/price-pool.service";

/**
 * GET /api/prices?symbol=XAUUSD
 * Returns the latest cached price for a symbol from the global price pool.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol) {
    return NextResponse.json(
      { error: "Missing symbol", code: "VALIDATION_ERROR" },
      { status: 400 }
    );
  }

  const resolved = await getDisplayPrice(symbol);

  return NextResponse.json({
    symbol: resolved.symbol,
    price: resolved.price,
    ts: resolved.ts,
    status: resolved.status,
  });
}
