import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { log } from "@/lib/audit";
import { getIO } from "@/lib/socket-io-global";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { deriveRiskStatus } from "@/lib/risk-utils";
import { getDefaultTopic } from "@/services/topic.service";
import { createTradeCardMessage } from "@/services/trade-card.service";
import { maybeAutoPost, updateChannelPostRiskWarning, updateChannelPostTargets } from "@/services/auto-post.service";
import { evaluateUserBadges } from "@/services/badge-engine.service";
import { generateStatementFromMtAccount } from "@/services/mt-statement.service";
import { normalizeInstrument, mapDirection, pipDistance } from "@/services/signal-matcher.service";
import type { MtTrade } from "@prisma/client";

const CLOSE_TOLERANCE_PIPS = 5;

// --- Helpers ---

function serializeMessageForSocket(message: Awaited<ReturnType<typeof createTradeCardMessage>>, clanId: string) {
  return {
    id: message.id,
    clanId,
    topicId: message.topicId || null,
    content: message.content,
    images: [],
    type: message.type || "TRADE_CARD",
    isPinned: message.isPinned,
    isEdited: message.isEdited,
    reactions: null,
    replyTo: message.replyTo,
    createdAt: message.createdAt.toISOString(),
    user: message.user,
    tradeCard: message.tradeCard
      ? {
          id: message.tradeCard.id,
          instrument: message.tradeCard.instrument,
          direction: message.tradeCard.direction,
          entry: message.tradeCard.entry,
          stopLoss: message.tradeCard.stopLoss,
          targets: message.tradeCard.targets,
          timeframe: message.tradeCard.timeframe,
          riskPct: message.tradeCard.riskPct,
          note: message.tradeCard.note,
          tags: message.tradeCard.tags,
          trade: message.tradeCard.trade
            ? {
                id: message.tradeCard.trade.id,
                status: message.tradeCard.trade.status,
                userId: message.tradeCard.trade.userId,
                mtLinked: (message.tradeCard.trade as Record<string, unknown>).mtLinked as boolean | undefined,
                riskStatus: (message.tradeCard.trade as Record<string, unknown>).riskStatus as string | undefined,
                initialRiskAbs: (message.tradeCard.trade as Record<string, unknown>).initialRiskAbs as number | undefined,
                initialEntry: (message.tradeCard.trade as Record<string, unknown>).initialEntry as number | undefined,
                finalRR: (message.tradeCard.trade as Record<string, unknown>).finalRR as number | undefined,
                netProfit: (message.tradeCard.trade as Record<string, unknown>).netProfit as number | undefined,
                closePrice: (message.tradeCard.trade as Record<string, unknown>).closePrice as number | undefined,
              }
            : null,
        }
      : null,
  };
}

function topicRoom(clanId: string, topicId: string) {
  return `topic:${clanId}:${topicId}`;
}

// --- Auto-Create Signal ---

