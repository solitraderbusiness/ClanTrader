import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createPriceAlert, listPriceAlerts, getUserTradedSymbols } from "@/services/price-alert.service";

const createSchema = z.object({
  symbol: z.string().min(1).max(20),
  condition: z.enum(["ABOVE", "BELOW"]),
  targetPrice: z.number().positive(),
  sourceGroup: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const alerts = await listPriceAlerts(session.user.id);
  return NextResponse.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      symbol: a.symbol,
      condition: a.condition,
      targetPrice: a.targetPrice,
      sourceGroup: a.sourceGroup,
      status: a.status,
      triggeredAt: a.triggeredAt?.toISOString() ?? null,
      lastSeenPrice: a.lastSeenPrice,
      priceAtCreation: a.priceAtCreation,
      expiresAt: a.expiresAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", code: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Validate symbol is from user's traded instruments
  const tradedSymbols = await getUserTradedSymbols(session.user.id);
  if (!tradedSymbols.includes(parsed.data.symbol.toUpperCase())) {
    return NextResponse.json(
      { error: "Symbol not in your traded instruments", code: "INVALID_SYMBOL" },
      { status: 400 }
    );
  }

  const result = await createPriceAlert({
    userId: session.user.id,
    ...parsed.data,
  });

  if (result.error === "MAX_ALERTS_REACHED") {
    return NextResponse.json(
      { error: "Maximum active alerts reached", code: "MAX_ALERTS_REACHED" },
      { status: 400 }
    );
  }

  return NextResponse.json({ alert: result.alert }, { status: 201 });
}
