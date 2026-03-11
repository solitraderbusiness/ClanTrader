// ────────────────────────────────────────────
// Activity Digest v2 — Trading Cockpit Layer
// ────────────────────────────────────────────
// Cockpit-first digest: live P/L, floating R, open risk, actions needed.
// Health model supports the cockpit as secondary information.

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
import {
  computeStateAssessment,
  generateAlerts,
  generateActions,
  computeMemberImpactScore,
  getMemberImpactLabel,
  computeConcentration,
  computeRiskBudget,
  type AlertMemberInput,
  type ConcentrationPositionInput,
  type MemberSnapshotData,
} from "@/lib/digest-engines";
import type { DigestPeriod } from "@/types/clan-digest";
import type {
  DigestV2Response,
  MemberStatsV2,
  OpenPositionV2,
  ClosedTradeV2,
  TrackingSummary,
  CockpitSummary,
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

  // Fetch trades with extended data for health + cockpit computation
  const trades = await db.trade.findMany({
    where: {
      clanId,
      OR: [
        { createdAt: { gte: periodStart } },
        { closedAt: { gte: periodStart } },
        { status: { in: ["PENDING", "OPEN"] } },
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
              id: true,
              lastHeartbeat: true,
              trackingStatus: true,
              broker: true,
              serverName: true,
              platform: true,
              equity: true,
              balance: true,
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

  // ─── Build tracking summary from unique MT accounts across all trades ───
  const seenAccounts = new Map<string, string>();
  let totalEquity = 0;
  let totalBalance = 0;
  let hasEquityData = false;
  for (const t of trades) {
    const mt = t.mtTradeMatches[0];
    if (mt?.mtAccount) {
      const id = mt.mtAccount.id;
      if (!seenAccounts.has(id)) {
        seenAccounts.set(id, deriveTrackingStatus(mt.mtAccount.lastHeartbeat));
        if (mt.mtAccount.equity && mt.mtAccount.equity > 0) {
          totalEquity += mt.mtAccount.equity;
          totalBalance += mt.mtAccount.balance ?? 0;
          hasEquityData = true;
        }
      }
    }
  }
  const trackingSummary: TrackingSummary = {
    activeAccounts: 0,
    staleAccounts: 0,
    lostAccounts: 0,
  };
  for (const status of seenAccounts.values()) {
    if (status === "ACTIVE") trackingSummary.activeAccounts++;
    else if (status === "STALE") trackingSummary.staleAccounts++;
    else trackingSummary.lostAccounts++;
  }

  // ─── Compute open trade health + cockpit metrics ───
  const openHealthResults: Array<{
    trade: TradeWithMeta;
    health: ReturnType<typeof computeOpenTradeHealth>;
    rComputable: boolean;
    floatingR: number | null;
    floatingPnl: number | null;
    trackingStatus: string;
    riskToSLR: number | null;
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
    const riskAbs = t.officialInitialRiskAbs ?? t.initialRiskAbs;
    const entry = t.officialEntryPrice ?? t.initialEntry ?? t.tradeCard?.entry ?? 0;
    const dir = direction === "LONG" ? 1 : -1;

    if (mt) {
      floatingPnl = (mt.profit ?? 0) + (mt.commission ?? 0) + (mt.swap ?? 0);
      const riskMoney = t.officialInitialRiskMoney;
      if (riskMoney && riskMoney > 0) {
        floatingR = Math.round((floatingPnl / riskMoney) * 100) / 100;
      } else if (riskAbs && riskAbs > 0 && currentPrice !== null) {
        if (entry > 0) {
          floatingR = Math.round((dir * (currentPrice - entry) / riskAbs) * 100) / 100;
        }
      }
    }

    // Compute risk to SL: R position if current SL hits
    // e.g. original SL → -1R, BE lock → 0R, profit lock → +0.5R
    let riskToSLR: number | null = null;
    const currentSL = mt?.stopLoss ?? null;
    if (currentSL && currentSL > 0 && riskAbs && riskAbs > 0 && entry > 0) {
      riskToSLR = Math.round(dir * (currentSL - entry) / riskAbs * 100) / 100;
    }

    const input: OpenTradeInput = {
      tradeId: t.id,
      userId: t.userId,
      username: t.user?.username ?? t.user?.name ?? "unknown",
      instrument,
      direction,
      currentPrice,
      currentSL,
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
      riskToSLR,
    });
  }

  // ─── Cockpit aggregates from open trades ───
  let cockpitFloatingPnl = 0;
  let cockpitFloatingR = 0;
  let computableRCount = 0;
  let nonComputableRCount = 0;
  let cockpitOpenRiskR = 0;
  let unknownRiskCount = 0;
  let tradesNeedingAction = 0;
  let hasAnyPnl = false;
  let hasAnyR = false;
  let hasAnyRisk = false;

  for (const ot of openHealthResults) {
    if (ot.floatingPnl !== null) {
      cockpitFloatingPnl += ot.floatingPnl;
      hasAnyPnl = true;
    }
    if (ot.rComputable && ot.floatingR !== null) {
      cockpitFloatingR += ot.floatingR;
      computableRCount++;
      hasAnyR = true;
    } else {
      nonComputableRCount++;
    }
    if (ot.riskToSLR !== null) {
      cockpitOpenRiskR += ot.riskToSLR;
      hasAnyRisk = true;
    } else {
      unknownRiskCount++;
    }
    const h = ot.health.overall;
    if (h === "AT_RISK" || h === "BROKEN_PLAN") {
      tradesNeedingAction++;
    }
  }

  // Live confidence: aggregate from individual trade data confidence
  const totalOpen = openHealthResults.length;
  const lowConfCount = openHealthResults.filter(r => r.health.dataConfidence === "LOW").length;
  const partialConfCount = openHealthResults.filter(r => r.health.dataConfidence === "PARTIAL").length;
  const liveConfidence: "HIGH" | "PARTIAL" | "LOW" =
    totalOpen === 0 ? "HIGH" :
    lowConfCount > totalOpen / 2 ? "LOW" :
    (lowConfCount + partialConfCount) > 0 ? "PARTIAL" : "HIGH";

  // ─── Cockpit realized metrics from closed trades ───
  let realizedPnlTotal = 0;
  let hasRealizedPnl = false;
  let realizedRTotal = 0;
  let officialWins = 0;
  let officialLosses = 0;
  let officialClosedCount = 0;
  let unofficialClosedCount = 0;

  for (const ct of closedTrades) {
    // P/L from MT match (preferred) or Trade.netProfit fallback
    const mt = ct.mtTradeMatches[0];
    if (mt && mt.profit !== null) {
      realizedPnlTotal += (mt.profit ?? 0) + (mt.commission ?? 0) + (mt.swap ?? 0);
      hasRealizedPnl = true;
    } else if (ct.netProfit !== null) {
      realizedPnlTotal += ct.netProfit;
      hasRealizedPnl = true;
    }

    if (ct.r !== null) {
      realizedRTotal += ct.r;
    }

    const isOfficial = ct.officialSignalQualified === true && ct.cardType === "SIGNAL";
    if (isOfficial) {
      officialClosedCount++;
      if (ct.r !== null) {
        if (ct.r > 0) officialWins++;
        else if (ct.r < 0) officialLosses++;
      }
    } else {
      unofficialClosedCount++;
    }
  }

  const officialDecided = officialWins + officialLosses;
  const cockpit: CockpitSummary = {
    totalFloatingPnl: hasAnyPnl ? Math.round(cockpitFloatingPnl * 100) / 100 : null,
    totalFloatingR: hasAnyR ? Math.round(cockpitFloatingR * 100) / 100 : null,
    computableRCount,
    nonComputableRCount,
    currentOpenRiskR: hasAnyRisk ? Math.round(cockpitOpenRiskR * 100) / 100 : null,
    unknownRiskCount,
    tradesNeedingAction,
    liveConfidence,
    realizedPnl: hasRealizedPnl ? Math.round(realizedPnlTotal * 100) / 100 : null,
    realizedR: closedTrades.length > 0 ? Math.round(realizedRTotal * 100) / 100 : null,
    closedCount: closedTrades.length,
    officialWinRate: officialDecided > 0 ? Math.round((officialWins / officialDecided) * 1000) / 10 : null,
    officialCount: officialClosedCount,
    unofficialCount: unofficialClosedCount,
  };

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
    // Member cockpit accumulators
    mFloatingPnl: number;
    mFloatingR: number;
    mRiskToSLR: number;
    mActionsNeeded: number;
    mUnknownRiskCount: number;
    mTrackingLostCount: number;
    mStaleCount: number;
    mUnprotectedCount: number;
    mHasPnl: boolean;
    mHasR: boolean;
    mHasRisk: boolean;
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
        mFloatingPnl: 0, mFloatingR: 0, mRiskToSLR: 0,
        mActionsNeeded: 0, mUnknownRiskCount: 0,
        mTrackingLostCount: 0, mStaleCount: 0, mUnprotectedCount: 0,
        mHasPnl: false, mHasR: false, mHasRisk: false,
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
        isOfficial: ct.officialSignalQualified === true && ct.cardType === "SIGNAL",
        createdAt: ct.createdAt.toISOString(),
        closedAt: ct.closedAt?.toISOString() ?? null,
      });
    }
  }

  // Process open trades — accumulate member cockpit metrics
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

    // Member cockpit accumulation
    if (ot.floatingPnl !== null) {
      m.mFloatingPnl += ot.floatingPnl;
      m.mHasPnl = true;
    }
    if (ot.rComputable && ot.floatingR !== null) {
      m.mFloatingR += ot.floatingR;
      m.mHasR = true;
    }
    if (ot.riskToSLR !== null) {
      m.mRiskToSLR += ot.riskToSLR;
      m.mHasRisk = true;
    } else {
      m.mUnknownRiskCount++;
    }
    if (ot.health.overall === "AT_RISK" || ot.health.overall === "BROKEN_PLAN") {
      m.mActionsNeeded++;
    }
    if (ot.trackingStatus === "TRACKING_LOST") m.mTrackingLostCount++;
    else if (ot.trackingStatus === "STALE") m.mStaleCount++;
    if (ot.health.protectionStatus === "UNPROTECTED") m.mUnprotectedCount++;

    if (m.openPositions.length < 20) {
      m.openPositions.push({
        tradeId: t.id,
        instrument: t.tradeCard?.instrument ?? "",
        direction: t.tradeCard?.direction ?? "",
        floatingR: ot.floatingR,
        floatingPnl: ot.floatingPnl,
        rComputable: ot.rComputable,
        riskToSLR: ot.riskToSLR,
        health: ot.health,
        trackingStatus: ot.trackingStatus,
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

  // ─── Engine 1: State Assessment ───
  const stateAssessment = computeStateAssessment({
    openHealthResults: openHealthResults.map(r => ({
      health: r.health,
      rComputable: r.rComputable,
      trackingStatus: r.trackingStatus,
    })),
    trackingSummary,
  });

  // ─── Engine 3 prep: build member summaries for alerts + impact ───
  const alertMembers: AlertMemberInput[] = Array.from(memberMap.values())
    .filter(e => e.openCount > 0)
    .map(e => ({
      userId: e.userId,
      name: e.name,
      openTradeCount: e.openCount,
      needActionCount: e.mActionsNeeded,
      unknownRiskCount: e.mUnknownRiskCount,
      unprotectedCount: e.mUnprotectedCount,
      trackingLostCount: e.mTrackingLostCount,
      staleCount: e.mStaleCount,
    }));

  // ─── Engine 6: Concentration Analysis (Phase 2) ───
  const concentrationPositions: ConcentrationPositionInput[] = [];
  for (const ot of openHealthResults) {
    concentrationPositions.push({
      instrument: ot.trade.tradeCard?.instrument ?? "",
      direction: ot.trade.tradeCard?.direction ?? "",
      memberName: ot.trade.user?.name ?? "Unknown",
      floatingR: ot.floatingR,
      riskToSLR: ot.riskToSLR,
    });
  }
  const concentration = computeConcentration(concentrationPositions);

  // ─── Engine 3: Risk Severity (Alerts) — with concentration ───
  const alerts = generateAlerts(stateAssessment, alertMembers, null, concentration);

  // ─── Engine 4: Action Queue ───
  const actions = generateActions(alerts);

  // ─── Engine 7: Risk Budget (Phase 2+3) ───
  const riskBudget = computeRiskBudget({
    currentOpenRiskR: cockpit.currentOpenRiskR,
    totalEquity: hasEquityData ? totalEquity : null,
    totalBalance: hasEquityData ? totalBalance : null,
    openTradeCount: openHealthResults.length,
  });

  // ─── Engine 5: Member Impact ───
  const memberImpactMap = new Map<string, { score: number; label: string | null }>();
  for (const am of alertMembers) {
    const score = computeMemberImpactScore(am, stateAssessment.metrics);
    const label = getMemberImpactLabel(score, am);
    memberImpactMap.set(am.userId, { score, label });
  }

  // ─── Engine 8: Member Trend + Snapshot Data (Phase 2) ───
  const memberSnapshotData: Record<string, MemberSnapshotData> = {};
  for (const am of alertMembers) {
    memberSnapshotData[am.userId] = {
      needAction: am.needActionCount,
      unknownRisk: am.unknownRiskCount,
      trackingLost: am.trackingLostCount,
      unprotected: am.unprotectedCount,
      openCount: am.openTradeCount,
    };
  }

  const members: MemberStatsV2[] = Array.from(memberMap.values())
    .sort((a, b) => b.totalR - a.totalR)
    .map((e) => {
      const d = e.wins + e.losses;
      const impact = memberImpactMap.get(e.userId);
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
        memberFloatingPnl: e.mHasPnl ? Math.round(e.mFloatingPnl * 100) / 100 : null,
        memberFloatingR: e.mHasR ? Math.round(e.mFloatingR * 100) / 100 : null,
        memberRiskToSLR: e.mHasRisk ? Math.round(e.mRiskToSLR * 100) / 100 : null,
        memberActionsNeeded: e.mActionsNeeded,
        memberUnknownRiskCount: e.mUnknownRiskCount,
        memberTrackingLostCount: e.mTrackingLostCount,
        memberStaleCount: e.mStaleCount,
        memberUnprotectedCount: e.mUnprotectedCount,
        memberImpactScore: impact?.score ?? 0,
        memberImpactLabel: impact?.label ?? null,
        memberTrend: "new" as const,
        closedTrades: e.closedTrades,
        openPositions: e.openPositions,
      };
    });

  const result: DigestV2Response = {
    version: 2,
    period,
    generatedAt: new Date().toISOString(),
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
    cockpit,
    trackingSummary,
    members,
    liveHealthSummary,
    attentionQueue,
    stateAssessment,
    alerts,
    actions,
    deltas: null,
    concentration,
    riskBudget,
    hints: [],
    _memberSnapshotData: memberSnapshotData,
  } as DigestV2Response & { _memberSnapshotData: Record<string, MemberSnapshotData> };

  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", DIGEST_V2_CACHE_TTL);
  } catch { /* continue */ }

  return result;
}
