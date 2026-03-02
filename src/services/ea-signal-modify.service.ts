import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { log } from "@/lib/audit";
import { deriveRiskStatus } from "@/lib/risk-utils";
import { maybeAutoPost, updateChannelPostRiskWarning, updateChannelPostTargets } from "@/services/auto-post.service";
import { computeAndSetEligibility } from "@/services/integrity.service";
import { createSystemMessage, broadcastMessages } from "./ea-signal-helpers";
import type { MtTrade } from "@prisma/client";

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

      await broadcastMessages(clanId, topicId, warnMsg, replyToId);

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

      await broadcastMessages(clanId, topicId, infoMsg, replyToId);

      updateChannelPostTargets(tradeCard.id, []).catch((err) =>
        log("ea_signal.channel_post_targets_error", "ERROR", "EA", { error: String(err) }, userId)
      );
    }

    // --- Normal SL/TP change (non-removal) ---
    if (!slRemoved && !tpRemoved) {
      let newTags = [...tradeCard.tags];
      let newCardType = tradeCard.cardType;
      const hasBothNow = newSL > 0 && newTP > 0;
      if (hasBothNow && (newTags.includes("analysis") || newCardType === "ANALYSIS")) {
        // Upgrade from ANALYSIS to SIGNAL — cardType only, NOT eligibility
        newTags = newTags.filter((t) => t !== "analysis");
        if (!newTags.includes("signal")) newTags.push("signal");
        newCardType = "SIGNAL";

        // Also capture initial risk snapshot if not yet set
        const riskData: Record<string, unknown> = { cardType: "SIGNAL" };
        if (trade.initialRiskMissing || !trade.initialStopLoss || trade.initialStopLoss <= 0) {
          riskData.initialStopLoss = newSL;
          riskData.initialRiskAbs = Math.abs(tradeCard.entry - newSL);
          riskData.initialRiskMissing = false;
        }
        await db.trade.update({
          where: { id: trade.id },
          data: riskData,
        });

        await db.tradeEvent.create({
          data: {
            tradeId: trade.id,
            actionType: "INTEGRITY_FLAG",
            actorId: userId,
            oldValue: JSON.stringify({ cardType: "ANALYSIS" }),
            newValue: JSON.stringify({ cardType: "SIGNAL", reason: "ANALYSIS_UPGRADE" }),
            note: "Card upgraded from Analysis to Signal — eligibility NOT granted (Integrity Contract)",
            severity: "INFO",
            source: "EA",
          },
        });

        // Re-evaluate eligibility after upgrade + risk capture
        await computeAndSetEligibility(trade.id);

        maybeAutoPost(tradeCard.id, clanId, userId).catch((err) =>
          log("ea_signal.auto_post_error", "ERROR", "EA", { error: String(err), context: "tag_upgrade" }, userId)
        );
      }

      const newRiskStatus = deriveRiskStatus(tradeCard.direction, tradeCard.entry, newSL);
      // Capture initial risk if SL was added and not yet recorded
      const captureInitialRisk = newSL > 0 && (trade.initialRiskMissing || !trade.initialStopLoss || trade.initialStopLoss <= 0);
      await db.trade.update({
        where: { id: trade.id },
        data: {
          riskStatus: newRiskStatus,
          ...(newSL !== oldSL ? { slEverModified: true } : {}),
          ...(newTP !== oldTP ? { tpEverModified: true } : {}),
          ...(captureInitialRisk ? {
            initialStopLoss: newSL,
            initialRiskAbs: Math.abs(tradeCard.entry - newSL),
            initialRiskMissing: false,
          } : {}),
        },
      });

      // Re-evaluate eligibility when initial risk is first captured
      if (captureInitialRisk) {
        await computeAndSetEligibility(trade.id);
      }

      await db.tradeCard.update({
        where: { id: tradeCard.id },
        data: {
          stopLoss: newSL,
          targets: [newTP],
          tags: newTags,
          cardType: newCardType,
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

      await broadcastMessages(clanId, topicId, systemMsg, replyToId);
    }
  } catch (err) {
    log("ea_signal.sync_modification_error", "ERROR", "EA", { error: String(err), tradeId: mtTrade.matchedTradeId }, userId);
  }
}
