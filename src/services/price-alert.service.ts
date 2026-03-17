/**
 * Price alert evaluation service.
 * Server-side evaluation using the price pool's getDisplayPrice().
 * One-time trigger only. Source-group aware.
 * 30-day auto-expiry. Analytics-ready (priceAtCreation preserved).
 */

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getDisplayPrice, getAlertHighLow } from "@/services/price-pool.service";
import { createNotification } from "@/services/notification.service";
import {
  NOTIFICATION_TYPES,
  MAX_PRICE_ALERTS_PER_USER,
  PRICE_ALERT_EXPIRY_DAYS,
} from "@/lib/notification-types";

// ---- Broker symbol list (from EA) ----

const BROKER_SYMBOLS_TTL = 48 * 60 * 60; // 48 hours

export async function storeBrokerSymbols(broker: string, symbols: string[]): Promise<number> {
  const key = `broker-symbols:${broker}`;
  const upper = symbols.map((s) => s.toUpperCase());
  const unique = [...new Set(upper)].sort();
  await redis.set(key, JSON.stringify(unique), "EX", BROKER_SYMBOLS_TTL);
  return unique.length;
}

async function getBrokerSymbols(brokers: string[]): Promise<string[]> {
  if (brokers.length === 0) return [];
  const keys = brokers.map((b) => `broker-symbols:${b}`);
  const results = await redis.mget(...keys);
  const seen = new Set<string>();
  for (const raw of results) {
    if (!raw) continue;
    try {
      const arr = JSON.parse(raw) as string[];
      for (const sym of arr) seen.add(sym);
    } catch { /* ignore malformed */ }
  }
  return [...seen].sort();
}

// ---- Available symbols for user (traded + broker list) ----

export async function getUserTradedSymbols(userId: string): Promise<string[]> {
  // Get user's brokers from their MT accounts
  const userAccounts = await db.mtAccount.findMany({
    where: { userId, isActive: true },
    select: { broker: true },
  });
  if (userAccounts.length === 0) return [];

  const brokers = [...new Set(userAccounts.map((a) => a.broker))];

  // Get traded symbols from DB (same-broker scope)
  const brokerAccounts = await db.mtAccount.findMany({
    where: { broker: { in: brokers } },
    select: { id: true },
  });

  const rows = await db.mtTrade.findMany({
    where: { mtAccountId: { in: brokerAccounts.map((a) => a.id) } },
    select: { symbol: true },
    distinct: ["symbol"],
  });

  const seen = new Set<string>();
  for (const row of rows) {
    seen.add(row.symbol.toUpperCase());
  }

  // Merge with broker symbol list from Redis (sent by EA on login)
  const brokerSymbols = await getBrokerSymbols(brokers);
  for (const sym of brokerSymbols) {
    seen.add(sym);
  }

  return [...seen].sort();
}

// ---- Types ----

export interface CreatePriceAlertInput {
  userId: string;
  symbol: string;
  condition: "ABOVE" | "BELOW";
  targetPrice: number;
  sourceGroup?: string | null;
}

// ---- Create ----

export async function createPriceAlert(input: CreatePriceAlertInput) {
  // Check user limit
  const activeCount = await db.priceAlert.count({
    where: { userId: input.userId, status: "ACTIVE" },
  });
  if (activeCount >= MAX_PRICE_ALERTS_PER_USER) {
    return { error: "MAX_ALERTS_REACHED", alert: null };
  }

  // Get current price to check if already triggered
  const resolved = await getDisplayPrice(input.symbol, input.sourceGroup);
  const currentPrice = resolved.price;

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + PRICE_ALERT_EXPIRY_DAYS);

  // Create the alert
  const alert = await db.priceAlert.create({
    data: {
      userId: input.userId,
      symbol: input.symbol,
      condition: input.condition,
      targetPrice: input.targetPrice,
      sourceGroup: input.sourceGroup ?? null,
      lastSeenPrice: currentPrice,
      priceAtCreation: currentPrice,
      expiresAt,
    },
  });

  // Check immediate trigger (current price already past threshold)
  if (currentPrice !== null) {
    const shouldTrigger =
      (input.condition === "ABOVE" && currentPrice >= input.targetPrice) ||
      (input.condition === "BELOW" && currentPrice <= input.targetPrice);

    if (shouldTrigger) {
      await triggerAlert(alert.id, input.userId, input.symbol, input.condition, input.targetPrice, currentPrice);
      return { error: null, alert: { ...alert, status: "TRIGGERED" as const, triggeredAt: new Date() } };
    }
  }

  return { error: null, alert };
}

