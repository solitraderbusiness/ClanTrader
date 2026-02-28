import crypto from "crypto";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { audit, log } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth-utils";
import { RESERVED_USERNAMES } from "@/lib/reserved-usernames";
import type { EaRegisterInput, EaLoginInput, EaHeartbeatInput, MtTradeInput, EaTradeEventInput } from "@/lib/validators";
import { matchTradeToSignal } from "@/services/signal-matcher.service";
import { generateStatementFromMtAccount } from "@/services/mt-statement.service";
import { fetchPendingActionsForAccount } from "@/services/ea-action.service";
import { autoCreateSignalFromMtTrade, syncSignalModification, syncSignalClose } from "@/services/ea-signal.service";
import { calculateTargetRR } from "@/lib/risk-utils";
import { getIO } from "@/lib/socket-io-global";
import { SOCKET_EVENTS } from "@/lib/chat-constants";

function generateApiKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateLoginToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function registerEaUser(data: EaRegisterInput) {
  // Check reserved usernames
  if (RESERVED_USERNAMES.has(data.username)) {
    throw new Error("This username is reserved");
  }

  // Check username uniqueness
  const existing = await db.user.findUnique({ where: { username: data.username } });
  if (existing) {
    throw new Error("Username already taken");
  }

  // Check account number uniqueness across all users
  const existingAccount = await db.mtAccount.findUnique({
    where: { accountNumber_broker: { accountNumber: data.accountNumber, broker: data.broker } },
  });
  if (existingAccount) {
    throw new Error("This trading account is already connected by another user");
  }

  const passwordHash = hashPassword(data.password);
  const apiKey = generateApiKey();

  const user = await db.user.create({
    data: {
      username: data.username,
      name: data.username,
      passwordHash,
      role: "TRADER",
      mtAccounts: {
        create: {
          accountNumber: data.accountNumber,
          broker: data.broker,
          platform: data.platform,
          serverName: data.serverName,
          apiKey,
        },
      },
    },
    include: { mtAccounts: true },
  });

  // Generate one-time login token
  const loginToken = generateLoginToken();
  await redis.set(`ea-login-token:${loginToken}`, user.id, "EX", 600);

  audit("ea.register", "MtAccount", user.mtAccounts[0].id, user.id, {
    accountNumber: data.accountNumber,
    broker: data.broker,
    platform: data.platform,
  }, { category: "EA" });

  return {
    loginToken,
    apiKey,
    userId: user.id,
    accountId: user.mtAccounts[0].id,
  };
}

export async function loginEaUser(data: EaLoginInput) {
  const user = await db.user.findUnique({
    where: { username: data.username },
    include: { mtAccounts: { where: { isActive: true } } },
  });

  if (!user || !user.passwordHash) {
    throw new Error("Invalid username or password");
  }

  const valid = verifyPassword(data.password, user.passwordHash);
  if (!valid) {
    throw new Error("Invalid username or password");
  }

  // Check if this MT account already exists for user
  let mtAccount = user.mtAccounts.find(
    (a) => a.accountNumber === data.accountNumber && a.broker === data.broker
  );

  if (!mtAccount) {
    // Check account number uniqueness across all users
    const existingAccount = await db.mtAccount.findUnique({
      where: { accountNumber_broker: { accountNumber: data.accountNumber, broker: data.broker } },
    });
    if (existingAccount) {
      throw new Error("This trading account is already connected by another user");
    }

    // Auto-create new MtAccount for this user
    const apiKey = generateApiKey();
    mtAccount = await db.mtAccount.create({
      data: {
        userId: user.id,
        accountNumber: data.accountNumber,
        broker: data.broker,
        platform: data.platform,
        serverName: data.serverName,
        apiKey,
      },
    });
  }

  // Auto-upgrade SPECTATOR → TRADER on EA login
  if (user.role === "SPECTATOR") {
    await db.user.update({
      where: { id: user.id },
      data: { role: "TRADER" },
    });
  }

  // Generate one-time login token
  const loginToken = generateLoginToken();
  await redis.set(`ea-login-token:${loginToken}`, user.id, "EX", 600);

  // Refresh accounts list
  const accounts = await db.mtAccount.findMany({
    where: { userId: user.id, isActive: true },
    select: {
      id: true,
      accountNumber: true,
      broker: true,
      platform: true,
      balance: true,
      equity: true,
      currency: true,
    },
  });

  audit("ea.login", "MtAccount", mtAccount.id, user.id, {
    accountNumber: data.accountNumber,
    broker: data.broker,
  }, { category: "EA" });

  return {
    loginToken,
    apiKey: mtAccount.apiKey,
    accounts,
  };
}

