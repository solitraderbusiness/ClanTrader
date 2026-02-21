import { db } from "@/lib/db";
import { hashSync } from "bcryptjs";
import type { TradeStatus, TradeDirection } from "@prisma/client";

const INSTRUMENTS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD"];
const DIRECTIONS: TradeDirection[] = ["LONG", "SHORT"];
const TIMEFRAMES = ["M15", "H1", "H4", "D1"];
const STATUSES: TradeStatus[] = ["PENDING", "OPEN", "TP_HIT", "SL_HIT", "BE", "CLOSED"];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomFloat(min: number, max: number, decimals = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

export async function generateDemoClans(count: number = 3) {
  const passwordHash = hashSync("password123", 10);
  const clans = [];

  for (let i = 0; i < count; i++) {
    const traderName = `Demo Trader ${i + 1}`;
    const clanName = `Demo Clan ${Date.now()}-${i}`;

    const user = await db.user.create({
      data: {
        email: `demo-trader-${Date.now()}-${i}@clantrader.ir`,
        passwordHash,
        name: traderName,
        role: "TRADER",
        tradingStyle: randomElement(["Scalping", "Day Trading", "Swing"]),
        emailVerified: new Date(),
      },
    });

    const clan = await db.clan.create({
      data: {
        name: clanName,
        description: `A demo clan for testing - ${randomElement(INSTRUMENTS)} focused`,
        tradingFocus: randomElement(INSTRUMENTS),
        createdById: user.id,
        settings: { publicTags: ["signal"], autoPostEnabled: true },
      },
    });

    await db.clanMember.create({
      data: { userId: user.id, clanId: clan.id, role: "LEADER" },
    });

    const topic = await db.chatTopic.create({
      data: {
        clanId: clan.id,
        name: "General",
        isDefault: true,
        sortOrder: 0,
        createdById: user.id,
      },
    });

    clans.push({ clan, user, topic });
  }

  return clans;
}

export async function generateDemoTrades(
  clanId: string,
  userId: string,
  topicId: string,
  count: number = 20
) {
  const trades = [];

  for (let i = 0; i < count; i++) {
    const instrument = randomElement(INSTRUMENTS);
    const direction = randomElement(DIRECTIONS);

    let entry: number, stopLoss: number, targets: number[];
    if (instrument === "XAUUSD") {
      entry = randomFloat(2600, 2700, 1);
      stopLoss = direction === "LONG" ? entry - randomFloat(10, 30, 1) : entry + randomFloat(10, 30, 1);
      targets = direction === "LONG"
        ? [entry + randomFloat(15, 40, 1)]
        : [entry - randomFloat(15, 40, 1)];
    } else if (instrument === "BTCUSD") {
      entry = randomFloat(90000, 100000, 0);
      stopLoss = direction === "LONG" ? entry - randomFloat(500, 1500, 0) : entry + randomFloat(500, 1500, 0);
      targets = direction === "LONG"
        ? [entry + randomFloat(800, 2000, 0)]
        : [entry - randomFloat(800, 2000, 0)];
    } else {
      entry = randomFloat(1.05, 1.15, 5);
      stopLoss = direction === "LONG" ? entry - randomFloat(0.002, 0.005, 5) : entry + randomFloat(0.002, 0.005, 5);
      targets = direction === "LONG"
        ? [entry + randomFloat(0.003, 0.008, 5)]
        : [entry - randomFloat(0.003, 0.008, 5)];
    }

    const createdAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    const status = randomElement(STATUSES);
    const tags = ["signal"];
    if (Math.random() > 0.5) tags.push(randomElement(["scalp", "swing", "tutorial"]));

    const message = await db.message.create({
      data: {
        clanId,
        topicId,
        userId,
        content: `${direction} ${instrument}`,
        type: "TRADE_CARD",
        createdAt,
      },
    });

    const tradeCard = await db.tradeCard.create({
      data: {
        messageId: message.id,
        instrument,
        direction,
        entry,
        stopLoss,
        targets,
        timeframe: randomElement(TIMEFRAMES),
        riskPct: randomFloat(1, 3, 1),
        tags,
        createdAt,
      },
    });

    const isResolved = ["TP_HIT", "SL_HIT", "BE", "CLOSED"].includes(status);
    const trade = await db.trade.create({
      data: {
        tradeCardId: tradeCard.id,
        clanId,
        userId,
        status,
        createdAt,
        ...(isResolved ? { closedAt: new Date(createdAt.getTime() + Math.random() * 48 * 60 * 60 * 1000) } : {}),
        integrityStatus: "VERIFIED",
        statementEligible: true,
        resolutionSource: "UNKNOWN",
        lastEvaluatedAt: createdAt,
      },
    });

    trades.push({ message, tradeCard, trade });
  }

  return trades;
}

export async function generateDemoStatements(clanId: string) {
  // This is triggered after trades are created
  const { calculateStatement } = await import("@/services/statement-calc.service");

  const members = await db.clanMember.findMany({
    where: { clanId },
    select: { userId: true },
  });

  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const statements = [];

  for (const member of members) {
    const stmt = await calculateStatement(
      member.userId,
      clanId,
      "MONTHLY",
      periodKey,
      new Date(now.getFullYear(), now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth() + 1, 0)
    );
    statements.push(stmt);
  }

  return statements;
}
