import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { log } from "@/lib/audit";
import { getIO } from "@/lib/socket-io-global";
import { SOCKET_EVENTS } from "@/lib/chat-constants";
import { deriveRiskStatus } from "@/lib/risk-utils";
import { getDefaultTopic } from "@/services/topic.service";
import { createTradeCardMessage } from "@/services/trade-card.service";
import { maybeAutoPost } from "@/services/auto-post.service";
import { normalizeInstrument, mapDirection } from "@/services/signal-matcher.service";
import { computeAndSetEligibility } from "@/services/integrity.service";
import { computeQualificationDeadline, qualifyTrade } from "@/services/signal-qualification.service";
import { serializeMessageForSocket, topicRoom, clanRoom } from "./ea-signal-helpers";
import type { MtTrade } from "@prisma/client";

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

    // Determine tags and cardType
    const hasSL = (mtTrade.stopLoss ?? 0) > 0;
    const hasTP = (mtTrade.takeProfit ?? 0) > 0;
    const cardType = hasSL && hasTP ? "SIGNAL" as const : "ANALYSIS" as const;
    const tags = cardType === "SIGNAL" ? ["signal"] : ["analysis"];

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
      cardType,
    });

    if (!message.tradeCard) return;

    // Compute initial risk snapshot
    const sl = mtTrade.stopLoss ?? 0;
    const tp = mtTrade.takeProfit ?? 0;
    const initialRiskAbs = sl > 0 ? Math.abs(mtTrade.openPrice - sl) : 0;
    const direction = mapDirection(mtTrade.direction);

    // Create Trade record — starts PENDING, eligibility computed after
    const qualificationDeadline = computeQualificationDeadline(mtTrade.openTime);

    const trade = await db.trade.create({
      data: {
        tradeCardId: message.tradeCard.id,
        clanId,
        userId,
        status: "OPEN",
        integrityStatus: "PENDING",
        resolutionSource: "EA_VERIFIED",
        mtLinked: true,
        cardType,
        statementEligible: false,
        lastEvaluatedAt: new Date(),
        initialEntry: mtTrade.openPrice,
        initialStopLoss: sl,
        initialTakeProfit: tp,
        initialRiskAbs,
        initialRiskMissing: sl <= 0,
        riskStatus: deriveRiskStatus(direction, mtTrade.openPrice, sl),
        openedAt: mtTrade.openTime,
        openReceivedAt: new Date(),
        qualificationDeadline,
      },
    });

    // Link MtTrade → Trade
    await db.mtTrade.update({
      where: { id: mtTrade.id },
      data: { matchedTradeId: trade.id },
    });

    // If SL+TP present at open → qualify immediately
    if (hasSL && hasTP) {
      await qualifyTrade(
        trade.id, sl, tp, mtTrade.openPrice, "AT_OPEN",
        {
          lots: mtTrade.lots,
          currentPrice: mtTrade.openPrice,
          profit: mtTrade.profit ?? 0,
          direction: mtTrade.direction,
        }
      );
    } else {
      // Not qualified yet — eligibility check will fail, but run for audit
      await computeAndSetEligibility(trade.id);
    }

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
        const serialized = serializeMessageForSocket(fullMessage, clanId);
        io.to(topicRoom(clanId, topic.id)).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, serialized);
        io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, serialized);
      }

      const statusPayload = {
        tradeId: trade.id,
        messageId: message.id,
        status: trade.status,
        trade: { id: trade.id, status: trade.status, userId: trade.userId },
      };
      io.to(topicRoom(clanId, topic.id)).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, statusPayload);
      io.to(clanRoom(clanId)).emit(SOCKET_EVENTS.TRADE_STATUS_UPDATED, statusPayload);
    }

    // Auto-post (fire-and-forget) — only for SIGNAL cards
    if (cardType === "SIGNAL") {
      maybeAutoPost(message.tradeCard.id, clanId, userId).catch((err) =>
        log("ea_signal.auto_post_error", "ERROR", "EA", { error: String(err) }, userId)
      );
    }
  } catch (err) {
    log("ea_signal.auto_create_error", "ERROR", "EA", { error: String(err), ticket: String(mtTrade.ticket) }, userId);
  }
}