export async function autoCreateSignalFromMtTrade(
  mtTrade: MtTrade,
  userId: string
): Promise<void> {
  try {
    // Dedup: already linked to a trade card
    if (mtTrade.matchedTradeId) return;

    // Redis lock to prevent races between trade-event and heartbeat
    const lockKey = `ea-signal-lock:${mtTrade.mtAccountId}:${mtTrade.ticket}`;
    const acquired = await redis.set(lockKey, "1", "EX", 60, "NX");
    if (!acquired) return;

    // Find user's clan
    const membership = await db.clanMember.findFirst({
      where: { userId },
      select: { clanId: true },
    });
    if (!membership) return; // User not in a clan

    const clanId = membership.clanId;
    const topic = await getDefaultTopic(clanId);

    // Determine tags
    const hasSL = (mtTrade.stopLoss ?? 0) > 0;
    const hasTP = (mtTrade.takeProfit ?? 0) > 0;
    const tags = hasSL && hasTP ? ["signal"] : ["analysis"];

    // Create message + trade card
    const message = await createTradeCardMessage(clanId, topic.id, userId, {
      instrument: normalizeInstrument(mtTrade.symbol),
      direction: mapDirection(mtTrade.direction),
      entry: mtTrade.openPrice,
      stopLoss: mtTrade.stopLoss ?? 0,
      targets: [mtTrade.takeProfit ?? 0],
      timeframe: "AUTO",
      note: `Auto-generated from MetaTrader (Ticket #${mtTrade.ticket})`,
      tags,
    });

    if (!message.tradeCard) return;

    // Compute initial risk snapshot
    const sl = mtTrade.stopLoss ?? 0;
    const tp = mtTrade.takeProfit ?? 0;
    const initialRiskAbs = sl > 0 ? Math.abs(mtTrade.openPrice - sl) : 0;
    const direction = mapDirection(mtTrade.direction);
    const isSignal = tags.includes("signal");

    // Create Trade record — already executed in MT
    const trade = await db.trade.create({
      data: {
        tradeCardId: message.tradeCard.id,
        clanId,
        userId,
        status: "OPEN",
        integrityStatus: "VERIFIED",
        resolutionSource: "EA_VERIFIED",
        mtLinked: true,
        statementEligible: isSignal,
        lastEvaluatedAt: new Date(),
        initialEntry: mtTrade.openPrice,
        initialStopLoss: sl,
        initialTakeProfit: tp,
        initialRiskAbs,
        initialRiskMissing: sl <= 0,
        riskStatus: deriveRiskStatus(direction, mtTrade.openPrice, sl),
        wasEverCounted: isSignal,
        countedAt: isSignal ? new Date() : null,
      },
    });

    // Link MtTrade → Trade
    await db.mtTrade.update({
      where: { id: mtTrade.id },
      data: { matchedTradeId: trade.id },
    });

    // Broadcast via Socket.io
    const io = getIO();
    if (io) {
      // Re-fetch message to include the trade relation
      const fullMessage = await db.message.findUnique({
        where: { id: message.id },
        include: {
          user: { select: { id: true, name: true, username: true, avatar: true, role: true } },
          replyTo: {
            select: {
              id: true,
              content: true,
              user: { select: { id: true, name: true } },
            },
          },
          tradeCard: {
            include: {
              trade: { select: { id: true, status: true, userId: true, mtLinked: true, riskStatus: true, initialRiskAbs: true, initialEntry: true, finalRR: true, netProfit: true, closePrice: true } },
            },
          },
        },
      });

      if (fullMessage) {
        io.to(topicRoom(clanId, topic.id)).emit(
          SOCKET_EVENTS.RECEIVE_MESSAGE,
          serializeMessageForSocket(fullMessage, clanId)
        );
      }

      io.to(topicRoom(clanId, topic.id)).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, {
        tradeId: trade.id,
        messageId: message.id,
        status: trade.status,
        trade: { id: trade.id, status: trade.status, userId: trade.userId },
      });
    }

    // Auto-post (fire-and-forget)
    maybeAutoPost(message.tradeCard.id, clanId, userId).catch((err) =>
      log("ea_signal.auto_post_error", "ERROR", "EA", { error: String(err) }, userId)
    );
  } catch (err) {
    log("ea_signal.auto_create_error", "ERROR", "EA", { error: String(err), ticket: String(mtTrade.ticket) }, userId);
  }
}

// --- Sync SL/TP Modifications ---

