import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data (order matters for FK constraints)
  await prisma.tradeStatusHistory.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.tradeCardVersion.deleteMany();
  await prisma.tradeCard.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.tradingEvent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.chatTopic.deleteMany();
  await prisma.channelPost.deleteMany();
  await prisma.story.deleteMany();
  await prisma.leaderboardEntry.deleteMany();
  await prisma.season.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.clanInvite.deleteMany();
  await prisma.clanMember.deleteMany();
  await prisma.tradingStatement.deleteMany();
  await prisma.clan.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = hashSync("password123", 10);

  // Create test users
  const admin = await prisma.user.create({
    data: {
      email: "admin@clantrader.ir",
      passwordHash,
      name: "Admin User",
      bio: "Platform administrator",
      role: "ADMIN",
      emailVerified: new Date(),
      isPro: true,
    },
  });

  const trader1 = await prisma.user.create({
    data: {
      email: "trader1@clantrader.ir",
      passwordHash,
      name: "Ali Trader",
      bio: "XAUUSD specialist, 5 years experience",
      role: "TRADER",
      tradingStyle: "Scalping",
      sessionPreference: "London",
      preferredPairs: ["XAUUSD", "EURUSD"],
      emailVerified: new Date(),
      isPro: true,
    },
  });

  const trader2 = await prisma.user.create({
    data: {
      email: "trader2@clantrader.ir",
      passwordHash,
      name: "Sara Forex",
      bio: "Swing trader focused on major pairs",
      role: "TRADER",
      tradingStyle: "Swing",
      sessionPreference: "New York",
      preferredPairs: ["GBPUSD", "USDJPY", "EURUSD"],
      emailVerified: new Date(),
    },
  });

  const trader3 = await prisma.user.create({
    data: {
      email: "trader3@clantrader.ir",
      passwordHash,
      name: "Reza Gold",
      bio: "Gold and commodities day trader",
      role: "TRADER",
      tradingStyle: "Day Trading",
      sessionPreference: "Asian",
      preferredPairs: ["XAUUSD", "XAGUSD"],
      emailVerified: new Date(),
    },
  });

  await prisma.user.create({
    data: {
      email: "spectator@clantrader.ir",
      passwordHash,
      name: "New User",
      bio: "Just watching and learning",
      role: "SPECTATOR",
      emailVerified: new Date(),
    },
  });

  // Create a test clan
  const clan = await prisma.clan.create({
    data: {
      name: "Golden Eagles",
      description:
        "Top gold traders competing for the crown. Specializing in XAUUSD scalping and day trading strategies.",
      tradingFocus: "XAUUSD",
      createdById: trader1.id,
      tier: "PRO",
    },
  });

  // Add members to clan
  await prisma.clanMember.createMany({
    data: [
      { userId: trader1.id, clanId: clan.id, role: "LEADER" },
      { userId: trader2.id, clanId: clan.id, role: "CO_LEADER" },
      { userId: trader3.id, clanId: clan.id, role: "MEMBER" },
      { userId: admin.id, clanId: clan.id, role: "MEMBER" },
    ],
  });

  // Create default "General" topic for the clan
  const generalTopic = await prisma.chatTopic.create({
    data: {
      clanId: clan.id,
      name: "General",
      description: "General chat",
      isDefault: true,
      sortOrder: 0,
      createdById: trader1.id,
    },
  });

  // Create a "Gold Signals" topic
  await prisma.chatTopic.create({
    data: {
      clanId: clan.id,
      name: "Gold Signals",
      description: "XAUUSD trade ideas and signals",
      isDefault: false,
      sortOrder: 1,
      createdById: trader1.id,
    },
  });

  // Add a sample message in General
  await prisma.message.create({
    data: {
      clanId: clan.id,
      topicId: generalTopic.id,
      userId: trader1.id,
      content: "Welcome to Golden Eagles! Let's trade some gold!",
      type: "TEXT",
    },
  });

  // Create a season
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const seasonEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  await prisma.season.create({
    data: {
      name: `Season ${now.getMonth() + 1} - ${now.getFullYear()}`,
      startDate: seasonStart,
      endDate: seasonEnd,
      status: "ACTIVE",
    },
  });

  // Create sample trading events
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  await prisma.tradingEvent.createMany({
    data: [
      {
        title: "US Non-Farm Payrolls",
        description: "Monthly employment data release - high impact on USD pairs",
        instrument: "XAUUSD",
        impact: "HIGH",
        startTime: tomorrow,
        source: "Economic Calendar",
        isActive: true,
      },
      {
        title: "FOMC Meeting Minutes",
        description: "Federal Reserve meeting minutes release",
        instrument: "EURUSD",
        impact: "HIGH",
        startTime: dayAfter,
        source: "Economic Calendar",
        isActive: true,
      },
      {
        title: "ECB Rate Decision",
        description: "European Central Bank interest rate decision",
        instrument: "EURUSD",
        impact: "MEDIUM",
        startTime: new Date(now.getTime() + 72 * 60 * 60 * 1000),
        source: "Economic Calendar",
        isActive: true,
      },
    ],
  });

  // Create sample watchlist items
  await prisma.watchlist.createMany({
    data: [
      { userId: trader1.id, clanId: clan.id, instrument: "XAUUSD" },
      { userId: trader1.id, clanId: clan.id, instrument: "EURUSD" },
      { userId: trader2.id, clanId: clan.id, instrument: "GBPUSD" },
    ],
  });

  console.log("Seed data created successfully:");
  console.log(`  - ${5} users (1 admin, 3 traders, 1 spectator)`);
  console.log(`  - ${1} clan with ${4} members`);
  console.log(`  - ${2} topics (General + Gold Signals)`);
  console.log(`  - ${3} trading events`);
  console.log(`  - ${3} watchlist items`);
  console.log(`  - ${1} active season`);
  console.log("\nTest credentials: any email above with password: password123");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
