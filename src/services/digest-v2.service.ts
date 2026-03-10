// ────────────────────────────────────────────
// Activity Digest v2 — Open Trade Health Layer
// ────────────────────────────────────────────
// Extends v1 digest with health-first open trade analysis.
// Closed trades remain R-centric. Open trades become health/risk-centric.

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getR, type TradeRow } from "@/lib/trade-r";
import { getDisplayPrice } from "@/services/price-pool.service";
import {
  computeOpenTradeHealth,
  computeRComputability,
  buildAttentionQueue,
  buildLiveHealthSummary,
  type OpenTradeInput,
} from "@/lib/open-trade-health";
import { DIGEST_V2_CACHE_TTL, TRACKING_STALE_SECONDS, TRACKING_LOST_SECONDS } from "@/lib/digest-constants";
import type { DigestPeriod } from "@/types/clan-digest";
import type {
  DigestV2Response,
  MemberStatsV2,
  OpenPositionV2,
  ClosedTradeV2,
} from "@/lib/digest-v2-schema";

function getPeriodStart(period: DigestPeriod, tzOffset: number = 0): Date {
  const offsetMs = tzOffset * 60 * 1000;
  const nowLocal = new Date(Date.now() - offsetMs);

  let localMidnight: Date;
  if (period === "today") {
    localMidnight = new Date(
      Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate())
    );
  } else if (period === "week") {
    const day = nowLocal.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    localMidnight = new Date(
      Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), nowLocal.getUTCDate() - diff)
    );
  } else {
    localMidnight = new Date(
      Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), 1)
    );
  }

  return new Date(localMidnight.getTime() + offsetMs);
}

function deriveTrackingStatus(lastHeartbeat: Date | null): string {
  if (!lastHeartbeat) return "TRACKING_LOST";
  const age = (Date.now() - lastHeartbeat.getTime()) / 1000;
  if (age < TRACKING_STALE_SECONDS) return "ACTIVE";
  if (age < TRACKING_LOST_SECONDS) return "STALE";
  return "TRACKING_LOST";
}