export async function authenticateByApiKey(apiKey: string) {
  const account = await db.mtAccount.findUnique({
    where: { apiKey },
    include: { user: true },
  });

  if (!account || !account.isActive) {
    return null;
  }

  return account;
}

export async function processHeartbeat(apiKey: string, data: EaHeartbeatInput) {
  const account = await authenticateByApiKey(apiKey);
  if (!account) throw new Error("Invalid API key");

  // Rate limit: 1 heartbeat per 10 seconds
  const rateLimitKey = `ea-heartbeat:${account.id}`;
  const limited = await redis.get(rateLimitKey);
  if (limited) {
    throw new Error("Rate limited: max 1 heartbeat per 10 seconds");
  }
  await redis.set(rateLimitKey, "1", "EX", 10);

  // Update account balance/equity
  await db.mtAccount.update({
    where: { id: account.id },
    data: {
      balance: data.balance,
      equity: data.equity,
      margin: data.margin,
      freeMargin: data.freeMargin,
      lastHeartbeat: new Date(),
    },
  });

  // Upsert open trades with signal change detection
  const linkedTrades: { matchedTradeId: string; currentPrice: number }[] = [];

  if (data.openTrades.length > 0) {
    for (const trade of data.openTrades) {
      // Fetch existing record before upsert for change detection
      const existing = await db.mtTrade.findUnique({
        where: { mtAccountId_ticket: { mtAccountId: account.id, ticket: trade.ticket } },
      });

      const mtTrade = await upsertMtTrade(account.id, trade);

      if (!existing) {
        // New trade detected via heartbeat — create signal card
        autoCreateSignalFromMtTrade(mtTrade, account.userId).catch((err) =>
          log("ea.auto_signal_error", "ERROR", "EA", { error: String(err), ticket: String(trade.ticket) }, account.userId)
        );
      } else if (existing.matchedTradeId) {
        // Existing linked trade — check for SL/TP changes
        const slChanged = (trade.stopLoss ?? 0) !== (existing.stopLoss ?? 0);
        const tpChanged = (trade.takeProfit ?? 0) !== (existing.takeProfit ?? 0);
        if (slChanged || tpChanged) {
          syncSignalModification(mtTrade, account.userId).catch((err) =>
            log("ea.sync_modification_error", "ERROR", "EA", { error: String(err), ticket: String(trade.ticket) }, account.userId)
          );
        }

        // Collect for R:R broadcast
        if (trade.currentPrice && trade.currentPrice > 0) {
          linkedTrades.push({ matchedTradeId: existing.matchedTradeId, currentPrice: trade.currentPrice });
        }
      } else if (mtTrade.matchedTradeId && trade.currentPrice && trade.currentPrice > 0) {
        // Newly linked trade (from autoCreate earlier in this heartbeat won't have matchedTradeId yet,
        // but trades linked from previous heartbeats will)
        linkedTrades.push({ matchedTradeId: mtTrade.matchedTradeId, currentPrice: trade.currentPrice });
      }
    }

    // Close trades not in the heartbeat's open list
    const openTickets = new Set(data.openTrades.map((t) => BigInt(t.ticket)));
    const dbOpenTrades = await db.mtTrade.findMany({
      where: { mtAccountId: account.id, isOpen: true },
    });
    for (const dbTrade of dbOpenTrades) {
      if (!openTickets.has(dbTrade.ticket)) {
        await db.mtTrade.update({
          where: { id: dbTrade.id },
          data: { isOpen: false },
        });

        // If linked, sync close
        if (dbTrade.matchedTradeId) {
          syncSignalClose(dbTrade, account.userId).catch((err) =>
            log("ea.sync_close_error", "ERROR", "EA", { error: String(err), ticket: String(dbTrade.ticket) }, account.userId)
          );
        }
      }
    }
  }

  // Cache latest prices per symbol for watchlist + live R:R
  if (data.openTrades.length > 0) {
    const ttl = priceCacheTTL();
    const seen = new Set<string>();
    for (const trade of data.openTrades) {
      const sym = trade.symbol?.toUpperCase();
      if (sym && trade.currentPrice && trade.currentPrice > 0 && !seen.has(sym)) {
        seen.add(sym);
        const priceJson = JSON.stringify({ price: trade.currentPrice, ts: Date.now() });
        redis.set(`price:${sym}`, priceJson, "EX", ttl).catch(() => {});
        // Also cache under normalized symbol so unlinked trade cards can find prices
        const norm = normalizeSymbol(sym);
        if (norm !== sym && !seen.has(norm)) {
          seen.add(norm);
          redis.set(`price:${norm}`, priceJson, "EX", ttl).catch(() => {});
        }
      }
    }
  }

  // Broadcast live R:R PnL for linked open trades
  if (linkedTrades.length > 0) {
    broadcastTradePnl(linkedTrades).catch((err) =>
      log("ea.broadcast_pnl_error", "ERROR", "EA", { error: String(err) }, account.userId)
    );
  }

  // Broadcast live R:R for unlinked trades in the user's clans using heartbeat prices
  if (data.openTrades.length > 0) {
    broadcastUnlinkedTradePnl(account.userId, data.openTrades).catch((err) =>
      log("ea.broadcast_unlinked_pnl_error", "ERROR", "EA", { error: String(err) }, account.userId)
    );
  }

  // Auto-generate trading statement from closed trades
  generateStatementFromMtAccount(account.userId, account.id).catch(() => {});

  // Fetch pending actions for this account (EA will execute them)
  const pendingActions = await fetchPendingActionsForAccount(account.id);

  return { ok: true, pendingActions };
}

