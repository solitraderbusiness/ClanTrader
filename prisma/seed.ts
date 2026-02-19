import "dotenv/config";
import { PrismaClient, type TradeDirection, type TradeStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clean existing data (order matters for FK constraints)
  await prisma.testRun.deleteMany();
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
      settings: { autoPostEnabled: true, publicTags: ["signal"] },
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

  // ---------------------------------------------------------------------------
  // Generate trade cards + tracked trades for each trader (signal-tagged)
  // ---------------------------------------------------------------------------
  const INSTRUMENTS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD"];
  const DIRECTIONS: TradeDirection[] = ["LONG", "SHORT"];
  const TIMEFRAMES = ["M15", "H1", "H4", "D1"];
  const STATUSES: TradeStatus[] = ["TP1_HIT", "TP2_HIT", "SL_HIT", "BE", "CLOSED"];

  function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function rf(min: number, max: number, dec = 2): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
  }

  const traders = [
    { user: trader1, count: 15 },
    { user: trader2, count: 12 },
    { user: trader3, count: 14 },
    { user: admin, count: 11 },
  ];

  let totalTrades = 0;

  // Fetch the season for linking statements
  const season = await prisma.season.findFirst({ where: { status: "ACTIVE" } });

  for (const { user, count } of traders) {
    for (let i = 0; i < count; i++) {
      const instrument = pick(INSTRUMENTS);
      const direction = pick(DIRECTIONS);

      let entry: number, stopLoss: number, targets: number[];
      if (instrument === "XAUUSD") {
        entry = rf(2600, 2700, 1);
        stopLoss = direction === "LONG" ? entry - rf(10, 30, 1) : entry + rf(10, 30, 1);
        targets = direction === "LONG"
          ? [entry + rf(15, 40, 1), entry + rf(45, 80, 1)]
          : [entry - rf(15, 40, 1), entry - rf(45, 80, 1)];
      } else if (instrument === "BTCUSD") {
        entry = rf(90000, 100000, 0);
        stopLoss = direction === "LONG" ? entry - rf(500, 1500, 0) : entry + rf(500, 1500, 0);
        targets = direction === "LONG"
          ? [entry + rf(800, 2000, 0), entry + rf(2500, 5000, 0)]
          : [entry - rf(800, 2000, 0), entry - rf(2500, 5000, 0)];
      } else {
        entry = rf(1.05, 1.15, 5);
        stopLoss = direction === "LONG" ? entry - rf(0.002, 0.005, 5) : entry + rf(0.002, 0.005, 5);
        targets = direction === "LONG"
          ? [entry + rf(0.003, 0.008, 5), entry + rf(0.01, 0.02, 5)]
          : [entry - rf(0.003, 0.008, 5), entry - rf(0.01, 0.02, 5)];
      }

      const createdAt = new Date(now.getTime() - Math.random() * 25 * 24 * 60 * 60 * 1000);
      const status = pick(STATUSES);

      const msg = await prisma.message.create({
        data: {
          clanId: clan.id,
          topicId: generalTopic.id,
          userId: user.id,
          content: `${direction} ${instrument}`,
          type: "TRADE_CARD",
          createdAt,
        },
      });

      const card = await prisma.tradeCard.create({
        data: {
          messageId: msg.id,
          instrument,
          direction,
          entry,
          stopLoss,
          targets,
          timeframe: pick(TIMEFRAMES),
          riskPct: rf(1, 3, 1),
          tags: ["signal"],
          createdAt,
        },
      });

      await prisma.trade.create({
        data: {
          tradeCardId: card.id,
          clanId: clan.id,
          userId: user.id,
          status,
          createdAt,
          ...(status !== "OPEN"
            ? { closedAt: new Date(createdAt.getTime() + Math.random() * 48 * 60 * 60 * 1000) }
            : {}),
        },
      });

      // Auto-post to channel for signal-tagged cards
      await prisma.channelPost.create({
        data: {
          clanId: clan.id,
          authorId: user.id,
          title: `${direction} ${instrument} Signal`,
          content: `${direction} ${instrument} @ ${entry} | SL: ${stopLoss} | TP: ${targets.join(", ")}`,
          tradeCardId: card.id,
          sourceType: "AUTO_TAG",
          createdAt,
        },
      });

      totalTrades++;
    }
  }

  console.log(`  - ${totalTrades} signal-tagged trades + channel posts created`);

  // ---------------------------------------------------------------------------
  // Calculate statements for each trader in the clan
  // ---------------------------------------------------------------------------
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let statementsCreated = 0;

  for (const { user } of traders) {
    // Fetch eligible trades for this user
    const trades = await prisma.trade.findMany({
      where: {
        userId: user.id,
        clanId: clan.id,
        tradeCard: { tags: { hasSome: ["signal"] } },
      },
      include: {
        tradeCard: {
          select: { instrument: true, direction: true, entry: true, stopLoss: true, targets: true, tags: true },
        },
      },
    });

    // Calculate R-multiples and metrics inline (to avoid importing service code)
    const metrics = {
      signalCount: trades.length,
      wins: 0,
      losses: 0,
      breakEven: 0,
      closed: 0,
      open: 0,
      winRate: 0,
      avgRMultiple: 0,
      bestRMultiple: 0,
      worstRMultiple: 0,
      totalRMultiple: 0,
      instrumentDistribution: {} as Record<string, number>,
      directionDistribution: {} as Record<string, number>,
      tagDistribution: {} as Record<string, number>,
    };

    const rVals: number[] = [];

    for (const trade of trades) {
      const c = trade.tradeCard;
      metrics.instrumentDistribution[c.instrument] = (metrics.instrumentDistribution[c.instrument] || 0) + 1;
      metrics.directionDistribution[c.direction] = (metrics.directionDistribution[c.direction] || 0) + 1;
      for (const tag of c.tags) {
        metrics.tagDistribution[tag] = (metrics.tagDistribution[tag] || 0) + 1;
      }

      if (trade.status === "OPEN") { metrics.open++; continue; }

      const risk = Math.abs(c.entry - c.stopLoss);
      let r = 0;
      if (risk > 0) {
        switch (trade.status) {
          case "TP1_HIT": r = Math.abs(c.targets[0] - c.entry) / risk; break;
          case "TP2_HIT": r = c.targets.length > 1 ? Math.abs(c.targets[1] - c.entry) / risk : Math.abs(c.targets[0] - c.entry) / risk; break;
          case "SL_HIT": r = -1; break;
          case "BE": r = 0; break;
          case "CLOSED": r = 0; break;
        }
      }

      rVals.push(r);
      metrics.totalRMultiple += r;
      if (trade.status === "TP1_HIT" || trade.status === "TP2_HIT") metrics.wins++;
      else if (trade.status === "SL_HIT") metrics.losses++;
      else if (trade.status === "BE") metrics.breakEven++;
      else if (trade.status === "CLOSED") metrics.closed++;
    }

    const resolved = metrics.wins + metrics.losses + metrics.breakEven + metrics.closed;
    metrics.winRate = resolved > 0 ? metrics.wins / resolved : 0;
    metrics.avgRMultiple = rVals.length > 0 ? metrics.totalRMultiple / rVals.length : 0;
    metrics.bestRMultiple = rVals.length > 0 ? Math.max(...rVals) : 0;
    metrics.worstRMultiple = rVals.length > 0 ? Math.min(...rVals) : 0;

    // Create monthly statement
    await prisma.traderStatement.upsert({
      where: {
        userId_clanId_periodType_periodKey: {
          userId: user.id,
          clanId: clan.id,
          periodType: "MONTHLY",
          periodKey,
        },
      },
      create: {
        userId: user.id,
        clanId: clan.id,
        periodType: "MONTHLY",
        periodKey,
        seasonId: season?.id || null,
        metrics,
        tradeCount: trades.length,
      },
      update: {
        metrics,
        tradeCount: trades.length,
      },
    });

    // Also create seasonal statement linked to season
    if (season) {
      await prisma.traderStatement.upsert({
        where: {
          userId_clanId_periodType_periodKey: {
            userId: user.id,
            clanId: clan.id,
            periodType: "SEASONAL",
            periodKey: `season-${season.id}`,
          },
        },
        create: {
          userId: user.id,
          clanId: clan.id,
          periodType: "SEASONAL",
          periodKey: `season-${season.id}`,
          seasonId: season.id,
          metrics,
          tradeCount: trades.length,
        },
        update: {
          metrics,
          tradeCount: trades.length,
        },
      });
    }

    statementsCreated++;
  }

  console.log(`  - ${statementsCreated} trader statements calculated`);

  // ---------------------------------------------------------------------------
  // Build leaderboard entries from statements
  // ---------------------------------------------------------------------------
  if (season) {
    const statements = await prisma.traderStatement.findMany({
      where: { seasonId: season.id },
      include: { user: { select: { id: true, name: true } } },
    });

    // Filter eligible (minTrades = 10)
    const eligible = statements.filter((s) => s.tradeCount >= 10);

    if (eligible.length > 0) {
      type M = typeof eligible[0]["metrics"] & {
        totalRMultiple: number; worstRMultiple: number;
        winRate: number; avgRMultiple: number; signalCount: number;
      };

      const lenses = ["composite", "profit", "low_risk", "consistency", "risk_adjusted", "activity"];
      const weights = { profit: 0.30, low_risk: 0.15, consistency: 0.25, risk_adjusted: 0.20, activity: 0.10 };

      // Normalize helper
      function normalize(values: number[]): number[] {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        if (range === 0) return values.map(() => 0.5);
        return values.map((v) => (v - min) / range);
      }

      const metricsList = eligible.map((s) => ({ userId: s.userId, m: s.metrics as unknown as M }));
      const nProfit = normalize(metricsList.map((x) => x.m.totalRMultiple));
      const nLowRisk = normalize(metricsList.map((x) => x.m.worstRMultiple));
      const nConsistency = normalize(metricsList.map((x) => x.m.winRate));
      const nRiskAdj = normalize(metricsList.map((x) => x.m.avgRMultiple));
      const nActivity = normalize(metricsList.map((x) => x.m.signalCount));

      let leaderboardCount = 0;

      for (const lens of lenses) {
        const scored = metricsList.map((x, i) => {
          let score: number;
          switch (lens) {
            case "profit": score = nProfit[i]; break;
            case "low_risk": score = nLowRisk[i]; break;
            case "consistency": score = nConsistency[i]; break;
            case "risk_adjusted": score = nRiskAdj[i]; break;
            case "activity": score = nActivity[i]; break;
            case "composite":
              score = nProfit[i] * weights.profit + nLowRisk[i] * weights.low_risk +
                nConsistency[i] * weights.consistency + nRiskAdj[i] * weights.risk_adjusted +
                nActivity[i] * weights.activity;
              break;
            default: score = 0;
          }
          return { userId: x.userId, score, metrics: x.m };
        });

        scored.sort((a, b) => b.score - a.score);

        for (let i = 0; i < scored.length; i++) {
          const s = scored[i];
          await prisma.leaderboardEntry.upsert({
            where: {
              seasonId_entityType_entityId_lens: {
                seasonId: season.id,
                entityType: "TRADER",
                entityId: s.userId,
                lens,
              },
            },
            create: {
              seasonId: season.id,
              entityType: "TRADER",
              entityId: s.userId,
              lens,
              rank: i + 1,
              metrics: { score: s.score, ...(s.metrics as Record<string, unknown>) },
            },
            update: {
              rank: i + 1,
              metrics: { score: s.score, ...(s.metrics as Record<string, unknown>) },
            },
          });
          leaderboardCount++;
        }
      }

      console.log(`  - ${leaderboardCount} leaderboard entries created`);
    }
  }

  console.log("\nSeed data created successfully:");
  console.log(`  - 5 users (1 admin, 3 traders, 1 spectator)`);
  console.log(`  - 1 clan with 4 members`);
  console.log(`  - 2 topics (General + Gold Signals)`);
  console.log(`  - ${totalTrades} signal-tagged trades`);
  console.log(`  - ${statementsCreated} trader statements`);
  console.log(`  - 3 trading events`);
  console.log(`  - 1 active season`);
  console.log(`  - ${featureFlags.length} feature flags`);
  console.log(`  - 1 ranking config`);
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
