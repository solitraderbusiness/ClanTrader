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
  await prisma.auditLog.deleteMany();
  await prisma.rankingConfig.deleteMany();
  await prisma.traderStatement.deleteMany();
  await prisma.tradeEvent.deleteMany();
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
  await prisma.subscriptionPlan.deleteMany();
  await prisma.paywallRule.deleteMany();
  await prisma.featureFlag.deleteMany();
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

  // Create feature flags
  const featureFlags = [
    { key: "trade_cards", name: "Trade Cards", description: "Enable trade card creation in chat", enabled: true },
    { key: "trade_tracking", name: "Trade Tracking", description: "Enable trade tracking and status updates", enabled: true },
    { key: "trade_actions", name: "Trade Actions", description: "Enable trade action menu (Set BE, Move SL, etc.)", enabled: true },
    { key: "topics", name: "Chat Topics", description: "Enable topic-based chat organization", enabled: true },
    { key: "auto_post", name: "Auto Channel Posts", description: "Auto-post signal trades to channel feed", enabled: true },
    { key: "channel_posts", name: "Channel Posts", description: "Enable broadcast channel feed", enabled: true },
    { key: "leaderboard", name: "Leaderboard", description: "Enable seasonal leaderboard rankings", enabled: true },
    { key: "discover", name: "Discover", description: "Enable clan discovery page", enabled: true },
    { key: "summary", name: "Chat Summary", description: "Enable AI-powered chat summaries", enabled: true },
    { key: "paywall", name: "Paywall", description: "Enable paywall for premium content", enabled: false },
    { key: "alerts", name: "Alerts", description: "Enable price and event alerts", enabled: false },
    { key: "ai_features", name: "AI Features", description: "Enable AI-powered analysis features", enabled: false },
  ];

  await prisma.featureFlag.createMany({ data: featureFlags });

  // Create paywall rules
  await prisma.paywallRule.createMany({
    data: [
      {
        resourceType: "signal_details",
        name: "Signal Details",
        description: "Controls visibility of entry/SL/TP in auto-posted signals",
        freePreview: { showEntry: false, showTargets: false, showStopLoss: false },
        enabled: false,
      },
      {
        resourceType: "tutorial_details",
        name: "Tutorial Details",
        description: "Controls visibility of detailed tutorial content",
        freePreview: { showContent: true, showImages: false },
        enabled: false,
      },
    ],
  });

  // Create subscription plans
  await prisma.subscriptionPlan.createMany({
    data: [
      {
        name: "Free",
        slug: "free",
        description: "Basic access to the platform",
        price: 0,
        currency: "IRR",
        interval: "monthly",
        entitlements: ["VIEW_CHANNEL", "JOIN_CLAN", "CHAT"],
        sortOrder: 0,
      },
      {
        name: "Pro",
        slug: "pro",
        description: "Full access including signal details and advanced features",
        price: 500000,
        currency: "IRR",
        interval: "monthly",
        entitlements: ["VIEW_CHANNEL", "JOIN_CLAN", "CHAT", "VIEW_SIGNAL_DETAILS", "ADVANCED_FILTERS", "PRIORITY_SUPPORT"],
        sortOrder: 1,
      },
      {
        name: "Pro Annual",
        slug: "pro-annual",
        description: "Full access at a discounted annual rate",
        price: 5000000,
        currency: "IRR",
        interval: "yearly",
        entitlements: ["VIEW_CHANNEL", "JOIN_CLAN", "CHAT", "VIEW_SIGNAL_DETAILS", "ADVANCED_FILTERS", "PRIORITY_SUPPORT"],
        sortOrder: 2,
      },
    ],
  });

  // Create ranking config
  await prisma.rankingConfig.create({
    data: {
      key: "default",
      lenses: ["composite", "profit", "low_risk", "consistency", "risk_adjusted", "activity"],
      weights: { profit: 0.30, low_risk: 0.15, consistency: 0.25, risk_adjusted: 0.20, activity: 0.10 },
      minTrades: 10,
    },
  });

  console.log("Seed data created successfully:");
  console.log(`  - ${5} users (1 admin, 3 traders, 1 spectator)`);
  console.log(`  - ${1} clan with ${4} members`);
  console.log(`  - ${2} topics (General + Gold Signals)`);
  console.log(`  - ${3} trading events`);
  console.log(`  - ${3} watchlist items`);
  console.log(`  - ${1} active season`);
  console.log(`  - ${featureFlags.length} feature flags`);
  console.log(`  - ${2} paywall rules`);
  console.log(`  - ${3} subscription plans`);
  console.log(`  - ${1} ranking config`);
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