export async function syncSignalModification(
  mtTrade: MtTrade,
  userId: string
): Promise<void> {
  try {
    if (!mtTrade.matchedTradeId) return;

    // Redis lock to prevent duplicate messages from heartbeat + trade-event race
    const lockKey = `ea-mod-lock:${mtTrade.matchedTradeId}:${mtTrade.stopLoss ?? 0}:${mtTrade.takeProfit ?? 0}`;
    const acquired = await redis.set(lockKey, "1", "EX", 30, "NX");
    if (!acquired) return;

    const trade = await db.trade.findUnique({
      where: { id: mtTrade.matchedTradeId },
      include: {
        tradeCard: {
          include: {
            message: { select: { id: true, topicId: true, clanId: true } },
          },
        },
      },
    });
    if (!trade) return;

    const tradeCard = trade.tradeCard;
    const newSL = mtTrade.stopLoss ?? 0;
    const newTP = mtTrade.takeProfit ?? 0;
    const oldSL = tradeCard.stopLoss;
    const oldTP = tradeCard.targets[0] ?? 0;

    // No change
    if (newSL === oldSL && newTP === oldTP) return;

    // Save version history
    await db.tradeCardVersion.create({
      data: {
        tradeCardId: tradeCard.id,
        instrument: tradeCard.instrument,
        direction: tradeCard.direction,
        entry: tradeCard.entry,
        stopLoss: tradeCard.stopLoss,
        targets: tradeCard.targets,
        timeframe: tradeCard.timeframe,
        riskPct: tradeCard.riskPct,
        note: tradeCard.note,
        tags: tradeCard.tags,
        editedById: userId,
      },
    });

    const { clanId, topicId } = tradeCard.message;
    const replyToId = tradeCard.message.id;
    const slRemoved = oldSL > 0 && newSL <= 0;
    const tpRemoved = oldTP > 0 && newTP <= 0;

    // --- SL Removal ---
    if (slRemoved) {
      await db.tradeEvent.create({
        data: {
          tradeId: trade.id,
          actionType: "SL_REMOVED",
          actorId: userId,
          oldValue: JSON.stringify({ stopLoss: oldSL }),
          newValue: JSON.stringify({ stopLoss: 0 }),
          note: "Stop Loss removed in MetaTrader",
          severity: "CRITICAL",
          source: "EA",
        },
      });

      await db.trade.update({
        where: { id: trade.id },
        data: { riskStatus: "UNPROTECTED" },
      });

      await db.tradeCard.update({
        where: { id: tradeCard.id },
        data: { stopLoss: 0 },
      });

      const warnMsg = await createSystemMessage(
        clanId, topicId, userId,
        `⚠️ Stop Loss removed (was ${oldSL}) — trade is now UNPROTECTED`,
        replyToId
      );

      broadcastMessages(clanId, topicId, warnMsg, replyToId);

      updateChannelPostRiskWarning(tradeCard.id, "SL_REMOVED").catch((err) =>
        log("ea_signal.channel_post_risk_warning_error", "ERROR", "EA", { error: String(err) }, userId)
      );
    }

    // --- TP Removal ---
    if (tpRemoved) {
      await db.tradeEvent.create({
        data: {
          tradeId: trade.id,
          actionType: "TP_REMOVED",
          actorId: userId,
          oldValue: JSON.stringify({ takeProfit: oldTP }),
          newValue: JSON.stringify({ takeProfit: 0 }),
          note: "Take Profit removed in MetaTrader",
          severity: "INFO",
          source: "EA",
        },
      });

      await db.tradeCard.update({
        where: { id: tradeCard.id },
        data: { targets: [0] },
      });

      const infoMsg = await createSystemMessage(
        clanId, topicId, userId,
        `Take Profit removed (was ${oldTP}) — target is now open`,
        replyToId
      );

      broadcastMessages(clanId, topicId, infoMsg, replyToId);

      updateChannelPostTargets(tradeCard.id, []).catch((err) =>
        log("ea_signal.channel_post_targets_error", "ERROR", "EA", { error: String(err) }, userId)
      );
    }

    // --- Normal SL/TP change (non-removal) ---
    if (!slRemoved && !tpRemoved) {
      let newTags = [...tradeCard.tags];
      const hasBothNow = newSL > 0 && newTP > 0;
      if (hasBothNow && newTags.includes("analysis")) {
        newTags = newTags.filter((t) => t !== "analysis");
        if (!newTags.includes("signal")) newTags.push("signal");

        await db.trade.update({
          where: { id: trade.id },
          data: {
            statementEligible: true,
            wasEverCounted: true,
            countedAt: new Date(),
          },
        });

        maybeAutoPost(tradeCard.id, clanId, userId).catch((err) =>
          log("ea_signal.auto_post_error", "ERROR", "EA", { error: String(err), context: "tag_upgrade" }, userId)
        );
      }

      const newRiskStatus = deriveRiskStatus(tradeCard.direction, tradeCard.entry, newSL);
      await db.trade.update({
        where: { id: trade.id },
        data: { riskStatus: newRiskStatus },
      });

      await db.tradeCard.update({
        where: { id: tradeCard.id },
        data: {
          stopLoss: newSL,
          targets: [newTP],
          tags: newTags,
        },
      });

      const changes: string[] = [];
      if (newSL !== oldSL) changes.push(`SL: ${oldSL || "not set"} → ${newSL || "not set"}`);
      if (newTP !== oldTP) changes.push(`TP: ${oldTP || "not set"} → ${newTP || "not set"}`);
      const changeText = changes.join(", ");

      await db.tradeEvent.create({
        data: {
          tradeId: trade.id,
          actionType: "INTEGRITY_FLAG",
          actorId: userId,
          oldValue: JSON.stringify({ stopLoss: oldSL, takeProfit: oldTP }),
          newValue: JSON.stringify({ stopLoss: newSL, takeProfit: newTP }),
          note: `MetaTrader updated ${changeText}`,
          severity: "INFO",
          source: "EA",
        },
      });

      const systemMsg = await createSystemMessage(
        clanId, topicId, userId,
        `MetaTrader updated ${changeText}`,
        replyToId
      );

      broadcastMessages(clanId, topicId, systemMsg, replyToId);
    }
  } catch (err) {
    log("ea_signal.sync_modification_error", "ERROR", "EA", { error: String(err), tradeId: mtTrade.matchedTradeId }, userId);
  }
}