export async function getClanDigestV2(
  clanId: string,
  period: DigestPeriod = "today",
  tzOffset: number = 0
): Promise<DigestV2Response> {
  const cacheKey = `clan-digest-v2:${clanId}:${period}:${tzOffset}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* continue */ }

  const periodStart = getPeriodStart(period, tzOffset);

  // Fetch trades with extended data for health computation
  const trades = await db.trade.findMany({
    where: {
      clanId,
      OR: [
        { createdAt: { gte: periodStart } },
        { closedAt: { gte: periodStart } },
      ],
    },
    select: {
      id: true,
      status: true,
      finalRR: true,
      netProfit: true,
      closePrice: true,
      closedAt: true,
      createdAt: true,
      initialEntry: true,
      initialStopLoss: true,
      initialTakeProfit: true,
      initialRiskAbs: true,
      cardType: true,
      userId: true,
      riskStatus: true,
      // Official frozen snapshot
      officialEntryPrice: true,
      officialInitialStopLoss: true,
      officialInitialTargets: true,
      officialInitialRiskAbs: true,
      officialInitialRiskMoney: true,
      officialSignalQualified: true,
      tradeCard: {
        select: {
          instrument: true,
          direction: true,
          entry: true,
          stopLoss: true,
          targets: true,
          tags: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
        },
      },
      mtTradeMatches: {
        take: 1,
        select: {
          closePrice: true,
          openPrice: true,
          stopLoss: true,
          takeProfit: true,
          profit: true,
          commission: true,
          swap: true,
          isOpen: true,
          mtAccount: {
            select: {
              lastHeartbeat: true,
              trackingStatus: true,
              broker: true,
              serverName: true,
              platform: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const closedStatuses = new Set(["TP_HIT", "SL_HIT", "BE", "CLOSED"]);
  const openStatuses = new Set(["PENDING", "OPEN"]);

  // ─── Separate closed and open trades ───
  type TradeWithMeta = (typeof trades)[number];

  const closedTrades: Array<TradeWithMeta & { r: number | null }> = [];
  const openTrades: TradeWithMeta[] = [];

  for (const t of trades) {
    if (closedStatuses.has(t.status)) {
      const row = {
        ...t,
        mtClosePrice: t.mtTradeMatches[0]?.closePrice ?? null,
      };
      const r = getR(row as unknown as TradeRow);
      closedTrades.push({ ...t, r });
    } else if (openStatuses.has(t.status)) {
      openTrades.push(t);
    }
  }

  // ─── Compute open trade health ───
  const openHealthResults: Array<{
    trade: TradeWithMeta;
    health: ReturnType<typeof computeOpenTradeHealth>;
    rComputable: boolean;
    floatingR: number | null;
    floatingPnl: number | null;
    trackingStatus: string;
  }> = [];

  for (const t of openTrades) {
    const mt = t.mtTradeMatches[0];
    const instrument = t.tradeCard?.instrument ?? "";
    const direction = (t.tradeCard?.direction ?? "LONG") as "LONG" | "SHORT";

    // Get current price from price pool
    let currentPrice: number | null = null;
    let priceAvailable = false;
    try {
      const resolved = await getDisplayPrice(instrument);
      if (resolved && resolved.price !== null && resolved.price > 0) {
        currentPrice = resolved.price;
        priceAvailable = true;
      }
    } catch { /* price unavailable */ }

    // Derive tracking status from MT account heartbeat
    const trackingStatus = mt?.mtAccount
      ? deriveTrackingStatus(mt.mtAccount.lastHeartbeat)
      : "TRACKING_LOST";

    // Compute floating PnL and R
    let floatingPnl: number | null = null;
    let floatingR: number | null = null;
    if (mt) {
      floatingPnl = (mt.profit ?? 0) + (mt.commission ?? 0) + (mt.swap ?? 0);
      const riskMoney = t.officialInitialRiskMoney;
      const riskAbs = t.officialInitialRiskAbs ?? t.initialRiskAbs;
      if (riskMoney && riskMoney > 0) {
        floatingR = Math.round((floatingPnl / riskMoney) * 100) / 100;
      } else if (riskAbs && riskAbs > 0 && currentPrice !== null) {
        const entry = t.officialEntryPrice ?? t.initialEntry ?? t.tradeCard?.entry ?? 0;
        if (entry > 0) {
          const dir = direction === "LONG" ? 1 : -1;
          floatingR = Math.round((dir * (currentPrice - entry) / riskAbs) * 100) / 100;
        }
      }
    }

    const input: OpenTradeInput = {
      tradeId: t.id,
      userId: t.userId,
      username: t.user?.username ?? t.user?.name ?? "unknown",
      instrument,
      direction,
      currentPrice,
      currentSL: mt?.stopLoss ?? null,
      currentTP: mt?.takeProfit ?? null,
      floatingPnl,
      floatingR,
      cardEntry: t.tradeCard?.entry ?? 0,
      cardSL: t.tradeCard?.stopLoss ?? 0,
      cardTargets: t.tradeCard?.targets ?? [],
      officialEntry: t.officialEntryPrice,
      officialSL: t.officialInitialStopLoss,
      officialTargets: t.officialInitialTargets ?? [],
      officialRiskAbs: t.officialInitialRiskAbs,
      officialRiskMoney: t.officialInitialRiskMoney,
      mtOpenPrice: mt?.openPrice ?? null,
      trackingStatus,
      priceAvailable,
      riskStatus: t.riskStatus,
    };

    const health = computeOpenTradeHealth(input);
    const rComputable = computeRComputability(input);

    openHealthResults.push({
      trade: t,
      health,
      rComputable,
      floatingR,
      floatingPnl,
      trackingStatus,
    });
  }

  // ─── Build attention queue ───
  const attentionQueue = buildAttentionQueue(
    openHealthResults.map((r) => ({
      tradeId: r.trade.id,
      userId: r.trade.userId,
      username: r.trade.user?.username ?? r.trade.user?.name ?? "unknown",
      instrument: r.trade.tradeCard?.instrument ?? "",
      health: r.health,
      floatingR: r.floatingR,
      trackingStatus: r.trackingStatus,
      rComputable: r.rComputable,
    }))
  );

  // ─── Build live health summary ───
  const liveHealthSummary = buildLiveHealthSummary(
    openHealthResults.map((r) => ({
      health: r.health,
      rComputable: r.rComputable,
    }))
  );

  // ─── Per-member aggregation ───
  const memberMap = new Map<string, {
    userId: string;
    name: string;
    username: string;
    avatar: string | null;
    signalCount: number;
    analysisCount: number;
    tpHit: number;
    slHit: number;
    be: number;
    openCount: number;
    wins: number;
    losses: number;
    totalR: number;
    countWithR: number;
    closedTrades: ClosedTradeV2[];
    openPositions: OpenPositionV2[];
  }>();

  function getOrCreateMember(userId: string, name: string, username: string, avatar: string | null) {
    let entry = memberMap.get(userId);
    if (!entry) {
      entry = {
        userId, name, username, avatar,
        signalCount: 0, analysisCount: 0,
        tpHit: 0, slHit: 0, be: 0, openCount: 0,
        wins: 0, losses: 0, totalR: 0, countWithR: 0,
        closedTrades: [], openPositions: [],
      };
      memberMap.set(userId, entry);
    }
    return entry;
  }

  // Process closed trades
  for (const ct of closedTrades) {
    const m = getOrCreateMember(
      ct.userId,
      ct.user?.name ?? "Unknown",
      ct.user?.username ?? "unknown",
      ct.user?.avatar ?? null
    );

    if (ct.cardType === "SIGNAL") m.signalCount++;
    else m.analysisCount++;

    if (ct.status === "TP_HIT") m.tpHit++;
    else if (ct.status === "SL_HIT") m.slHit++;
    else if (ct.status === "BE") m.be++;

    if (ct.r !== null) {
      if (ct.r > 0) m.wins++;
      else if (ct.r < 0) m.losses++;
      m.countWithR++;
      m.totalR += ct.r;
    }

    if (m.closedTrades.length < 20) {
      m.closedTrades.push({
        tradeId: ct.id,
        instrument: ct.tradeCard?.instrument ?? "",
        direction: ct.tradeCard?.direction ?? "",
        status: ct.status,
        r: ct.r,
        cardType: ct.cardType ?? "SIGNAL",
        createdAt: ct.createdAt.toISOString(),
        closedAt: ct.closedAt?.toISOString() ?? null,
      });
    }
  }

  // Process open trades
  for (const ot of openHealthResults) {
    const t = ot.trade;
    const m = getOrCreateMember(
      t.userId,
      t.user?.name ?? "Unknown",
      t.user?.username ?? "unknown",
      t.user?.avatar ?? null
    );

    if (t.cardType === "SIGNAL") m.signalCount++;
    else m.analysisCount++;
    m.openCount++;

    if (m.openPositions.length < 20) {
      m.openPositions.push({
        tradeId: t.id,
        instrument: t.tradeCard?.instrument ?? "",
        direction: t.tradeCard?.direction ?? "",
        floatingR: ot.floatingR,
        floatingPnl: ot.floatingPnl,
        rComputable: ot.rComputable,
        health: ot.health,
        cardType: t.cardType ?? "SIGNAL",
        createdAt: t.createdAt.toISOString(),
      });
    }
  }

  // ─── Build summary and response ───
  let totalSignals = 0, totalAnalysis = 0;
  let tpHit = 0, slHit = 0, be = 0, openCount = 0;
  let wins = 0, losses = 0, totalR = 0, countWithR = 0;

  for (const m of memberMap.values()) {
    totalSignals += m.signalCount;
    totalAnalysis += m.analysisCount;
    tpHit += m.tpHit;
    slHit += m.slHit;
    be += m.be;
    openCount += m.openCount;
    wins += m.wins;
    losses += m.losses;
    totalR += m.totalR;
    countWithR += m.countWithR;
  }

  const decided = wins + losses;
  const members: MemberStatsV2[] = Array.from(memberMap.values())
    .sort((a, b) => b.totalR - a.totalR)
    .map((e) => {
      const d = e.wins + e.losses;
      return {
        userId: e.userId,
        name: e.name,
        avatar: e.avatar,
        signalCount: e.signalCount,
        analysisCount: e.analysisCount,
        tpHit: e.tpHit,
        slHit: e.slHit,
        be: e.be,
        openCount: e.openCount,
        winRate: d > 0 ? Math.round((e.wins / d) * 1000) / 10 : 0,
        totalR: Math.round(e.totalR * 100) / 100,
        avgR: e.countWithR > 0 ? Math.round((e.totalR / e.countWithR) * 100) / 100 : 0,
        closedTrades: e.closedTrades,
        openPositions: e.openPositions,
      };
    });

  const result: DigestV2Response = {
    version: 2,
    period,
    summary: {
      totalCards: totalSignals + totalAnalysis,
      totalSignals,
      totalAnalysis,
      tpHit,
      slHit,
      be,
      openCount,
      winRate: decided > 0 ? Math.round((wins / decided) * 1000) / 10 : 0,
      totalR: Math.round(totalR * 100) / 100,
      avgR: countWithR > 0 ? Math.round((totalR / countWithR) * 100) / 100 : 0,
      activeMemberCount: members.length,
    },
    members,
    liveHealthSummary,
    attentionQueue,
  };

  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", DIGEST_V2_CACHE_TTL);
  } catch { /* continue */ }

  return result;
}