export async function syncTradeHistory(apiKey: string, trades: MtTradeInput[]) {
  const account = await authenticateByApiKey(apiKey);
  if (!account) throw new Error("Invalid API key");

  let created = 0;
  let updated = 0;
  let matched = 0;

  for (const trade of trades) {
    const existing = await db.mtTrade.findUnique({
      where: { mtAccountId_ticket: { mtAccountId: account.id, ticket: trade.ticket } },
    });

    const mtTrade = await upsertMtTrade(account.id, trade);

    if (existing) {
      updated++;
    } else {
      created++;
    }

    // Try signal matching for closed trades
    if (!trade.isOpen && mtTrade && !mtTrade.matchedTradeId) {
      const matchResult = await matchTradeToSignal(mtTrade, account.userId);
      if (matchResult) matched++;
    }
  }

  // Auto-generate trading statement from closed trades
  generateStatementFromMtAccount(account.userId, account.id).catch(() => {});

  return { created, updated, matched };
}

export async function handleTradeEvent(apiKey: string, data: EaTradeEventInput) {
  const account = await authenticateByApiKey(apiKey);
  if (!account) throw new Error("Invalid API key");

  const mtTrade = await upsertMtTrade(account.id, data.trade);

  if (data.event === "open") {
    // Auto-create signal card (fire-and-forget)
    autoCreateSignalFromMtTrade(mtTrade, account.userId).catch((err) =>
      log("ea.auto_signal_error", "ERROR", "EA", { error: String(err), event: data.event, ticket: String(data.trade.ticket) }, account.userId)
    );
  } else if (data.event === "modify") {
    // Sync SL/TP modification (fire-and-forget)
    syncSignalModification(mtTrade, account.userId).catch((err) =>
      log("ea.sync_modification_error", "ERROR", "EA", { error: String(err), ticket: String(data.trade.ticket) }, account.userId)
    );
  } else if (data.event === "close") {
    if (mtTrade.matchedTradeId) {
      // Linked trade — sync close
      syncSignalClose(mtTrade, account.userId).catch((err) =>
        log("ea.sync_close_error", "ERROR", "EA", { error: String(err), ticket: String(data.trade.ticket) }, account.userId)
      );
    } else {
      // Unlinked — try legacy signal matching
      await matchTradeToSignal(mtTrade, account.userId);
    }
  }

  audit("ea.trade_event", "MtTrade", mtTrade.id, account.userId, {
    event: data.event,
    ticket: String(data.trade.ticket),
    symbol: data.trade.symbol,
  }, { category: "EA" });

  return { ok: true, tradeId: mtTrade.id };
}

