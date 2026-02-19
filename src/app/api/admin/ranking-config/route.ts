import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DEFAULT_WEIGHTS, DEFAULT_LENSES, MIN_TRADES_DEFAULT } from "@/lib/ranking-constants";
import { audit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const config = await db.rankingConfig.findUnique({
      where: { key: "default" },
    });

    return NextResponse.json({
      config: config || {
        key: "default",
        lenses: DEFAULT_LENSES,
        weights: DEFAULT_WEIGHTS,
        minTrades: MIN_TRADES_DEFAULT,
      },
    });
  } catch (error) {
    console.error("Get ranking config error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { lenses, weights, minTrades } = body;

    const config = await db.rankingConfig.upsert({
      where: { key: "default" },
      create: {
        key: "default",
        lenses: (lenses || DEFAULT_LENSES) as Prisma.InputJsonValue,
        weights: (weights || DEFAULT_WEIGHTS) as unknown as Prisma.InputJsonValue,
        minTrades: minTrades || MIN_TRADES_DEFAULT,
      },
      update: {
        ...(lenses ? { lenses: lenses as Prisma.InputJsonValue } : {}),
        ...(weights ? { weights: weights as unknown as Prisma.InputJsonValue } : {}),
        ...(minTrades !== undefined ? { minTrades } : {}),
      },
    });

    audit("ranking_config.update", "RankingConfig", config.id, session.user.id, { changes: body });

    return NextResponse.json({ config });
  } catch (error) {
    console.error("Update ranking config error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