// --- Sync Trade Close ---

export async function syncSignalClose(
  mtTrade: MtTrade,
  userId: string
): Promise<void> {
  try {
    if (!mtTrade.matchedTradeId) return;

    const trade = await db.trade.findUnique({
      where: { id: mtTrade.matchedTradeId },
      include: {
        tradeCard: {
          include: {
            message: { select: { id: true, topicId: true, clanId: true } },
          },
        },
      },
    });
    if (!trade) return;

    // Already closed
    if (trade.closedAt) return;

    const tradeCard = trade.tradeCard;
    const entry = tradeCard.entry;
    const sl = tradeCard.stopLoss;
    const tp = tradeCard.targets[0] ?? 0;
    const closePrice = mtTrade.closePrice ?? entry;
    const instrument = tradeCard.instrument;

    // Determine outcome
    let outcome: "TP_HIT" | "SL_HIT" | "BE" | "CLOSED" = "CLOSED";
    if (tp > 0 && pipDistance(instrument, closePrice, tp) <= CLOSE_TOLERANCE_PIPS) {
      outcome = "TP_HIT";
    } else if (sl > 0 && pipDistance(instrument, closePrice, sl) <= CLOSE_TOLERANCE_PIPS) {
      outcome = "SL_HIT";
    } else if (pipDistance(instrument, closePrice, entry) <= CLOSE_TOLERANCE_PIPS) {
      outcome = "BE";
    }

    // Compute final R:R — prefer initialRiskAbs, fall back to card entry/SL
    const initialEntry = trade.initialEntry ?? entry;
    const riskAbs = (trade.initialRiskAbs && trade.initialRiskAbs > 0)
      ? trade.initialRiskAbs
      : Math.abs(initialEntry - sl);
    let finalRR: number | null = null;
    if (riskAbs > 0) {
      const dir = tradeCard.direction === "LONG" ? 1 : -1;
      finalRR = Math.round((dir * (closePrice - initialEntry)) / riskAbs * 100) / 100;
    }

    // Net P&L = profit + commission + swap (MT reports commission/swap as negatives)
    const netProfit = (mtTrade.profit ?? 0) + (mtTrade.commission ?? 0) + (mtTrade.swap ?? 0);

    // Update trade
    await db.trade.update({
      where: { id: trade.id },
      data: {
        status: outcome,
        closedAt: new Date(),
        resolutionSource: "EA_VERIFIED",
        integrityStatus: "VERIFIED",
        statementEligible: true,
        closePrice,
        finalRR,
        netProfit: Math.round(netProfit * 100) / 100,
      },
    });

    // Status history
    await db.tradeStatusHistory.create({
      data: {
        tradeId: trade.id,
        fromStatus: trade.status,
        toStatus: outcome,
        changedById: userId,
        note: `EA-verified close at ${closePrice} (${outcome})`,
      },
    });

    // Trade event
    await db.tradeEvent.create({
      data: {
        tradeId: trade.id,
        actionType: "STATUS_CHANGE",
        actorId: userId,
        oldValue: JSON.stringify({ status: trade.status }),
        newValue: JSON.stringify({ status: outcome, closePrice }),
        note: `Trade closed in MetaTrader at ${closePrice} → ${outcome}`,
        severity: "INFO",
        source: "EA",
      },
    });

    // System message — reply to trade card message
    const rrText = finalRR != null ? ` | ${finalRR > 0 ? "+" : ""}${finalRR}R` : "";
    const plText = netProfit !== 0 ? ` | P&L: ${netProfit > 0 ? "+" : ""}${netProfit.toFixed(2)}` : "";
    const { clanId, topicId } = tradeCard.message;
    const replyToId = tradeCard.message.id;
    const systemMsg = await db.message.create({
      data: {
        clanId,
        topicId,
        userId,
        content: `Trade closed at ${closePrice} → ${outcome}${rrText}${plText}`,
        type: "TRADE_ACTION",
        replyToId,
      },
      include: {
        user: { select: { id: true, name: true, username: true, avatar: true, role: true } },
        replyTo: {
          select: {
            id: true,
            content: true,
            user: { select: { id: true, name: true } },
          },
        },
        tradeCard: {
          include: {
            trade: { select: { id: true, status: true, userId: true, mtLinked: true, riskStatus: true, initialRiskAbs: true, initialEntry: true } },
          },
        },
      },
    });

    // Broadcast
    const io = getIO();
    if (io && topicId) {
      io.to(topicRoom(clanId, topicId)).emit(
        SOCKET_EVENTS.RECEIVE_MESSAGE,
        serializeMessageForSocket(systemMsg, clanId)
      );

      io.to(topicRoom(clanId, topicId)).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, {
        tradeId: trade.id,
        messageId: tradeCard.message.id,
        status: outcome,
        trade: { id: trade.id, status: outcome, userId: trade.userId },
      });
    }

    // Fire-and-forget: badges + statement generation
    evaluateUserBadges(userId).catch((err) =>
      log("badge.evaluation_error", "ERROR", "SYSTEM", { error: String(err), userId, context: "ea_signal_close" })
    );

    const mtAccount = await db.mtAccount.findFirst({
      where: { id: mtTrade.mtAccountId },
      select: { id: true },
    });
    if (mtAccount) {
      generateStatementFromMtAccount(userId, mtAccount.id).catch((err) =>
        log("ea_signal.statement_generation_error", "ERROR", "EA", { error: String(err), userId }, userId)
      );
    }
  } catch (err) {
    log("ea_signal.sync_close_error", "ERROR", "EA", { error: String(err), tradeId: mtTrade.matchedTradeId }, userId);
  }
}