export async function getUserMtAccounts(userId: string) {
  const accounts = await db.mtAccount.findMany({
    where: { userId },
    include: {
      _count: { select: { trades: true } },
    },
    orderBy: { connectedAt: "desc" },
  });

  return accounts.map((a) => ({
    id: a.id,
    accountNumber: a.accountNumber,
    broker: a.broker,
    serverName: a.serverName,
    accountType: a.accountType,
    platform: a.platform,
    balance: a.balance,
    equity: a.equity,
    currency: a.currency,
    leverage: a.leverage,
    isActive: a.isActive,
    lastHeartbeat: a.lastHeartbeat?.toISOString() ?? null,
    connectedAt: a.connectedAt.toISOString(),
    tradeCount: a._count.trades,
  }));
}

export async function regenerateApiKey(userId: string, accountId: string) {
  const account = await db.mtAccount.findFirst({
    where: { id: accountId, userId },
  });

  if (!account) throw new Error("Account not found");

  const newApiKey = generateApiKey();
  await db.mtAccount.update({
    where: { id: accountId },
    data: { apiKey: newApiKey },
  });

  return { apiKey: newApiKey };
}

export async function disconnectAccount(userId: string, accountId: string) {
  const account = await db.mtAccount.findFirst({
    where: { id: accountId, userId },
  });

  if (!account) throw new Error("Account not found");

  await db.mtAccount.update({
    where: { id: accountId },
    data: { isActive: false },
  });

  return { ok: true };
}

// --- Internal helpers ---

/**
 * Return a TTL for cached prices.
 * During market hours (Sun 22:00 UTC – Fri 22:00 UTC): 300s (5 min).
 * Outside market hours: seconds until next Sunday 22:00 UTC so the
 * last Friday close price persists through the weekend.
 */
function priceCacheTTL(): number {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const hour = now.getUTCHours();

  const marketOpen =
    (day === 0 && hour >= 22) ||  // Sunday after 22:00
    (day >= 1 && day <= 4) ||      // Mon–Thu all day
    (day === 5 && hour < 22);      // Friday before 22:00

  if (marketOpen) return 300;

  // Market is closed — compute seconds until Sunday 22:00 UTC
  let daysUntilSunday: number;
  if (day === 5) {
    // Friday 22:00+ → 2 days to Sunday
    daysUntilSunday = 2;
  } else if (day === 6) {
    // Saturday → 1 day to Sunday
    daysUntilSunday = 1;
  } else {
    // Sunday before 22:00 → 0 days (same day)
    daysUntilSunday = 0;
  }

  const nextOpen = new Date(now);
  nextOpen.setUTCDate(now.getUTCDate() + daysUntilSunday);
  // If we're on Saturday or Friday, target the upcoming Sunday
  // Adjust to Sunday if needed
  while (nextOpen.getUTCDay() !== 0) {
    nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
  }
  nextOpen.setUTCHours(22, 0, 0, 0);

  const seconds = Math.ceil((nextOpen.getTime() - now.getTime()) / 1000);
  // Minimum 300s, maximum ~3 days
  return Math.max(300, Math.min(seconds, 259200));
}

/** Strip common broker suffixes like _L, _l, .i, _m, _M etc. */
function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[._][A-Z]$/i, "");
}

