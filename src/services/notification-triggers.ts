/**
 * Notification trigger helpers.
 * Centralized notification creation for all event types.
 * Services call these instead of hardcoding notification logic.
 */

import { createNotification } from "@/services/notification.service";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";

// ---- Tracking / Heartbeat ----

export async function notifyTrackingLost(
  userId: string,
  accountNumber: number,
  broker: string
) {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.TRACKING_LOST,
    title: "Connection lost",
    body: `Your account ${accountNumber} (${broker}) stopped sending live data. Rankings and live stats may be less reliable until tracking resumes.`,
    ctaHref: "/settings/mt-accounts",
    dedupeKey: `tracking_lost:${userId}:${accountNumber}`,
    payload: { accountNumber, broker },
  });
}

export async function notifyTrackingRestored(
  userId: string,
  accountNumber: number,
  broker: string
) {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.TRACKING_RESTORED,
    title: "Connection restored",
    body: `Your account ${accountNumber} (${broker}) is back online. Live data and rankings are fully up to date.`,
    dedupeKey: `tracking_restored:${userId}:${accountNumber}`,
    payload: { accountNumber, broker },
  });
}

// ---- Trade Close ----

export async function notifyTradeClosed(
  userId: string,
  symbol: string,
  direction: string,
  outcome: string,
  finalRR: number | null
) {
  const outcomeLabel =
    outcome === "TP_HIT" ? "hit take profit" :
    outcome === "SL_HIT" ? "hit stop loss" :
    outcome === "BE" ? "closed at breakeven" :
    "closed";

  const rrText = finalRR != null ? ` at ${finalRR > 0 ? "+" : ""}${finalRR.toFixed(2)}R` : "";

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.TRADE_CLOSED,
    title: `${symbol} ${direction} ${outcomeLabel}`,
    body: `Your ${direction} position on ${symbol} ${outcomeLabel}${rrText}.`,
    payload: { symbol, direction, outcome, finalRR },
  });
}

// ---- Trade Action Results ----

export async function notifyTradeActionSuccess(
  userId: string,
  symbol: string,
  actionType: string,
  details?: string
) {
  const actionLabel =
    actionType === "SET_BE" ? "Break-even set" :
    actionType === "MOVE_SL" ? "Stop loss moved" :
    actionType === "CHANGE_TP" ? "Take profit updated" :
    actionType === "CLOSE" ? "Trade closed" :
    `Action completed (${actionType})`;

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.TRADE_ACTION_SUCCESS,
    title: `${actionLabel} on ${symbol}`,
    body: details ?? `Your ${actionLabel.toLowerCase()} request on ${symbol} was executed successfully.`,
    payload: { symbol, actionType },
  });
}

export async function notifyTradeActionFailed(
  userId: string,
  symbol: string,
  actionType: string,
  error?: string
) {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.TRADE_ACTION_FAILED,
    title: `Action failed on ${symbol}`,
    body: error ?? `Your ${actionType} request on ${symbol} could not be executed. Check your terminal or try again.`,
    ctaHref: "/settings/mt-accounts",
    payload: { symbol, actionType, error },
  });
}

// ---- Risk Warnings ----

export async function notifyRiskNoSL(
  userId: string,
  symbol: string,
  direction: string
) {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.RISK_NO_SL,
    title: `No stop loss on ${symbol}`,
    body: `Your ${direction} position on ${symbol} has no stop loss. This is unprotected risk.`,
    dedupeKey: `risk_no_sl:${userId}:${symbol}`,
    payload: { symbol, direction },
  });
}

export async function notifyRiskDrawdown(
  userId: string,
  drawdownPct: number,
  accountNumber: number
) {
  const pctText = drawdownPct.toFixed(1);
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.RISK_DRAWDOWN,
    title: `Drawdown reached ${pctText}%`,
    body: `Account ${accountNumber} is at ${pctText}% drawdown from peak equity. Consider reviewing your open positions.`,
    dedupeKey: `risk_drawdown:${userId}:${accountNumber}`,
    payload: { drawdownPct, accountNumber },
  });
}

// ---- Integrity / Qualification ----

export async function notifyQualificationMissed(
  userId: string,
  symbol: string,
  direction: string
) {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.QUALIFICATION_MISSED,
    title: `${symbol} became analysis-only`,
    body: `Your ${direction} trade on ${symbol} missed the 20-second qualification window. It won't count toward your public statement, but it's still in your journal.`,
    payload: { symbol, direction },
  });
}

export async function notifyIntegrityLost(
  userId: string,
  symbol: string,
  reason: string
) {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.INTEGRITY_LOST,
    title: `${symbol} lost statement eligibility`,
    body: `Your trade on ${symbol} is no longer eligible for your public statement. Reason: ${reason}.`,
    payload: { symbol, reason },
  });
}

// ---- Rank ----

export async function notifyRankChange(
  userId: string,
  oldRank: number | null,
  newRank: number,
  lens: string
) {
  // Only notify on meaningful changes (±3 positions or entering/leaving top 3)
  if (oldRank !== null) {
    const diff = Math.abs(oldRank - newRank);
    const enteredTop3 = oldRank > 3 && newRank <= 3;
    const leftTop3 = oldRank <= 3 && newRank > 3;

    if (diff < 3 && !enteredTop3 && !leftTop3) return;
  }

  const direction = oldRank === null ? "entered" : newRank < oldRank ? "climbed to" : "dropped to";

  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.RANK_CHANGE,
    title: `You ${direction} #${newRank}`,
    body: `Your rank on the ${lens} leaderboard is now #${newRank}.${newRank <= 3 ? " Great job staying in the top 3!" : ""}`,
    ctaHref: "/leaderboard",
    dedupeKey: `rank_change:${userId}:${lens}`,
    payload: { oldRank, newRank, lens },
  });
}

// ---- Clan ----

export async function notifyClanJoinRequest(
  leaderUserId: string,
  requesterName: string,
  clanName: string
) {
  await createNotification({
    userId: leaderUserId,
    type: NOTIFICATION_TYPES.CLAN_JOIN_REQUEST,
    title: "New join request",
    body: `${requesterName} wants to join ${clanName}. Review their request to approve or decline.`,
    payload: { requesterName, clanName },
  });
}

export async function notifyClanJoinApproved(
  userId: string,
  clanName: string
) {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.CLAN_JOIN_APPROVED,
    title: `Welcome to ${clanName}!`,
    body: `Your request to join ${clanName} has been approved. You're now a member.`,
    payload: { clanName },
  });
}

export async function notifyClanJoinRejected(
  userId: string,
  clanName: string
) {
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.CLAN_JOIN_REJECTED,
    title: `Join request declined`,
    body: `Your request to join ${clanName} was not approved.`,
    payload: { clanName },
  });
}

export async function notifyClanMemberJoined(
  leaderUserId: string,
  memberName: string,
  clanName: string
) {
  await createNotification({
    userId: leaderUserId,
    type: NOTIFICATION_TYPES.CLAN_MEMBER_JOINED,
    title: `${memberName} joined ${clanName}`,
    body: `${memberName} is now a member of ${clanName}.`,
    payload: { memberName, clanName },
  });
}