// --- Internal helpers ---

const messageInclude = {
  user: { select: { id: true, name: true, username: true, avatar: true, role: true } },
  replyTo: {
    select: {
      id: true,
      content: true,
      user: { select: { id: true, name: true } },
    },
  },
  tradeCard: {
    include: {
      trade: { select: { id: true, status: true, userId: true, mtLinked: true, riskStatus: true, initialRiskAbs: true, initialEntry: true } },
    },
  },
} as const;

async function createSystemMessage(
  clanId: string,
  topicId: string | null,
  userId: string,
  content: string,
  replyToId?: string
) {
  return db.message.create({
    data: {
      clanId,
      topicId,
      userId,
      content,
      type: "TRADE_ACTION",
      ...(replyToId ? { replyToId } : {}),
    },
    include: messageInclude,
  });
}

function broadcastMessages(
  clanId: string,
  topicId: string | null,
  systemMsg: Awaited<ReturnType<typeof createSystemMessage>>,
  tradeCardMessageId: string
) {
  const io = getIO();
  if (!io || !topicId) return;

  io.to(topicRoom(clanId, topicId)).emit(
    SOCKET_EVENTS.RECEIVE_MESSAGE,
    serializeMessageForSocket(systemMsg, clanId)
  );

  // Re-fetch and emit MESSAGE_EDITED so clients update the trade card inline
  db.message.findUnique({
    where: { id: tradeCardMessageId },
    include: messageInclude,
  }).then((updatedMessage) => {
    if (updatedMessage) {
      io.to(topicRoom(clanId, topicId)).emit(
        SOCKET_EVENTS.MESSAGE_EDITED,
        serializeMessageForSocket(updatedMessage, clanId)
      );
    }
  }).catch((err) => {
    log("ea_signal.broadcast_refetch_error", "ERROR", "EA", { error: String(err) });
  });
}