async function broadcastTradePnl(
  linkedTrades: { matchedTradeId: string; currentPrice: number }[]
) {
  if (linkedTrades.length === 0) return;

  const tradeIds = linkedTrades.map((t) => t.matchedTradeId);
  const trades = await db.trade.findMany({
    where: { id: { in: tradeIds }, status: "OPEN" },
    include: {
      tradeCard: {
        include: {
          message: { select: { id: true, topicId: true, clanId: true } },
        },
      },
    },
  });

  const priceMap = new Map(linkedTrades.map((t) => [t.matchedTradeId, t.currentPrice]));
  const updates: { tradeId: string; messageId: string; currentRR: number; currentPrice: number; targetRR: number | null; riskStatus: string; clanId: string; topicId: string }[] = [];

  for (const trade of trades) {
    const currentPrice = priceMap.get(trade.id);
    if (!currentPrice) continue;

    const card = trade.tradeCard;
    const entry = trade.initialEntry ?? card.entry;
    // Prefer initialRiskAbs, fall back to card entry/SL
    const riskDistance = (trade.initialRiskAbs && trade.initialRiskAbs > 0)
      ? trade.initialRiskAbs
      : Math.abs(entry - card.stopLoss);
    if (riskDistance <= 0) continue;

    const dir = card.direction === "LONG" ? 1 : -1;
    const currentRR = (dir * (currentPrice - entry)) / riskDistance;

    const { clanId, topicId } = card.message;
    if (!topicId) continue;

    updates.push({
      tradeId: trade.id,
      messageId: card.message.id,
      currentRR: Math.round(currentRR * 100) / 100,
      currentPrice,
      targetRR: calculateTargetRR(card.targets[0], entry, riskDistance),
      riskStatus: trade.riskStatus,
      clanId,
      topicId,
    });
  }

  if (updates.length === 0) return;

  const io = getIO();
  if (!io) return;

  // Group by topic room and emit
  const byRoom = new Map<string, typeof updates>();
  const byClan = new Map<string, typeof updates>();
  for (const update of updates) {
    const room = `topic:${update.clanId}:${update.topicId}`;
    const arr = byRoom.get(room) || [];
    arr.push(update);
    byRoom.set(room, arr);

    // Also group by clan for channel tab subscribers
    const clanArr = byClan.get(update.clanId) || [];
    clanArr.push(update);
    byClan.set(update.clanId, clanArr);
  }

  const mapUpdate = (u: (typeof updates)[number]) => ({
    tradeId: u.tradeId,
    messageId: u.messageId,
    currentRR: u.currentRR,
    currentPrice: u.currentPrice,
    targetRR: u.targetRR,
    riskStatus: u.riskStatus,
  });

  for (const [room, roomUpdates] of byRoom) {
    io.to(room).emit(SOCKET_EVENTS.TRADE_PNL_UPDATE, {
      updates: roomUpdates.map(mapUpdate),
    });
  }

  // Broadcast to clan room so channel tab gets live R:R updates
  for (const [clanId, clanUpdates] of byClan) {
    io.to(`clan:${clanId}`).emit(SOCKET_EVENTS.TRADE_PNL_UPDATE, {
      updates: clanUpdates.map(mapUpdate),
    });
  }
}

/**
 * Broadcast live R:R for open trades that have NO linked MT trade.
 * Uses prices from the heartbeat sender's open trades to update
 * any unlinked trade cards in the sender's clans.
 */