// ---- Cancel ----

export async function cancelPriceAlert(alertId: string, userId: string) {
  const result = await db.priceAlert.updateMany({
    where: { id: alertId, userId, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });
  return result.count > 0;
}

// ---- Delete ----

export async function deletePriceAlert(alertId: string, userId: string) {
  const result = await db.priceAlert.deleteMany({
    where: { id: alertId, userId },
  });
  return result.count > 0;
}

// ---- List ----

export async function listPriceAlerts(userId: string) {
  return db.priceAlert.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

// ---- Active count (for badge) ----

export async function getActiveAlertCount(userId: string): Promise<number> {
  return db.priceAlert.count({
    where: { userId, status: "ACTIVE" },
  });
}

// ---- Price formatting (preserves meaningful decimals) ----

function formatPrice(price: number): string {
  // Show enough decimals to represent the price meaningfully.
  // Forex pairs: 5 digits (e.g. 1.23645). Gold/indices: 2-3. Crypto: varies.
  // Strategy: use the number's own string representation, but ensure at least 2
  // and at most 8 decimal places.
  const str = price.toString();
  const dotIndex = str.indexOf(".");
  if (dotIndex === -1) return price.toFixed(2);
  const decimals = str.length - dotIndex - 1;
  const clamped = Math.max(2, Math.min(decimals, 8));
  return price.toFixed(clamped);
}

// ---- Trigger a single alert ----

async function triggerAlert(
  alertId: string,
  userId: string,
  symbol: string,
  condition: string,
  targetPrice: number,
  currentPrice: number
) {
  await db.priceAlert.update({
    where: { id: alertId },
    data: {
      status: "TRIGGERED",
      triggeredAt: new Date(),
      lastSeenPrice: currentPrice,
    },
  });

  const direction = condition === "ABOVE" ? "above" : "below";
  await createNotification({
    userId,
    type: NOTIFICATION_TYPES.PRICE_ALERT_TRIGGERED,
    title: `${symbol} hit your target`,
    body: `${symbol} is now at ${formatPrice(currentPrice)} — ${direction} your ${formatPrice(targetPrice)} alert.`,
    ctaHref: "/notifications",
    payload: { alertId, symbol, condition, targetPrice, currentPrice },
    dedupeKey: `price_alert:${alertId}`,
  });
}

// ---- Expire stale alerts ----

export async function expireStaleAlerts(): Promise<number> {
  const now = new Date();

  // Find all ACTIVE alerts past their expiresAt
  const expiredAlerts = await db.priceAlert.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    select: { id: true, userId: true, symbol: true, condition: true, targetPrice: true },
  });

  if (expiredAlerts.length === 0) return 0;

  // Batch update status
  const ids = expiredAlerts.map((a) => a.id);
  await db.priceAlert.updateMany({
    where: { id: { in: ids } },
    data: { status: "EXPIRED" },
  });

  // Send notifications (group by user to avoid spam)
  const byUser = new Map<string, typeof expiredAlerts>();
  for (const alert of expiredAlerts) {
    if (!byUser.has(alert.userId)) byUser.set(alert.userId, []);
    byUser.get(alert.userId)!.push(alert);
  }

  for (const [userId, alerts] of byUser) {
    if (alerts.length === 1) {
      const a = alerts[0];
      const direction = a.condition === "ABOVE" ? "above" : "below";
      await createNotification({
        userId,
        type: NOTIFICATION_TYPES.PRICE_ALERT_EXPIRED,
        title: `${a.symbol} alert expired`,
        body: `Your ${direction} ${formatPrice(a.targetPrice)} alert for ${a.symbol} has expired after ${PRICE_ALERT_EXPIRY_DAYS} days.`,
        ctaHref: "/notifications",
        payload: { alertId: a.id, symbol: a.symbol, condition: a.condition, targetPrice: a.targetPrice },
        dedupeKey: `price_alert_expired:${a.id}`,
      });
    } else {
      // Batch notification for multiple expirations
      const symbols = [...new Set(alerts.map((a) => a.symbol))].join(", ");
      await createNotification({
        userId,
        type: NOTIFICATION_TYPES.PRICE_ALERT_EXPIRED,
        title: `${alerts.length} alerts expired`,
        body: `Your alerts for ${symbols} have expired after ${PRICE_ALERT_EXPIRY_DAYS} days.`,
        ctaHref: "/notifications",
        payload: { alertIds: alerts.map((a) => a.id), count: alerts.length },
        dedupeKey: `price_alert_expired_batch:${userId}:${now.toISOString().slice(0, 10)}`,
      });
    }
  }

  return expiredAlerts.length;
}

