import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateDemoClans, generateDemoTrades, generateDemoStatements } from "@/services/demo-data.service";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { clanCount = 2, tradesPerClan = 15 } = body;

    const clans = await generateDemoClans(clanCount);

    let totalTrades = 0;
    for (const { clan, user, topic } of clans) {
      const trades = await generateDemoTrades(clan.id, user.id, topic.id, tradesPerClan);
      totalTrades += trades.length;
      await generateDemoStatements(clan.id);
    }

    audit("demo_data.generate", "System", "demo", session.user.id, {
      clanCount: clans.length,
      totalTrades,
    });

    return NextResponse.json({
      clans: clans.map((c) => ({ id: c.clan.id, name: c.clan.name })),
      totalTrades,
    });
  } catch (error) {
    console.error("Demo data generation error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