async function broadcastUnlinkedTradePnl(
  userId: string,
  openTrades: EaHeartbeatInput["openTrades"]
) {
  // Build price map from heartbeat: normalized symbol → currentPrice
  const priceMap = new Map<string, number>();
  for (const t of openTrades) {
    const sym = t.symbol?.toUpperCase();
    if (!sym || !t.currentPrice || t.currentPrice <= 0) continue;
    priceMap.set(sym, t.currentPrice);
    const norm = normalizeSymbol(sym);
    if (norm !== sym) priceMap.set(norm, t.currentPrice);
  }
  if (priceMap.size === 0) return;

  // Find clans this user belongs to
  const memberships = await db.clanMember.findMany({
    where: { userId },
    select: { clanId: true },
  });
  if (memberships.length === 0) return;
  const clanIds = memberships.map((m) => m.clanId);

  // Find open trades in those clans with NO open MT trade match
  const unlinkedTrades = await db.trade.findMany({
    where: {
      clanId: { in: clanIds },
      status: "OPEN",
      mtTradeMatches: { none: { isOpen: true } },
    },
    include: {
      tradeCard: {
        include: {
          message: { select: { id: true, topicId: true, clanId: true } },
        },
      },
    },
  });
  if (unlinkedTrades.length === 0) return;

  const updates: { tradeId: string; messageId: string; currentRR: number; currentPrice: number; targetRR: number | null; riskStatus: string; clanId: string; topicId: string }[] = [];

  for (const trade of unlinkedTrades) {
    const card = trade.tradeCard;
    if (!card) continue;

    const instrument = card.instrument?.toUpperCase();
    if (!instrument) continue;
    const currentPrice = priceMap.get(instrument);
    if (!currentPrice) continue;

    const entry = trade.initialEntry ?? card.entry;
    const riskDistance = (trade.initialRiskAbs && trade.initialRiskAbs > 0)
      ? trade.initialRiskAbs
      : Math.abs(entry - card.stopLoss);
    if (riskDistance <= 0) continue;

    const dir = card.direction === "LONG" ? 1 : -1;
    const currentRR = (dir * (currentPrice - entry)) / riskDistance;

    const { clanId, topicId } = card.message;
    if (!topicId) continue;

    updates.push({
      tradeId: trade.id,
      messageId: card.message.id,
      currentRR: Math.round(currentRR * 100) / 100,
      currentPrice,
      targetRR: calculateTargetRR(card.targets[0], entry, riskDistance),
      riskStatus: trade.riskStatus,
      clanId,
      topicId,
    });
  }

  if (updates.length === 0) return;

  const io = getIO();
  if (!io) return;

  // Group by topic room and clan room, emit TRADE_PNL_UPDATE
  const byRoom = new Map<string, typeof updates>();
  const byClan = new Map<string, typeof updates>();
  for (const update of updates) {
    const room = `topic:${update.clanId}:${update.topicId}`;
    const arr = byRoom.get(room) || [];
    arr.push(update);
    byRoom.set(room, arr);

    const clanArr = byClan.get(update.clanId) || [];
    clanArr.push(update);
    byClan.set(update.clanId, clanArr);
  }

  const mapUpdate = (u: (typeof updates)[number]) => ({
    tradeId: u.tradeId,
    messageId: u.messageId,
    currentRR: u.currentRR,
    currentPrice: u.currentPrice,
    targetRR: u.targetRR,
    riskStatus: u.riskStatus,
  });

  for (const [room, roomUpdates] of byRoom) {
    io.to(room).emit(SOCKET_EVENTS.TRADE_PNL_UPDATE, {
      updates: roomUpdates.map(mapUpdate),
    });
  }

  for (const [clanId, clanUpdates] of byClan) {
    io.to(`clan:${clanId}`).emit(SOCKET_EVENTS.TRADE_PNL_UPDATE, {
      updates: clanUpdates.map(mapUpdate),
    });
  }
}

async function upsertMtTrade(mtAccountId: string, trade: MtTradeInput) {
  return db.mtTrade.upsert({
    where: {
      mtAccountId_ticket: { mtAccountId, ticket: trade.ticket },
    },
    create: {
      mtAccountId,
      ticket: trade.ticket,
      symbol: trade.symbol,
      direction: trade.direction,
      lots: trade.lots,
      openPrice: trade.openPrice,
      closePrice: trade.closePrice,
      openTime: new Date(trade.openTime),
      closeTime: trade.closeTime ? new Date(trade.closeTime) : null,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      profit: trade.profit,
      commission: trade.commission,
      swap: trade.swap,
      comment: trade.comment,
      magicNumber: trade.magicNumber,
      isOpen: trade.isOpen,
    },
    update: {
      closePrice: trade.closePrice,
      closeTime: trade.closeTime ? new Date(trade.closeTime) : null,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      profit: trade.profit,
      commission: trade.commission,
      swap: trade.swap,
      comment: trade.comment,
      isOpen: trade.isOpen,
    },
  });
}