// ---- Server-side evaluation (runs on interval) ----

export async function evaluatePriceAlerts(): Promise<number> {
  // Expire stale alerts first
  const expired = await expireStaleAlerts();
  if (expired > 0) {
    console.log(`[PriceAlerts] expired=${expired}`);
  }

  // Get all active alerts grouped by symbol
  const activeAlerts = await db.priceAlert.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      userId: true,
      symbol: true,
      condition: true,
      targetPrice: true,
      sourceGroup: true,
    },
  });

  if (activeAlerts.length === 0) return 0;

  // Group by symbol+sourceGroup to batch price lookups
  const groups = new Map<string, typeof activeAlerts>();
  for (const alert of activeAlerts) {
    const key = `${alert.symbol}|${alert.sourceGroup ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(alert);
  }

  let triggered = 0;

  for (const [key, alerts] of groups) {
    const [symbol, sourceGroup] = key.split("|");
    const resolved = await getDisplayPrice(symbol, sourceGroup || undefined);

    // Skip if no price or price is stale (market closed / no data)
    if (resolved.price === null) continue;
    if (resolved.status === "no_price") continue;

    // Don't trigger on stale prices when market is closed (prevent weekend false triggers)
    // Exception: crypto which trades 24/7
    if (!resolved.marketOpen && resolved.status !== "fresh_same_source" && resolved.status !== "fresh_cross_source") {
      // Batch update lastSeenPrice for reference
      const ids = alerts.map((a) => a.id);
      await db.priceAlert.updateMany({
        where: { id: { in: ids } },
        data: { lastSeenPrice: resolved.price },
      });
      continue;
    }

    const currentPrice = resolved.price;

    // Use server-side M1 candle high/low for evaluation:
    // Looks at current + last 2 minutes to catch spikes between evaluation cycles.
    // ABOVE alerts check the HIGH (did price reach above target at any point?)
    // BELOW alerts check the LOW (did price reach below target at any point?)
    const hl = await getAlertHighLow(symbol);
    const checkHigh = hl?.high ?? currentPrice;
    const checkLow = hl?.low ?? currentPrice;

    const triggeredIds: string[] = [];
    const nonTriggeredIds: string[] = [];

    for (const alert of alerts) {
      const shouldTrigger =
        (alert.condition === "ABOVE" && checkHigh >= alert.targetPrice) ||
        (alert.condition === "BELOW" && checkLow <= alert.targetPrice);

      if (shouldTrigger) {
        // Use actual trigger price (high or low) for the notification
        const triggerPrice = alert.condition === "ABOVE" ? checkHigh : checkLow;
        await triggerAlert(
          alert.id,
          alert.userId,
          alert.symbol,
          alert.condition,
          alert.targetPrice,
          triggerPrice
        );
        triggeredIds.push(alert.id);
        triggered++;
      } else {
        nonTriggeredIds.push(alert.id);
      }
    }

    // Batch update lastSeenPrice for non-triggered alerts
    if (nonTriggeredIds.length > 0) {
      await db.priceAlert.updateMany({
        where: { id: { in: nonTriggeredIds } },
        data: { lastSeenPrice: currentPrice },
      });
    }
  }

  return triggered;
}
